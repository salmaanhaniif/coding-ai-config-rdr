import { strict as assert } from 'node:assert';
import {
  services,
  serviceLabels,
  type AccessProfile,
  type CaseInput,
  type Predicate,
} from '../shared/domain.js';
import { configurationText } from '../shared/recommendation.js';
import { Advisor } from './service.js';
import { Store } from './store.js';
import { infer } from './rdr.js';
import { resolveConclusion } from './catalog.js';

export const KNOWLEDGE_DB = 'data/recommendations-2026-11-03.sqlite';
export const knowledgeNotice =
  'Basis pengetahuan awal berisi konfigurasi model nyata dan aturan kurasi untuk kasus acuan. Sumber memverifikasi dukungan produk; kesesuaian task belum diuji sebagai benchmark atau dinilai ahli independen.';
const eq = (field: Predicate['field'], value: string | number): Predicate => ({
  field,
  op: 'equals',
  value,
});
type Family = {
  key: string;
  title: string;
  attrs: Partial<CaseInput['attributes']>;
  terms: Predicate[];
  profile: string;
  planning?: boolean;
  reason: string;
};
export const knowledgeFamilies: Family[] = [
  {
    key: 'standard',
    title: 'Perbaiki validasi email pada satu fungsi',
    attrs: {},
    terms: [
      eq('taskType', 'bug'),
      eq('scope', 'function'),
      eq('clarity', 'clear'),
      eq('priority', 'balanced'),
      eq('impact', 'low'),
    ],
    profile: 'standard',
    reason:
      'Kebutuhan jelas dan perubahan terbatas; gunakan effort medium untuk implementasi terarah.',
  },
  {
    key: 'docs',
    title: 'Perbarui dokumentasi API berdasarkan kode',
    attrs: { taskType: 'docs', reproduction: 'na' },
    terms: [eq('taskType', 'docs')],
    profile: 'docs',
    planning: true,
    reason:
      'Dokumentasi berbasis kode memiliki target jelas; gunakan model yang efisien dengan effort low.',
  },
  {
    key: 'tests',
    title: 'Tulis pengujian perilaku validasi input',
    attrs: { taskType: 'tests' },
    terms: [eq('taskType', 'tests')],
    profile: 'tests',
    reason: 'Pengujian memerlukan kontrak perilaku dan hasil yang dapat diperiksa.',
  },
  {
    key: 'review',
    title: 'Review perubahan pada beberapa file',
    attrs: { taskType: 'review', scope: 'files' },
    terms: [eq('taskType', 'review')],
    profile: 'review',
    reason: 'Review memerlukan penelusuran dampak dan edge case; pilih effort high.',
  },
  {
    key: 'architecture',
    title: 'Rancang pembagian modul dan kontrak integrasi',
    attrs: { taskType: 'architecture', scope: 'modules', reproduction: 'na' },
    terms: [eq('taskType', 'architecture')],
    profile: 'architecture',
    planning: true,
    reason:
      'Keputusan arsitektur lintas modul memerlukan perbandingan alternatif dan rencana migrasi; pilih model penalaran mendalam.',
  },
  {
    key: 'security',
    title: 'Audit aliran autentikasi dan otorisasi',
    attrs: { taskType: 'security', scope: 'modules', impact: 'high' },
    terms: [eq('taskType', 'security')],
    profile: 'security',
    reason:
      'Audit keamanan memerlukan penelusuran batas kepercayaan serta bukti temuan, dengan effort high.',
  },
  {
    key: 'refactor',
    title: 'Refactor duplikasi pada beberapa file',
    attrs: { taskType: 'refactor', scope: 'files' },
    terms: [eq('taskType', 'refactor'), { field: 'scope', op: 'in', value: ['files', 'modules'] }],
    profile: 'refactor',
    reason:
      'Refactor melibatkan dependensi dan perilaku yang harus tetap; rencanakan perubahan bertahap dengan tes pengaman.',
  },
  {
    key: 'feature',
    title: 'Tambahkan filter data beserta integrasi UI',
    attrs: { taskType: 'feature', scope: 'files', reproduction: 'na' },
    terms: [eq('taskType', 'feature'), { field: 'scope', op: 'in', value: ['files', 'modules'] }],
    profile: 'standard',
    reason:
      'Fitur dengan kriteria jelas membutuhkan implementasi dan verifikasi pada file terkait.',
  },
  {
    key: 'complex',
    title: 'Telusuri bug sesi lintas modul',
    attrs: { scope: 'modules', familiarity: 'low' },
    terms: [eq('taskType', 'bug'), eq('scope', 'modules')],
    profile: 'investigate',
    reason:
      'Hubungan antarmodul dan kode yang belum dikenal membutuhkan investigasi; gunakan effort high.',
  },
  {
    key: 'risk',
    title: 'Perbaiki perhitungan transaksi berisiko tinggi',
    attrs: { scope: 'files', impact: 'high' },
    terms: [eq('taskType', 'bug'), eq('impact', 'high')],
    profile: 'quality',
    reason: 'Dampak kesalahan tinggi membutuhkan penelusuran, tes regresi, dan rencana rollback.',
  },
  {
    key: 'risk-modules',
    title: 'Perbaiki bug transaksi lintas modul berisiko tinggi',
    attrs: { scope: 'modules', impact: 'high' },
    terms: [eq('taskType', 'bug'), eq('impact', 'high')],
    profile: 'quality',
    reason:
      'Bug lintas modul dengan dampak tinggi membutuhkan penelusuran dan tes regresi dengan model yang lebih kuat.',
  },
  {
    key: 'quality',
    title: 'Analisis bug beberapa file dengan prioritas kualitas',
    attrs: { scope: 'files' },
    terms: [eq('taskType', 'bug'), eq('priority', 'quality')],
    profile: 'quality',
    reason:
      'Pengguna memprioritaskan kualitas pada perubahan beberapa file; pilih model penalaran lebih kuat dengan effort high.',
  },
  {
    key: 'economy',
    title: 'Perbaiki pesan validasi dengan prioritas hemat',
    attrs: {},
    terms: [
      eq('taskType', 'bug'),
      eq('scope', 'function'),
      eq('impact', 'low'),
      eq('clarity', 'clear'),
      eq('priority', 'economy'),
    ],
    profile: 'economy',
    reason:
      'Task kecil, jelas, dan berdampak rendah dapat memakai model lebih hemat dan effort low.',
  },
  {
    key: 'clarify',
    title: 'Klarifikasi perilaku sesi lintas modul yang belum jelas',
    attrs: { scope: 'modules', clarity: 'unclear' },
    terms: [eq('taskType', 'bug'), eq('clarity', 'unclear')],
    profile: 'clarify',
    planning: true,
    reason:
      'Belum ada target perilaku yang jelas. Tetapkan kriteria sebelum melanjutkan implementasi.',
  },
  {
    key: 'clarify-function',
    title: 'Klarifikasi perilaku fungsi yang belum ditentukan',
    attrs: { clarity: 'unclear' },
    terms: [eq('taskType', 'bug'), eq('clarity', 'unclear')],
    profile: 'clarify',
    planning: true,
    reason: 'Perubahan satu fungsi juga memerlukan target yang jelas sebelum implementasi.',
  },
  {
    key: 'feature-clarify',
    title: 'Tentukan perilaku filter fitur sebelum implementasi',
    attrs: { taskType: 'feature', scope: 'files', clarity: 'unclear', reproduction: 'na' },
    terms: [eq('taskType', 'feature'), eq('clarity', 'unclear')],
    profile: 'clarify',
    planning: true,
    reason:
      'Kebutuhan fitur belum jelas; pilih perencanaan dan contoh input/output sebelum mengedit kode.',
  },
  {
    key: 'evidence',
    title: 'Kumpulkan reproduksi setelah tiga perbaikan gagal',
    attrs: {
      scope: 'modules',
      taskStatus: 'stuck',
      failures: 3,
      reproduction: 'missing',
      symptoms: ['repeated', 'no-cause'],
    },
    terms: [
      eq('taskType', 'bug'),
      eq('taskStatus', 'stuck'),
      { field: 'failures', op: 'gte', value: 3 },
      eq('reproduction', 'missing'),
    ],
    profile: 'evidence',
    reason:
      'Percobaan berulang tanpa reproduksi membutuhkan bukti baru. Gunakan effort medium untuk pengumpulan konteks.',
  },
  {
    key: 'repeated',
    title: 'Investigasi ulang kegagalan meskipun reproduksi tersedia',
    attrs: { scope: 'modules', taskStatus: 'stuck', failures: 3, symptoms: ['tests-fail'] },
    terms: [
      eq('taskType', 'bug'),
      eq('taskStatus', 'stuck'),
      { field: 'failures', op: 'gte', value: 3 },
      eq('reproduction', 'available'),
    ],
    profile: 'quality',
    reason:
      'Reproduksi tersedia tetapi perbaikan gagal berulang; gunakan model lebih kuat untuk menguji ulang asumsi dan akar penyebab.',
  },
  {
    key: 'missing-tests',
    title: 'Siapkan tes pengaman sebelum menambah fitur',
    attrs: { taskType: 'feature', scope: 'files', reproduction: 'na', tests: 'missing' },
    terms: [eq('taskType', 'feature'), eq('tests', 'missing')],
    profile: 'tests',
    reason:
      'Fitur beberapa file tanpa tes membutuhkan pengujian perilaku sebagai langkah berikutnya.',
  },
  {
    key: 'deadline',
    title: 'Selesaikan perbaikan kecil dalam 15 menit',
    attrs: { timeLimit: 15 },
    terms: [
      eq('taskType', 'bug'),
      eq('scope', 'function'),
      eq('impact', 'low'),
      eq('clarity', 'clear'),
      { field: 'timeLimit', op: 'lte', value: 15 },
    ],
    profile: 'economy',
    reason:
      'Waktu pendek pada task terarah dan berdampak rendah mendukung model efisien dengan effort low.',
  },
];

export function buildKnowledge(store: Store) {
  if (
    store.rules().length !== 1 ||
    store.rules()[0].cornerstoneId ||
    store.list('consultations').length ||
    store.list('accesses').length
  )
    throw new Error(
      'Basis pengetahuan hanya dapat disiapkan pada database baru; data lama tidak ditimpa.',
    );
  const advisor = new Advisor(store);
  const catalog = store.catalog();
  assert.ok(catalog.models.every((m) => !m.demo));
  const entries: {
    key: string;
    consultationId: string;
    profileId: string;
    configuration: string;
    action: string;
  }[] = [];
  const contexts: {
    available: AccessProfile['services'];
    primary: AccessProfile['primaryService'];
  }[] = [
    { available: ['codex'], primary: 'codex' },
    { available: ['claude-code'], primary: 'claude-code' },
    { available: ['chatgpt'], primary: 'chatgpt' },
    { available: ['codex', 'claude-code'], primary: 'codex' },
    { available: ['codex', 'claude-code'], primary: 'claude-code' },
    { available: ['codex', 'chatgpt'], primary: 'codex' },
    { available: ['codex', 'chatgpt'], primary: 'chatgpt' },
  ];
  for (const ctx of contexts) {
    const contextKey = ctx.available.join('+') + '/' + ctx.primary;
    const accessByPriority = (priority: AccessProfile['priority']) =>
      advisor.createAccess(
        {
          name: 'Acuan ' + contextKey + ' · ' + priority,
          services: ctx.available,
          primaryService: ctx.primary,
          packageName: 'Akses contoh; konfirmasi ulang pada akun sendiri',
          modelIds: catalog.models
            .filter((m) => ctx.available.includes(m.service))
            .map((m) => m.id),
          confirmed: true,
          priority,
        },
        { reference: true },
      );
    const access = accessByPriority('balanced');
    const economyAccess = accessByPriority('economy');
    const qualityAccess = accessByPriority('quality');
    for (const f of knowledgeFamilies) {
      // This preference only authors initial cases. Runtime decisions are exclusively RDR inference.
      const preference: AccessProfile['services'] = f.planning
        ? ['claude-code', 'chatgpt', 'codex']
        : ['codex', 'claude-code', 'chatgpt'];
      const selectedService = preference.find((s) => ctx.available.includes(s))!;
      const profileId = selectedService + '-' + f.profile;
      const detail = advisor.createConsultation({
        accessId: (f.key === 'economy'
          ? economyAccess
          : f.key === 'quality'
            ? qualityAccess
            : access
        ).id,
        description: f.title + ' · ' + ctx.available.map((s) => serviceLabels[s]).join(' + '),
        acceptance:
          'Kriteria perilaku dipenuhi, perubahan sesuai batas task, dan bukti verifikasi relevan tersedia.',
        attributes: {
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
          ...f.attrs,
        },
      });
      const review = {
        kbVersion: detail.consultation.kbVersion,
        catalogVersion: detail.consultation.catalogVersion,
        reason:
          'Kurasi basis pengetahuan awal: ' +
          f.reason +
          (ctx.available.length > 1
            ? ' Akses beberapa layanan: pilih layanan berdasarkan kebutuhan task, terlepas dari layanan utama.'
            : '') +
          ' Belum merupakan penilaian ahli independen.',
      };
      const routeService = f.key === 'standard' && entries.length > 0;
      const action =
        !routeService && detail.consultation.resolved?.profile.id === profileId
          ? 'approve'
          : 'correct';
      const final =
        action === 'approve'
          ? advisor.approve(detail.consultation.id, review)
          : advisor.correct(detail.consultation.id, {
              ...review,
              profileId,
              condition: {
                type: 'and',
                terms: [
                  ...services.map((s): Predicate => ({
                    field: 'services',
                    op: ctx.available.includes(s) ? 'contains' : 'not_contains',
                    value: s,
                  })),
                  eq('primaryService', ctx.primary),
                  ...(f.key === 'standard' ? [] : f.terms),
                ],
              },
            });
      entries.push({
        key: contextKey + ':' + f.key,
        consultationId: final.consultation.id,
        profileId,
        configuration: configurationText(final.consultation.resolved!),
        action,
      });
    }
  }
  for (const entry of entries) {
    const detail = advisor.detail(entry.consultationId);
    const result = resolveConclusion(
      infer(store.rules(), detail.case.facts).conclusion,
      detail.case.access,
      catalog,
    );
    assert.equal(result.resolved?.profile.id, entry.profileId, entry.key);
    assert.deepEqual(result.issues, [], entry.key);
  }
  const report = {
    notice: knowledgeNotice,
    createdAt: new Date().toISOString(),
    nodeCount: store.rules().length,
    caseCount: entries.length,
    entries,
  };
  store.event('knowledge.prepared', report);
  return report;
}
