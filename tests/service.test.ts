import { afterEach, describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Advisor } from '../server/service.js';
import { Store } from '../server/store.js';
import { setup, task, review, approveRoot } from './helpers.js';
import type { ConsultationDetail, CaseSnapshot } from '../shared/domain.js';
const stores: Store[] = [];
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
});
const init = () => {
  const s = setup();
  stores.push(s.store);
  return s;
};
const correction = (c: ConsultationDetail, n = 3) => ({
  ...review(c),
  condition: { type: 'and' as const, terms: [{ field: 'failures', op: 'gte', value: n }] },
  profileId: 'demo-codex-deep-profile',
});
describe('Alur pakar dan integritas', () => {
  it('KB baru tepat satu root, bootstrap perlu persetujuan eksplisit', () => {
    const { store, advisor, access } = init();
    expect(store.rules()).toHaveLength(1);
    const c = advisor.createConsultation(task(access));
    expect(store.rules()[0].cornerstoneId).toBeNull();
    const approved = advisor.approve(c.consultation.id, review(c));
    expect(approved.consultation.status).toBe('APPROVED');
    expect(store.rules()[0].cornerstoneId).toBe(c.case.id);
    expect(store.rules()).toHaveLength(1);
    expect(approved.cornerstone?.id).toBe(c.case.id);
  });
  it('koreksi sebelum bootstrap ditolak', () => {
    const { advisor, access } = init();
    const c = advisor.createConsultation(task(access, { failures: 3 }));
    expect(() => advisor.correct(c.consultation.id, correction(c))).toThrow('acuan root');
  });
  it('hasil masih sementara hingga disetujui', () => {
    const { advisor, access } = init();
    const c = advisor.createConsultation(task(access));
    expect(c.consultation.status).toBe('PENDING_EXPERT');
  });
  it('preview tidak mengubah KB; koreksi mengubah node dan hasil secara atomik', () => {
    const { advisor, access, store } = init();
    approveRoot(advisor, access);
    const c = advisor.createConsultation(task(access, { failures: 3 }));
    const before = store.version('kb');
    expect(advisor.preview(c.consultation.id, correction(c)).valid).toBe(true);
    expect(store.version('kb')).toBe(before);
    const next = advisor.correct(c.consultation.id, correction(c));
    expect(next.consultation.status).toBe('CORRECTED_APPROVED');
    expect(next.consultation.resolved?.profile.effort).toBe('high');
    expect(store.rules()).toHaveLength(2);
    expect(store.rules()[1].cornerstoneId).toBe(c.case.id);
  });
  it('false-child memakai cornerstone kesimpulan root, bukan node false', () => {
    const { advisor, access, store } = init();
    const root = approveRoot(advisor, access);
    const first = advisor.createConsultation(task(access, { failures: 3 }));
    advisor.correct(first.consultation.id, correction(first));
    const second = advisor.createConsultation(task(access, { failures: 1 }));
    expect(second.cornerstone?.id).toBe(root.case.id);
    const next = advisor.correct(second.consultation.id, correction(second, 1));
    expect(next.consultation.inference.trace.map((t) => t.branch)).toEqual([
      'true',
      'false',
      'true',
    ]);
    expect(store.rules()[1].falseChild).toBe(store.rules()[2].id);
  });
  it('regresi kasus disetujui di luar cornerstone diblok dan transaksi tidak mengubah data', () => {
    const { advisor, access, store } = init();
    approveRoot(advisor, access);
    const protectedCase = advisor.createConsultation(task(access, { failures: 2 }));
    advisor.approve(protectedCase.consultation.id, review(protectedCase));
    const c = advisor.createConsultation(task(access, { failures: 3 }));
    const before = store.version('kb');
    expect(() => advisor.correct(c.consultation.id, correction(c, 1))).toThrow(
      'kasus yang sudah disetujui',
    );
    expect(store.version('kb')).toBe(before);
    expect(store.rules()).toHaveLength(1);
    expect(advisor.detail(c.consultation.id).consultation.status).toBe('PENDING_EXPERT');
    advisor.correct(c.consultation.id, correction(c, 3));
    expect(store.rules()).toHaveLength(2);
  });
  it('menolak kondisi yang juga cocok dengan cornerstone dan kondisi tidak cocok kasus baru', () => {
    const { advisor, access, store } = init();
    approveRoot(advisor, access);
    const c = advisor.createConsultation(task(access, { failures: 3 }));
    expect(() => advisor.correct(c.consultation.id, correction(c, 0))).toThrow('kasus kunci');
    expect(() => advisor.correct(c.consultation.id, correction(c, 4))).toThrow('kasus baru');
    expect(store.rules()).toHaveLength(1);
  });
  it('koreksi stale ditolak dan refresh menyediakan trace terbaru', () => {
    const { advisor, access } = init();
    const pending = advisor.createConsultation(task(access, { failures: 3 }));
    approveRoot(advisor, access);
    expect(() => advisor.correct(pending.consultation.id, correction(pending))).toThrow('berubah');
    const fresh = advisor.refresh(pending.consultation.id);
    expect(fresh.cornerstone).not.toBeNull();
    advisor.correct(fresh.consultation.id, correction(fresh));
  });
  it('pakar dapat menyimpan dan memuat draft tanpa menambah rule', () => {
    const { advisor, access, store } = init();
    approveRoot(advisor, access);
    const c = advisor.createConsultation(task(access, { failures: 3 }));
    advisor.draft(c.consultation.id, correction(c));
    expect(advisor.getDraft(c.consultation.id).draft.profileId).toBe('demo-codex-deep-profile');
    expect(store.rules()).toHaveLength(1);
    expect(advisor.detail(c.consultation.id).consultation.status).toBe('CORRECTION_DRAFT');
  });
  it('akses belum dikonfirmasi menghasilkan NEEDS_INFORMATION dan tidak dapat disetujui', () => {
    const { advisor, access } = init();
    const { id: accessId, createdAt, ...input } = access;
    const unknown = advisor.createAccess({ ...input, name: 'Unknown', confirmed: false });
    const c = advisor.createConsultation(task(unknown));
    expect(c.consultation.status).toBe('NEEDS_INFORMATION');
    expect(() => advisor.approve(c.consultation.id, review(c))).toThrow('Konfirmasi');
  });
  it('koreksi ke model di luar akses ditolak', () => {
    const { advisor, access } = init();
    approveRoot(advisor, access);
    const c = advisor.createConsultation(task(access, { failures: 3 }));
    expect(() =>
      advisor.correct(c.consultation.id, {
        ...correction(c),
        profileId: 'demo-claude-code-deep-profile',
      }),
    ).toThrow('akses');
  });
  it('mendukung Claude Code saja maupun kedua layanan dengan default utama eksplisit', () => {
    const { advisor } = init();
    for (const both of [false, true]) {
      const access = advisor.createAccess({
        name: 'Claude',
        services: both ? ['codex', 'claude-code'] : ['claude-code'],
        primaryService: 'claude-code',
        packageName: 'DEMO',
        modelIds: ['demo-claude-code-basic'],
        confirmed: true,
        priority: 'quality',
      });
      const c = advisor.createConsultation(task(access));
      expect(c.consultation.resolved?.model.service).toBe('claude-code');
    }
  });
  it('katalog stale, effort tidak didukung, dan default lintas layanan ditolak', () => {
    const { advisor, store } = init();
    const c = store.catalog();
    c.profiles[0].effort = 'ultra';
    expect(() => advisor.updateCatalog(c)).toThrow('Effort');
    const d = store.catalog();
    d.defaults.codex = 'demo-claude-code-basic-profile';
    expect(() => advisor.updateCatalog(d)).toThrow('layanan yang sama');
    const valid = store.catalog();
    advisor.updateCatalog(valid);
    expect(() => advisor.updateCatalog(valid)).toThrow('berubah');
  });
  it('model nonaktif tidak bisa difinalkan dan hasil historis tetap utuh', () => {
    const { advisor, access, store } = init();
    const final = approveRoot(advisor, access);
    const c = advisor.createConsultation(task(access));
    const cat = store.catalog();
    cat.models[0].active = false;
    advisor.updateCatalog(cat);
    const fresh = advisor.refresh(c.consultation.id);
    expect(fresh.consultation.issues.length).toBeGreaterThan(0);
    expect(() => advisor.approve(fresh.consultation.id, review(fresh))).toThrow('tidak aktif');
    expect(advisor.detail(final.consultation.id).consultation.resolved?.model.active).toBe(true);
  });
  it('effort yang dihapus dari model memblok hasil aturan lama', () => {
    const { advisor, access, store } = init();
    approveRoot(advisor, access);
    const c = advisor.createConsultation(task(access, { failures: 3 }));
    advisor.correct(c.consultation.id, correction(c));
    const cat = store.catalog();
    cat.models.find((m) => m.id === 'demo-codex-deep')!.efforts = ['default'];
    cat.profiles.find((p) => p.id === 'demo-codex-deep-profile')!.effort = 'default';
    advisor.updateCatalog(cat);
    const next = advisor.createConsultation(task(access, { failures: 4 }));
    expect(next.consultation.issues.join(' ')).toContain('Effort');
    expect(() => advisor.approve(next.consultation.id, review(next))).toThrow('Effort');
  });
  it('task macet dapat dilanjutkan tanpa menimpa snapshot lama', () => {
    const { advisor, access } = init();
    const c = advisor.createConsultation(task(access));
    const next = advisor.createConsultation({
      ...task(access, { taskStatus: 'stuck', failures: 2 }),
      taskId: c.case.taskId,
    });
    expect(next.case.taskId).toBe(c.case.taskId);
    expect(next.case.id).not.toBe(c.case.id);
    expect(advisor.detail(c.consultation.id).case.attributes.failures).toBe(0);
    expect(advisor.taskDetail(c.case.taskId).consultations).toHaveLength(2);
  });
  it('hasil final immutable dan informasi tambahan dicatat sebagai review', () => {
    const { advisor, access } = init();
    const final = approveRoot(advisor, access);
    expect(() => advisor.refresh(final.consultation.id)).toThrow('final');
    const c = advisor.createConsultation(task(access));
    const next = advisor.information(c.consultation.id, review(c));
    expect(next.consultation.status).toBe('NEEDS_INFORMATION');
    expect(next.reviews.length).toBe(1);
  });
  it('outcome memisahkan unknown dari nol dan biaya memerlukan mata uang', () => {
    const { advisor, access } = init();
    const c = advisor.createConsultation(task(access));
    const outcome = {
      success: 'unknown',
      evidence: 'Belum diuji',
      durationMinutes: null,
      attempts: 0,
      tokens: null,
      apiCost: null,
      currency: null,
      subscriptionUsage: null,
    };
    const saved = advisor.outcome(c.case.taskId, outcome);
    expect(saved.tokens).toBeNull();
    expect(saved.attempts).toBe(0);
    expect(() => advisor.outcome(c.case.taskId, { ...outcome, apiCost: 10 })).toThrow();
  });
  it('model nyata memerlukan provenance dan ID/atribut tak sah ditolak', () => {
    const { advisor, store, access } = init();
    const cat = store.catalog();
    cat.models[0].demo = false;
    expect(() => advisor.updateCatalog(cat)).toThrow();
    expect(() =>
      advisor.createConsultation({
        ...task(access),
        attributes: { ...task(access).attributes, failures: -1 },
      }),
    ).toThrow();
    expect(() => advisor.createAccess({ ...access, primaryService: 'claude-code' })).toThrow();
  });
});
describe('Persistensi', () => {
  it('restart mempertahankan rule, cornerstone, trace dan hasil tanpa reseed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'devpilot-test-'));
    const file = join(dir, 'test.sqlite');
    try {
      let store = new Store(file);
      let advisor = new Advisor(store);
      const access = advisor.createAccess({
        name: 'Persistent',
        services: ['codex'],
        primaryService: 'codex',
        packageName: 'DEMO',
        modelIds: ['demo-codex-basic', 'demo-codex-deep'],
        confirmed: true,
        priority: 'balanced',
      });
      approveRoot(advisor, access);
      const c = advisor.createConsultation(task(access, { failures: 3 }));
      const final = advisor.correct(c.consultation.id, correction(c));
      store.close();
      store = new Store(file);
      advisor = new Advisor(store);
      expect(store.rules()).toHaveLength(2);
      expect(advisor.detail(c.consultation.id)).toEqual(final);
      store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
