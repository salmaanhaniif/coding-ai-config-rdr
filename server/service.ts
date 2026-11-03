import {
  accessSchema,
  caseSchema,
  correctionSchema,
  reviewSchema,
  outcomeSchema,
  makeFacts,
  type AccessProfile,
  type CaseSnapshot,
  type Consultation,
  type ConsultationDetail,
  type CorrectionInput,
  type ExpertReview,
  type Overview,
  type RuleNode,
  type Task,
} from '../shared/domain.js';
import { appendException, candidates, infer, regression, validateTree } from './rdr.js';
import {
  configurationIssues,
  profileSnapshot,
  resolveConclusion,
  validateCatalog,
} from './catalog.js';
import { AppError, demand } from './errors.js';
import { Store, now, uid } from './store.js';
const finals = ['APPROVED', 'CORRECTED_APPROVED'];
export class Advisor {
  constructor(public store: Store) {}
  overview(): Overview {
    const s = this.store;
    return {
      kbVersion: s.version('kb'),
      catalog: s.catalog(),
      nodes: s.rules(),
      accesses: s.list<AccessProfile>('accesses').filter((a) => !a.reference),
      consultations: s.list<Consultation>('consultations').reverse(),
      tasks: s.list('tasks'),
      bootstrapNeeded: !s.rules().find((n) => n.id === 'root')!.cornerstoneId,
    };
  }
  createAccess(input: unknown, options: { reference?: true } = {}) {
    const v = accessSchema.parse(input);
    const catalog = this.store.catalog();
    for (const id of v.modelIds) {
      const m = catalog.models.find((m) => m.id === id);
      demand(
        m && v.services.includes(m.service),
        'ACCESS_INVALID',
        'Model tidak ditemukan atau tidak cocok dengan layanan.',
      );
    }
    const a: AccessProfile = {
      ...v,
      id: uid(),
      createdAt: now(),
      ...(options.reference ? { reference: true } : {}),
    };
    this.store.insertAccess(a);
    return a;
  }
  createConsultation(input: unknown): ConsultationDetail {
    const v = caseSchema.parse(input);
    const s = this.store;
    return s.transaction(() => {
      const access = s.get<AccessProfile>('accesses', v.accessId);
      if (v.attributes.currentModelId) {
        const m = s.catalog().models.find((m) => m.id === v.attributes.currentModelId);
        demand(
          m && access.modelIds.includes(m.id),
          'ACCESS_INVALID',
          'Model saat ini tidak termasuk akses.',
        );
        if (v.attributes.currentEffort)
          demand(
            m.efforts.includes(v.attributes.currentEffort),
            'EFFORT_INVALID',
            'Effort saat ini tidak didukung.',
          );
      }
      let task: Task;
      if (v.taskId) task = s.get<Task>('tasks', v.taskId);
      else {
        task = {
          id: uid(),
          description: v.description,
          acceptance: v.acceptance,
          createdAt: now(),
        };
        s.insertTask(task);
      }
      const c: CaseSnapshot = {
        id: uid(),
        taskId: task.id,
        access,
        description: v.description,
        acceptance: v.acceptance,
        attributes: v.attributes,
        facts: makeFacts(access, v.attributes),
        createdAt: now(),
      };
      s.insertCase(c);
      const inference = infer(s.rules(), c.facts);
      const catalog = s.catalog();
      const r = resolveConclusion(inference.conclusion, access, catalog);
      const consultation: Consultation = {
        id: uid(),
        caseId: c.id,
        taskId: task.id,
        status: r.issues.length ? 'NEEDS_INFORMATION' : 'PENDING_EXPERT',
        kbVersion: s.version('kb'),
        catalogVersion: catalog.version,
        inference,
        ...r,
        createdAt: now(),
        updatedAt: now(),
      };
      s.saveConsultation(consultation);
      s.event('consultation.created', consultation);
      return this.detail(consultation.id);
    });
  }
  detail(id: string): ConsultationDetail {
    const s = this.store;
    const c = s.get<Consultation>('consultations', id);
    const snapshot = s.get<CaseSnapshot>('cases', c.caseId);
    // Use the tree version that produced this result, not the latest tree.
    const version = s.db
      .prepare('SELECT payload FROM kb_versions WHERE version=?')
      .get(c.kbVersion) as { payload: string };
    const nodes = JSON.parse(version.payload) as RuleNode[];
    const node = nodes.find((n) => n.id === c.inference.lastMatchedNode)!;
    const cornerstone = node.cornerstoneId
      ? s.get<CaseSnapshot>('cases', node.cornerstoneId)
      : null;
    return {
      consultation: c,
      case: snapshot,
      matchedRule: node,
      cornerstone,
      candidates: cornerstone ? candidates(snapshot.facts, cornerstone.facts) : [],
      reviews: s.list<ExpertReview>('reviews').filter((r) => r.consultationId === id),
    };
  }
  open(id: string) {
    const c = this.store.get<Consultation>('consultations', id);
    demand(!finals.includes(c.status), 'ALREADY_FINAL', 'Hasil final tidak dapat diubah.', 409);
    return c;
  }
  fresh(c: Consultation, kbVersion: number, catalogVersion: number) {
    demand(
      kbVersion === c.kbVersion &&
        catalogVersion === c.catalogVersion &&
        kbVersion === this.store.version('kb') &&
        catalogVersion === this.store.version('catalog'),
      'STALE_VERSION',
      'KB atau katalog berubah. Muat ulang inferensi dan tinjau kembali.',
      409,
    );
  }
  refresh(id: string) {
    return this.store.transaction(() => {
      const s = this.store;
      const c = this.open(id);
      const snapshot = s.get<CaseSnapshot>('cases', c.caseId);
      s.event('consultation.before_refresh', c);
      c.inference = infer(s.rules(), snapshot.facts);
      const catalog = s.catalog();
      Object.assign(c, resolveConclusion(c.inference.conclusion, snapshot.access, catalog), {
        kbVersion: s.version('kb'),
        catalogVersion: catalog.version,
        updatedAt: now(),
      });
      c.status = c.issues.length ? 'NEEDS_INFORMATION' : 'PENDING_EXPERT';
      s.saveConsultation(c);
      s.db.prepare('DELETE FROM drafts WHERE consultation_id=?').run(id);
      s.review(id, 'refreshed', 'Inferensi diperbarui; snapshot kasus tetap.');
      return this.detail(id);
    });
  }
  approve(id: string, input: unknown) {
    const v = reviewSchema.parse(input);
    return this.store.transaction(() => {
      const s = this.store;
      const c = this.open(id);
      this.fresh(c, v.kbVersion, v.catalogVersion);
      const snapshot = s.get<CaseSnapshot>('cases', c.caseId);
      const r = resolveConclusion(c.inference.conclusion, snapshot.access, s.catalog());
      demand(
        r.resolved && r.issues.length === 0,
        'CONFIG_UNAVAILABLE',
        r.issues.join(' ') || 'Konfigurasi belum tersedia.',
        422,
      );
      const nodes = s.rules();
      const root = nodes.find((n) => n.id === 'root')!;
      if (!root.cornerstoneId) {
        demand(
          c.inference.lastMatchedNode === 'root',
          'BOOTSTRAP_REQUIRED',
          'Bootstrap harus menyetujui kesimpulan root.',
        );
        root.cornerstoneId = c.caseId;
        c.kbVersion = s.bumpKB(nodes);
      }
      c.status = 'APPROVED';
      c.resolved = r.resolved;
      c.issues = [];
      c.updatedAt = now();
      s.saveConsultation(c);
      s.review(id, 'approved', v.reason);
      return this.detail(id);
    });
  }
  information(id: string, input: unknown) {
    const v = reviewSchema.parse(input);
    return this.store.transaction(() => {
      const c = this.open(id);
      this.fresh(c, v.kbVersion, v.catalogVersion);
      c.status = 'NEEDS_INFORMATION';
      c.updatedAt = now();
      this.store.saveConsultation(c);
      this.store.review(id, 'needs_information', v.reason);
      return this.detail(id);
    });
  }
  draft(id: string, input: unknown) {
    const v = correctionSchema.parse(input);
    return this.store.transaction(() => {
      const c = this.open(id);
      this.fresh(c, v.kbVersion, v.catalogVersion);
      this.store.db
        .prepare(
          'INSERT INTO drafts VALUES(?,?) ON CONFLICT(consultation_id) DO UPDATE SET payload=excluded.payload',
        )
        .run(id, JSON.stringify(v));
      c.status = 'CORRECTION_DRAFT';
      c.updatedAt = now();
      this.store.saveConsultation(c);
      this.store.review(id, 'draft_saved', v.reason);
      return { draft: v };
    });
  }
  getDraft(id: string) {
    this.store.get('consultations', id);
    const r = this.store.db
      .prepare('SELECT payload FROM drafts WHERE consultation_id=?')
      .get(id) as { payload: string } | undefined;
    return { draft: r ? JSON.parse(r.payload) : null };
  }
  prepareCorrection(id: string, v: CorrectionInput) {
    const s = this.store;
    const c = this.open(id);
    this.fresh(c, v.kbVersion, v.catalogVersion);
    const snapshot = s.get<CaseSnapshot>('cases', c.caseId);
    const nodes = s.rules();
    const matched = nodes.find((n) => n.id === c.inference.lastMatchedNode)!;
    demand(
      matched.cornerstoneId,
      'BOOTSTRAP_REQUIRED',
      'Setujui kasus acuan root terlebih dahulu sebelum koreksi.',
      409,
    );
    const cornerstone = s.get<CaseSnapshot>('cases', matched.cornerstoneId);
    const resolved = profileSnapshot(s.catalog(), v.profileId);
    const issues = configurationIssues(resolved, snapshot.access, s.catalog());
    demand(!issues.length, 'CONFIG_UNAVAILABLE', issues.join(' '), 422);
    const node: RuleNode = {
      id: uid(),
      condition: v.condition,
      conclusion: { kind: 'fixed', snapshot: resolved },
      trueChild: null,
      falseChild: null,
      cornerstoneId: snapshot.id,
      reason: v.reason,
      createdAt: now(),
    };
    demand(
      JSON.stringify(node.conclusion) !== JSON.stringify(c.inference.conclusion),
      'UNCHANGED_CONCLUSION',
      'Koreksi harus mengganti kesimpulan.',
    );
    const next = appendException(nodes, snapshot.facts, cornerstone.facts, node);
    const protectedIds = new Set(nodes.map((n) => n.cornerstoneId).filter(Boolean));
    for (const approved of s.list<Consultation>('consultations'))
      if (finals.includes(approved.status)) protectedIds.add(approved.caseId);
    const protectedCases = s.list<CaseSnapshot>('cases').filter((c) => protectedIds.has(c.id));
    const changed = regression(nodes, next, protectedCases);
    if (changed.length)
      throw new AppError(
        'REGRESSION',
        'Kondisi mengubah hasil kasus yang sudah disetujui. Perjelas kondisi.',
        409,
        { caseIds: changed },
      );
    validateTree(next, new Set(s.list<CaseSnapshot>('cases').map((c) => c.id)));
    const inference = infer(next, snapshot.facts);
    demand(
      inference.lastMatchedNode === node.id,
      'CORRECTION_UNREACHABLE',
      'Kasus baru tidak mencapai aturan baru.',
    );
    return { c, next, node, resolved, inference, protectedCount: protectedCases.length };
  }
  preview(id: string, input: unknown) {
    const v = correctionSchema.parse(input);
    const p = this.prepareCorrection(id, v);
    return {
      valid: true,
      protectedCount: p.protectedCount,
      attachment: { nodeId: p.c.inference.terminalNode, branch: p.c.inference.terminalBranch },
      resolved: p.resolved,
    };
  }
  correct(id: string, input: unknown) {
    const v = correctionSchema.parse(input);
    return this.store.transaction(() => {
      const s = this.store;
      const p = this.prepareCorrection(id, v);
      const version = s.bumpKB(p.next);
      Object.assign(p.c, {
        status: 'CORRECTED_APPROVED',
        kbVersion: version,
        catalogVersion: s.version('catalog'),
        inference: p.inference,
        resolved: p.resolved,
        issues: [],
        updatedAt: now(),
      });
      s.saveConsultation(p.c);
      s.db.prepare('DELETE FROM drafts WHERE consultation_id=?').run(id);
      s.review(id, 'corrected', v.reason, { nodeId: p.node.id, protectedCount: p.protectedCount });
      return this.detail(id);
    });
  }
  updateCatalog(input: unknown) {
    const catalog = validateCatalog(input);
    return this.store.transaction(() => {
      demand(
        catalog.version === this.store.version('catalog'),
        'STALE_VERSION',
        'Katalog berubah. Ambil versi terbaru.',
        409,
      );
      catalog.version++;
      this.store.saveCatalog(catalog);
      return catalog;
    });
  }
  outcome(taskId: string, input: unknown) {
    const value = outcomeSchema.parse(input);
    this.store.get('tasks', taskId);
    return this.store.transaction(() => {
      const outcome = { ...value, id: uid(), taskId, createdAt: now() };
      this.store.db
        .prepare('INSERT INTO outcomes VALUES(?,?,?)')
        .run(outcome.id, taskId, JSON.stringify(outcome));
      this.store.event('task.outcome', outcome);
      return outcome;
    });
  }
  taskDetail(id: string) {
    const s = this.store;
    return {
      task: s.get<Task>('tasks', id),
      consultations: s.list<Consultation>('consultations').filter((c) => c.taskId === id),
      outcomes: s.list<{ taskId: string }>('outcomes').filter((o) => o.taskId === id),
    };
  }
}
