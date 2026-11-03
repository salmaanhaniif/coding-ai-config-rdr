import { serviceLabels, type Catalog } from '../shared/domain.js';

export const VERIFIED_AT = '2026-11-03';
export const OPENAI_MODELS_SOURCE = 'https://learn.chatgpt.com/docs/models';
export const CLAUDE_MODELS_SOURCE = 'https://code.claude.com/docs/en/model-config';

export function realCatalog(): Catalog {
  const models: Catalog['models'] = [];
  for (const service of ['codex', 'chatgpt'] as const) {
    for (const [runtimeId, name] of [
      ['gpt-6-luna', 'GPT-6 Luna'],
      ['gpt-6.1-sol', 'GPT-6.1 Sol'],
      ['gpt-6-astra', 'GPT-6 Astra'],
    ]) {
      models.push({
        id: service === 'codex' ? runtimeId : 'chatgpt-' + runtimeId,
        runtimeId,
        name,
        service,
        efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
        thinkingModes: ['enabled'],
        active: true,
        demo: false,
        source: OPENAI_MODELS_SOURCE,
        verifiedAt: VERIFIED_AT,
      });
    }
  }
  for (const [runtimeId, name] of [
    ['claude-sonnet-5-5', 'Claude Sonnet 5.5'],
    ['claude-opus-5-5', 'Claude Opus 5.5'],
  ]) {
    models.push({
      id: runtimeId,
      runtimeId,
      name,
      service: 'claude-code',
      efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      thinkingModes: ['adaptive'],
      active: true,
      demo: false,
      source: CLAUDE_MODELS_SOURCE,
      verifiedAt: VERIFIED_AT,
    });
  }
  const profiles: Catalog['profiles'] = [];
  for (const service of ['codex', 'claude-code', 'chatgpt'] as const) {
    const standard = models.find((m) => m.service === service && /sol|sonnet/.test(m.id))!;
    const light = models.find((m) => m.service === service && /luna|sonnet/.test(m.id))!;
    const deep = models.find((m) => m.service === service && /astra|opus/.test(m.id))!;
    for (const [key, title, model, effort, mode, nextStep] of [
      [
        'standard',
        'Perubahan terarah',
        standard,
        'medium',
        'execution',
        'Kerjakan perubahan sesuai kriteria penerimaan, lalu jalankan pengujian relevan.',
      ],
      [
        'economy',
        'Task ringan dan hemat',
        light,
        'low',
        'execution',
        'Batasi perubahan pada bagian yang diminta. Periksa diff dan jalankan tes terkait.',
      ],
      [
        'investigate',
        'Debugging kompleks',
        standard,
        'high',
        'investigation',
        'Reproduksi masalah, telusuri alur antarmodul, uji hipotesis, lalu verifikasi perbaikan.',
      ],
      [
        'clarify',
        'Klarifikasi dan perencanaan',
        standard,
        'medium',
        'planning',
        'Tetapkan perilaku, batas perubahan, contoh input/output, dan kriteria penerimaan sebelum implementasi.',
      ],
      [
        'evidence',
        'Reproduksi dan bukti',
        standard,
        'medium',
        'investigation',
        'Kumpulkan reproduksi minimal, expected/actual, log, dan hasil percobaan sebelum patch berikutnya.',
      ],
      [
        'review',
        'Review dan risiko',
        standard,
        'high',
        'investigation',
        'Periksa diff, telusuri dampak dan edge case, lalu laporkan temuan beserta file serta cara membuktikannya.',
      ],
      [
        'tests',
        'Pengujian perilaku',
        standard,
        'medium',
        'execution',
        'Tulis tes perilaku yang gagal sebelum perbaikan dan lulus sesudahnya; jalankan tes serta periksa regresi.',
      ],
      [
        'docs',
        'Dokumentasi terarah',
        light,
        'low',
        'execution',
        'Baca implementasi, perbarui dokumentasi dan contoh pemakaian, lalu periksa kebenaran contoh.',
      ],
      [
        'architecture',
        'Desain lintas modul',
        deep,
        'high',
        'planning',
        'Petakan dependensi, bandingkan alternatif, tetapkan kontrak modul dan rencana migrasi yang dapat diuji.',
      ],
      [
        'security',
        'Audit keamanan',
        deep,
        'high',
        'investigation',
        'Petakan aliran data dan batas kepercayaan, periksa kerentanan, lalu verifikasi temuan dengan tes yang aman.',
      ],
      [
        'quality',
        'Perubahan berisiko tinggi',
        deep,
        'high',
        'investigation',
        'Telusuri dampak, susun rencana perbaikan dan rollback, lalu buktikan hasil dengan tes regresi.',
      ],
      [
        'refactor',
        'Refactor bertahap',
        standard,
        'high',
        'planning',
        'Petakan perilaku yang harus dipertahankan, buat tes pengaman, lalu refactor bertahap dan periksa diff.',
      ],
    ] as const) {
      profiles.push({
        id: service + '-' + key,
        name: serviceLabels[service] + ' / ' + title,
        modelId: model.id,
        effort,
        thinking: service === 'claude-code' ? 'adaptive' : 'enabled',
        mode,
        skillIds: [],
        nextStep,
        context:
          'Tujuan, kriteria selesai, kode/diff relevan, batas perubahan, serta bukti error dan hasil tes jika ada.',
        reason: title + '; konfigurasi dipilih melalui aturan RDR berdasarkan karakteristik kasus.',
        reconsider:
          'Konsultasikan kembali jika bukti, cakupan, risiko, akses model, atau hasil pengujian berubah.',
        active: true,
      });
    }
  }
  return {
    version: 1,
    models,
    profiles,
    skills: [],
    defaults: {
      codex: 'codex-standard',
      'claude-code': 'claude-code-standard',
      chatgpt: 'chatgpt-standard',
    },
  };
}
