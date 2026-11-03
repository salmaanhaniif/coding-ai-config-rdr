import { strict as assert } from 'node:assert';
import type {
  AccessProfile,
  CaseInput,
  ConsultationDetail,
  CorrectionInput,
  Predicate,
} from '../../shared/domain.js';
import { Advisor } from '../service.js';
import { Store } from '../store.js';
import { AppError } from '../errors.js';
import { evaluate, infer } from '../rdr.js';

export const DEMO_EXPERT_DB = 'data/expert-demo.sqlite';
export const simulationNotice =
  'SIMULASI PAKAR: keputusan untuk demonstrasi RDR, bukan validasi ahli independen atau benchmark model nyata.';
export const demoProfiles = {
  codexBasic: 'demo-codex-basic-profile',
  codexDeep: 'demo-codex-deep-profile',
  claudeBasic: 'demo-claude-code-basic-profile',
  claudeDeep: 'demo-claude-code-deep-profile',
  codexClarify: 'demo-codex-clarify-profile',
  claudeClarify: 'demo-claude-code-clarify-profile',
  codexEvidence: 'demo-codex-evidence-profile',
  claudeEvidence: 'demo-claude-code-evidence-profile',
} as const;

type CaseSpec = {
  key: string;
  description: string;
  acceptance: string;
  access: 'codex' | 'claude' | 'both';
  attrs: Partial<CaseInput['attributes']>;
  decision: 'approve' | 'correct';
  reason: string;
  expectedProfile: string;
  expectedRule: string;
  condition?: CorrectionInput['condition'];
};
export const expertCases: CaseSpec[] = [
  {
    key: 'K0',
    description: '[SIMULASI K0] Perbaiki validasi field email pada satu fungsi login.',
    acceptance:
      'Email tidak valid ditolak; email valid tetap diterima; tes validasi terkait lulus.',
    access: 'codex',
    attrs: {},
    decision: 'approve',
    expectedProfile: demoProfiles.codexBasic,
    expectedRule: 'R0',
    reason:
      'Perubahan terbatas pada satu fungsi, kebutuhan jelas, dan tes tersedia. Konfigurasi dasar cukup sebagai rekomendasi awal untuk kasus ini. Setujui sebagai kasus kunci root, tanpa menambah aturan.',
  },
  {
    key: 'K1',
    description:
      '[SIMULASI K1] Telusuri bug sesi login yang melibatkan middleware, API, dan penyimpanan sesi.',
    acceptance:
      'Penyebab interaksi antarmodul teridentifikasi; perbaikan terarah lulus tes sesi terkait.',
    access: 'codex',
    attrs: { scope: 'modules', familiarity: 'low', impact: 'high' },
    decision: 'correct',
    expectedProfile: demoProfiles.codexDeep,
    expectedRule: 'R1',
    condition: { type: 'and', terms: [{ field: 'scope', op: 'equals', value: 'modules' }] },
    reason:
      'Kesimpulan dasar belum memadai untuk investigasi hubungan antarmodul. Pilih profil DEMO Codex Deep dengan effort high untuk menelusuri alur dan menguji hipotesis. Cakupan lintas modul membedakan kasus ini dari kasus kunci root yang hanya satu fungsi.',
  },
  {
    key: 'K1b',
    description:
      '[SIMULASI K1b] Sesuaikan pesan validasi satu field dengan kebutuhan sebagian jelas.',
    acceptance:
      'Perilaku validasi yang sudah ditentukan tetap benar dan bagian yang belum jelas dicatat.',
    access: 'codex',
    attrs: { clarity: 'partial' },
    decision: 'approve',
    expectedProfile: demoProfiles.codexBasic,
    expectedRule: 'R0',
    reason:
      'Untuk kasus simulasi ini, perubahan yang diketahui tetap terbatas dan dapat diverifikasi. Setujui konfigurasi dasar. Kasus ini akan dilindungi saat menguji aturan klarifikasi yang terlalu luas.',
  },
  {
    key: 'K2',
    description:
      '[SIMULASI K2] Tambah fitur filter pada satu fungsi, tetapi perilaku filter belum ditentukan.',
    acceptance:
      'Pilihan filter, aturan pencocokan, dan contoh hasil ditetapkan sebelum perubahan kode.',
    access: 'codex',
    attrs: { taskType: 'feature', clarity: 'unclear', reproduction: 'na' },
    decision: 'correct',
    expectedProfile: demoProfiles.codexClarify,
    expectedRule: 'R2',
    condition: { type: 'and', terms: [{ field: 'clarity', op: 'equals', value: 'unclear' }] },
    reason:
      'Kebutuhan belum jelas sehingga implementasi belum memiliki target yang dapat diperiksa. Gunakan profil klarifikasi dengan model DEMO Basic dan effort bawaan untuk menetapkan perilaku serta kriteria penerimaan. clarity=unclear membedakan kasus dari root dan tidak mengubah hasil kasus kebutuhan sebagian jelas yang sudah disetujui.',
  },
  {
    key: 'K3',
    description: '[SIMULASI K3] Investigasi bug sesi lintas modul dengan akses Claude Code saja.',
    acceptance:
      'Investigasi dan perbaikan dapat dikerjakan memakai model yang benar-benar termasuk akses kasus.',
    access: 'claude',
    attrs: { scope: 'modules', familiarity: 'low', impact: 'high' },
    decision: 'correct',
    expectedProfile: demoProfiles.claudeDeep,
    expectedRule: 'R3',
    condition: {
      type: 'and',
      terms: [{ field: 'primaryService', op: 'equals', value: 'claude-code' }],
    },
    reason:
      'R1 memberi profil Codex yang tidak tersedia pada akses kasus ini. Ganti seluruh paket menjadi investigasi DEMO Claude Code Deep dengan effort high. Layanan utama Claude Code membedakan kasus ini dari cornerstone R1 yang memakai Codex.',
  },
  {
    key: 'K4',
    description:
      '[SIMULASI K4] Perbaikan bug lintas modul gagal tiga kali dan belum ada reproduksi yang stabil.',
    acceptance:
      'Langkah reproduksi minimal, hasil yang diharapkan, hasil aktual, dan log relevan tersedia sebelum patch berikutnya.',
    access: 'codex',
    attrs: {
      scope: 'modules',
      taskStatus: 'stuck',
      failures: 3,
      reproduction: 'missing',
      symptoms: ['repeated', 'no-cause'],
      currentModelId: 'demo-codex-deep',
      currentEffort: 'high',
    },
    decision: 'correct',
    expectedProfile: demoProfiles.codexEvidence,
    expectedRule: 'R4',
    condition: {
      type: 'and',
      terms: [
        { field: 'failures', op: 'gte', value: 3 },
        { field: 'reproduction', op: 'equals', value: 'missing' },
      ],
    },
    reason:
      'Tiga percobaan belum menghasilkan kemajuan dan reproduksi belum tersedia. Langkah berikutnya adalah mengumpulkan bukti, bukan otomatis menaikkan effort. Gunakan DEMO Codex Basic dengan effort bawaan untuk menyusun reproduksi dan log. Gabungan dua kondisi membedakan kasus baru dari cornerstone R1.',
  },
  {
    key: 'K5',
    description:
      '[SIMULASI K5] Bug lintas modul memiliki reproduksi, tetapi belum pernah dicoba diperbaiki.',
    acceptance: 'Jalur RDR kembali ke profil investigasi lintas modul, bukan pengumpulan bukti.',
    access: 'codex',
    attrs: { scope: 'modules', familiarity: 'low' },
    decision: 'approve',
    expectedProfile: demoProfiles.codexDeep,
    expectedRule: 'R1',
    reason:
      'Bukti tersedia dan belum ada kegagalan berulang. R3 serta R4 salah, sehingga kesimpulan terakhir yang berlaku tetap R1. Setujui investigasi tanpa menambah node.',
  },
  {
    key: 'K6',
    description: '[SIMULASI K6] Refactor nama variabel pada satu fungsi dengan akses Claude Code.',
    acceptance:
      'Perilaku tetap sama, tes terkait lulus, dan profil dasar memakai layanan Claude Code.',
    access: 'claude',
    attrs: { taskType: 'refactor' },
    decision: 'approve',
    expectedProfile: demoProfiles.claudeBasic,
    expectedRule: 'R0',
    reason:
      'R1 dan R2 tidak cocok. Kesimpulan root dipetakan secara eksplisit ke profil dasar layanan utama Claude Code. Setujui tanpa membuat aturan tambahan.',
  },
  {
    key: 'K7',
    description:
      '[SIMULASI K7] Investigasi lintas modul dengan kedua layanan; Claude Code dipilih sebagai layanan utama.',
    acceptance: 'Konfigurasi sesuai layanan utama dan model yang dikonfirmasi tersedia.',
    access: 'both',
    attrs: { scope: 'modules', familiarity: 'low' },
    decision: 'approve',
    expectedProfile: demoProfiles.claudeDeep,
    expectedRule: 'R3',
    reason:
      'Kedua layanan tersedia, tetapi layanan utama kasus ini Claude Code. R3 cocok dan profil investigasi tersebut termasuk akses. Setujui; kepemilikan dua layanan tidak otomatis mengharuskan pemakaian keduanya.',
  },
  {
    key: 'K8',
    description:
      '[SIMULASI K8] Fitur satu fungsi dengan kebutuhan belum jelas, menggunakan pola kasus baru.',
    acceptance: 'R2 digunakan ulang untuk klarifikasi tanpa penambahan aturan.',
    access: 'codex',
    attrs: { taskType: 'feature', clarity: 'unclear', reproduction: 'na' },
    decision: 'approve',
    expectedProfile: demoProfiles.codexClarify,
    expectedRule: 'R2',
    reason:
      'Kasus baru memenuhi kondisi R2. Profil klarifikasi masih sesuai; pengetahuan yang sudah ada dapat dipakai kembali tanpa node baru.',
  },
];

export type DemoEntry = {
  key: string;
  consultationId: string;
  caseId: string;
  taskId: string;
  decision: 'approve' | 'correct';
  beforeStatus: string;
  beforeRule: string;
  afterRule: string;
  cornerstoneBefore: string | null;
  condition: CorrectionInput['condition'] | null;
  reason: string;
  profileId: string;
  model: string;
  effort: string;
  mode: string;
  trace: { rule: string; matched: boolean; branch: 'true' | 'false' }[];
  nodeCount: number;
  protectedCount: number | null;
};
export type RejectedDemo = {
  caseKey: string;
  code: string;
  condition: CorrectionInput['condition'];
  reason: string;
};
export type ExpertDemoReport = {
  notice: string;
  createdAt: string;
  initialNodeCount: number;
  finalNodeCount: number;
  kbVersion: number;
  entries: DemoEntry[];
  rejected: RejectedDemo[];
  nodeLabels: Record<string, string>;
  accessIds: Record<string, string>;
};

function requirePristine(store: Store) {
  const nodes = store.rules();
  if (
    nodes.length !== 1 ||
    nodes[0].id !== 'root' ||
    nodes[0].cornerstoneId ||
    nodes[0].trueChild ||
    nodes[0].falseChild ||
    store.list('consultations').length ||
    store.list('accesses').length ||
    store.list('tasks').length
  )
    throw new AppError(
      'DEMO_NOT_EMPTY',
      'Skenario hanya boleh dijalankan pada database baru yang belum dipakai.',
      409,
    );
  const catalog = store.catalog();
  const ids = [
    'demo-codex-basic',
    'demo-codex-deep',
    'demo-claude-code-basic',
    'demo-claude-code-deep',
  ];
  if (catalog.version !== 1 || ids.some((id) => !catalog.models.some((m) => m.id === id && m.demo)))
    throw new AppError(
      'DEMO_CATALOG_CHANGED',
      'Gunakan database baru dengan katalog DEMO awal.',
      409,
    );
}

export function buildExpertDemo(store: Store): ExpertDemoReport {
  requirePristine(store);
  const advisor = new Advisor(store);
  const catalog = store.catalog();
  for (const service of ['codex', 'claude-code'] as const) {
    const base = catalog.profiles.find((p) => p.id === 'demo-' + service + '-basic-profile')!;
    catalog.profiles.push({
      ...base,
      id: 'demo-' + service + '-clarify-profile',
      name: 'DEMO ' + service + ' / Klarifikasi kebutuhan',
      mode: 'planning',
      nextStep:
        'Tentukan perilaku yang diinginkan, batas task, dan contoh kriteria penerimaan sebelum mengubah kode.',
      context:
        'Permintaan fitur, contoh input/output, batas perubahan, dan hal yang belum disepakati.',
      reason: 'Kebutuhan belum jelas; tetapkan target yang dapat diuji terlebih dahulu.',
      reconsider: 'Setelah kebutuhan jelas, konsultasikan lagi sebelum implementasi.',
    });
    catalog.profiles.push({
      ...base,
      id: 'demo-' + service + '-evidence-profile',
      name: 'DEMO ' + service + ' / Kumpulkan bukti',
      mode: 'investigation',
      skillIds: ['demo-debug'],
      nextStep:
        'Buat reproduksi minimal, catat expected/actual, dan kumpulkan log relevan sebelum meminta patch berikutnya.',
      context:
        'Riwayat percobaan gagal, langkah reproduksi, pesan error, dan cuplikan kode relevan.',
      reason: 'Percobaan berulang tanpa bukti memadai membutuhkan pengumpulan konteks.',
      reconsider:
        'Jika reproduksi dan log sudah tersedia, evaluasi ulang konfigurasi untuk perbaikan.',
    });
  }
  advisor.updateCatalog(catalog);
  const createAccess = (key: 'codex' | 'claude' | 'both'): AccessProfile => {
    const available =
      key === 'codex'
        ? (['codex'] as const)
        : key === 'claude'
          ? (['claude-code'] as const)
          : (['codex', 'claude-code'] as const);
    return advisor.createAccess({
      name: 'SIMULASI — ' + (key === 'both' ? 'Kedua layanan, utama Claude Code' : key),
      services: [...available],
      primaryService: key === 'codex' ? 'codex' : 'claude-code',
      packageName: 'SIMULASI lokal, bukan akun subscription nyata',
      modelIds: catalog.models
        .filter((m) => available.some((s) => s === m.service))
        .map((m) => m.id),
      confirmed: true,
      priority: 'balanced',
    });
  };
  const access = {
    codex: createAccess('codex'),
    claude: createAccess('claude'),
    both: createAccess('both'),
  };
  const entries: DemoEntry[] = [];
  const rejected: RejectedDemo[] = [];
  const nodeLabels: Record<string, string> = { root: 'R0' };
  const caseLabels = new Map<string, string>();
  const review = (detail: ConsultationDetail, reason: string) => ({
    kbVersion: detail.consultation.kbVersion,
    catalogVersion: detail.consultation.catalogVersion,
    reason,
  });
  const reject = (
    spec: CaseSpec,
    detail: ConsultationDetail,
    terms: Predicate[],
    expectedCode: string,
    why: string,
  ) => {
    const condition: CorrectionInput['condition'] = { type: 'and', terms };
    const version = store.version('kb');
    const count = store.rules().length;
    try {
      advisor.preview(detail.consultation.id, {
        ...review(detail, '[SIMULASI DITOLAK] ' + why),
        profileId: spec.expectedProfile,
        condition,
      });
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== expectedCode) throw error;
      assert.equal(store.version('kb'), version);
      assert.equal(store.rules().length, count);
      rejected.push({ caseKey: spec.key, code: error.code, condition, reason: why });
      return;
    }
    throw new Error('Skenario seharusnya menolak ' + expectedCode);
  };
  let initialTaskId: string | undefined;
  for (const spec of expertCases) {
    const attrs: CaseInput['attributes'] = {
      taskStatus: 'start',
      taskType: 'bug',
      clarity: 'clear',
      scope: 'function',
      familiarity: 'medium',
      impact: 'low',
      reproduction: 'available',
      tests: 'available',
      failures: 0,
      timeLimit: null,
      symptoms: [],
      currentModelId: null,
      currentEffort: null,
      ...spec.attrs,
    };
    const detail = advisor.createConsultation({
      accessId: access[spec.access].id,
      description: spec.description,
      acceptance: spec.acceptance,
      attributes: attrs,
      ...(spec.key === 'K4' ? { taskId: initialTaskId } : {}),
    });
    if (spec.key === 'K1') initialTaskId = detail.case.taskId;
    const reason = '[SIMULASI PAKAR ' + spec.key + '] ' + spec.reason;
    let final: ConsultationDetail;
    let protectedCount: number | null = null;
    if (spec.decision === 'correct') {
      assert.ok(spec.condition);
      if (spec.key === 'K1') {
        reject(
          spec,
          detail,
          [{ field: 'failures', op: 'gte', value: 10 }],
          'NOT_MATCHING',
          'Kondisi tidak dipenuhi kasus baru.',
        );
        reject(
          spec,
          detail,
          [{ field: 'failures', op: 'gte', value: 0 }],
          'NOT_DISTINGUISHING',
          'Kondisi juga dipenuhi cornerstone root.',
        );
      }
      if (spec.key === 'K2')
        reject(
          spec,
          detail,
          [{ field: 'clarity', op: 'not_equals', value: 'clear' }],
          'REGRESSION',
          'Kondisi terlalu luas dan mengubah hasil K1b yang sudah disetujui; gunakan clarity=unclear.',
        );
      const input: CorrectionInput = {
        ...review(detail, reason),
        profileId: spec.expectedProfile,
        condition: spec.condition,
      };
      const preview = advisor.preview(detail.consultation.id, input);
      protectedCount = preview.protectedCount;
      assert.ok(detail.cornerstone);
      assert.equal(evaluate(spec.condition, detail.case.facts), true);
      assert.equal(evaluate(spec.condition, detail.cornerstone.facts), false);
      final = advisor.correct(detail.consultation.id, input);
      nodeLabels[final.consultation.inference.lastMatchedNode] = spec.expectedRule;
    } else final = advisor.approve(detail.consultation.id, review(detail, reason));
    assert.equal(
      final.consultation.resolved?.profile.id,
      spec.expectedProfile,
      'Profil akhir ' + spec.key,
    );
    assert.equal(
      nodeLabels[final.consultation.inference.lastMatchedNode],
      spec.expectedRule,
      'Rule akhir ' + spec.key,
    );
    entries.push({
      key: spec.key,
      consultationId: final.consultation.id,
      caseId: final.case.id,
      taskId: final.case.taskId,
      decision: spec.decision,
      beforeStatus: detail.consultation.status,
      beforeRule: nodeLabels[detail.consultation.inference.lastMatchedNode],
      afterRule: spec.expectedRule,
      cornerstoneBefore: detail.cornerstone
        ? (caseLabels.get(detail.cornerstone.id) ?? null)
        : null,
      condition: spec.condition ?? null,
      reason,
      profileId: spec.expectedProfile,
      model: final.consultation.resolved!.model.name,
      effort: final.consultation.resolved!.profile.effort,
      mode: final.consultation.resolved!.profile.mode,
      trace: final.consultation.inference.trace.map((t) => ({
        rule: nodeLabels[t.nodeId],
        matched: t.matched,
        branch: t.branch,
      })),
      nodeCount: store.rules().length,
      protectedCount,
    });
    caseLabels.set(final.case.id, spec.key);
  }
  for (const entry of entries) {
    const detail = advisor.detail(entry.consultationId);
    const result = infer(store.rules(), detail.case.facts);
    assert.equal(nodeLabels[result.lastMatchedNode], entry.afterRule, 'Regresi akhir ' + entry.key);
  }
  assert.equal(store.rules().length, 5);
  const report: ExpertDemoReport = {
    notice: simulationNotice,
    createdAt: new Date().toISOString(),
    initialNodeCount: 1,
    finalNodeCount: 5,
    kbVersion: store.version('kb'),
    entries,
    rejected,
    nodeLabels,
    accessIds: Object.fromEntries(Object.entries(access).map(([k, v]) => [k, v.id])),
  };
  store.event('demo.expert.completed', report);
  return report;
}
