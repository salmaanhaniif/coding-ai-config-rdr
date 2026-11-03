import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accessSchema, type AccessProfile } from '../shared/domain.js';
import { configurationText, setupInstructions } from '../shared/recommendation.js';
import { Store } from '../server/store.js';
import { Advisor } from '../server/service.js';
import { buildKnowledge, knowledgeFamilies } from '../server/knowledge.js';
import { profileSnapshot, resolveConclusion, validateCatalog } from '../server/catalog.js';
import { infer, evaluate } from '../server/rdr.js';
import { task } from './helpers.js';

describe('Katalog model nyata', () => {
  it('database baru tetap satu root; katalog berisi model, effort dan thinking terverifikasi', () => {
    const store = new Store(':memory:');
    try {
      expect(store.rules()).toHaveLength(1);
      const c = validateCatalog(store.catalog());
      expect(
        c.models.every((m) => !m.demo && m.verifiedAt && m.source.startsWith('https://')),
      ).toBe(true);
      expect(c.profiles.every((p) => p.effort !== 'default' && p.thinking)).toBe(true);
      const r = profileSnapshot(c, 'codex-investigate');
      expect(configurationText(r)).toBe(
        'Gunakan Codex, model GPT-6.1 Sol, effort high, mode thinking aktif.',
      );
      expect(setupInstructions(r).code).toBe(
        'codex --model gpt-6.1-sol -c \'model_reasoning_effort="high"\'',
      );
      expect(setupInstructions(profileSnapshot(c, 'claude-code-investigate')).code).toBe(
        'claude --model claude-sonnet-5-5 --effort high',
      );
      expect(setupInstructions(profileSnapshot(c, 'chatgpt-investigate')).text).toContain(
        'ChatGPT Work',
      );
    } finally {
      store.close();
    }
  });
  it('menolak thinking dan effort yang tidak didukung, serta mengizinkan tiga layanan', () => {
    const store = new Store(':memory:');
    try {
      const c = store.catalog();
      c.profiles[0].thinking = 'disabled';
      expect(() => validateCatalog(c)).toThrow('thinking');
      c.profiles[0].thinking = 'enabled';
      c.profiles[0].effort = 'default';
      expect(() => validateCatalog(c)).toThrow('Effort');
      expect(
        accessSchema.parse({
          name: 'Semua akses',
          services: ['codex', 'claude-code', 'chatgpt'],
          primaryService: 'chatgpt',
          modelIds: [],
          confirmed: false,
          priority: 'balanced',
        }).services,
      ).toHaveLength(3);
    } finally {
      store.close();
    }
  });
});

describe('Basis pengetahuan rekomendasi', () => {
  let store: Store;
  let advisor: Advisor;
  let report: ReturnType<typeof buildKnowledge>;
  beforeAll(() => {
    store = new Store(':memory:');
    advisor = new Advisor(store);
    report = buildKnowledge(store);
  });
  afterAll(() => store.close());
  const access = (
    available: AccessProfile['services'],
    primary: AccessProfile['primaryService'],
    priority: AccessProfile['priority'] = 'balanced',
  ) =>
    advisor.createAccess({
      name: 'Akses pengujian',
      services: available,
      primaryService: primary,
      packageName: 'Tersedia pada akun',
      modelIds: store
        .catalog()
        .models.filter((m) => available.includes(m.service))
        .map((m) => m.id),
      confirmed: true,
      priority,
    });
  it('membentuk aturan melalui koreksi sah dan mempertahankan semua kasus acuan', () => {
    expect(report.entries).toHaveLength(7 * knowledgeFamilies.length);
    expect(report.nodeCount).toBeGreaterThan(40);
    expect(advisor.overview().accesses).toEqual([]);
    expect(store.rules().some((n) => n.falseChild && n.trueChild)).toBe(true);
    for (const e of report.entries) {
      const d = advisor.detail(e.consultationId);
      const resolved = resolveConclusion(
        infer(store.rules(), d.case.facts).conclusion,
        d.case.access,
        store.catalog(),
      );
      expect(resolved.resolved?.profile.id, e.key).toBe(e.profileId);
      expect(resolved.issues, e.key).toEqual([]);
      expect(d.reviews).not.toHaveLength(0);
    }
    const before = store.rules().length;
    expect(() => buildKnowledge(store)).toThrow('data lama');
    expect(store.rules()).toHaveLength(before);
  });
  it.each(['codex', 'claude-code'] as const)(
    'dua layanan memilih berdasarkan task ketika utama %s',
    (primary) => {
      const a = access(['codex', 'claude-code'], primary);
      const implementation = advisor.createConsultation(task(a, { scope: 'modules' }));
      const planning = advisor.createConsultation(
        task(a, { taskType: 'architecture', scope: 'modules', reproduction: 'na' }),
      );
      expect(implementation.consultation.resolved?.profile.id).toBe('codex-investigate');
      expect(planning.consultation.resolved?.profile.id).toBe('claude-code-architecture');
      expect(implementation.consultation.issues).toEqual([]);
      expect(planning.consultation.issues).toEqual([]);
      expect(implementation.consultation.status).toBe('PENDING_EXPERT');
    },
  );
  it('memakai ChatGPT Work ketika hanya layanan itu yang tersedia', () => {
    const a = access(['chatgpt'], 'chatgpt');
    const d = advisor.createConsultation(task(a, { scope: 'modules' }));
    expect(d.consultation.resolved?.profile.id).toBe('chatgpt-investigate');
    expect(d.consultation.resolved?.model.runtimeId).toBe('gpt-6.1-sol');
    expect(d.consultation.issues).toEqual([]);
  });
  it('prioritas, risiko, waktu, dan bukti kegagalan mengubah hasil secara terpisah', () => {
    const balanced = access(['codex'], 'codex');
    const economy = access(['codex'], 'codex', 'economy');
    const quality = access(['codex'], 'codex', 'quality');
    const result = (a: AccessProfile, overrides: Parameters<typeof task>[1]) =>
      advisor.createConsultation(task(a, overrides)).consultation.resolved?.profile;
    expect(result(balanced, {})?.effort).toBe('medium');
    expect(result(economy, {})?.modelId).toBe('gpt-6-luna');
    expect(result(quality, { scope: 'files' })?.modelId).toBe('gpt-6-astra');
    expect(result(balanced, { scope: 'modules', impact: 'high' })?.modelId).toBe('gpt-6-astra');
    expect(result(balanced, { timeLimit: 10 })?.effort).toBe('low');
    expect(result(balanced, { clarity: 'unclear' })?.mode).toBe('planning');
    expect(
      result(balanced, {
        scope: 'modules',
        taskStatus: 'stuck',
        failures: 4,
        reproduction: 'missing',
        symptoms: ['no-cause'],
      })?.id,
    ).toBe('codex-evidence');
  });
  it('akses model terbatas atau belum dikonfirmasi memblokir hasil yang tidak dapat dipakai', () => {
    const a = advisor.createAccess({
      name: 'Luna saja',
      services: ['codex'],
      primaryService: 'codex',
      modelIds: ['gpt-6-luna'],
      confirmed: true,
      priority: 'balanced',
    });
    const d = advisor.createConsultation(task(a, { scope: 'modules' }));
    expect(d.consultation.status).toBe('NEEDS_INFORMATION');
    expect(d.consultation.issues.join(' ')).toContain('akses');
  });
  it('not_contains tidak menganggap layanan unknown sebagai ketiadaan akses', () => {
    const d = advisor.detail(report.entries[0].consultationId);
    expect(
      evaluate(
        { type: 'and', terms: [{ field: 'services', op: 'not_contains', value: 'claude-code' }] },
        d.case.facts,
      ),
    ).toBe(true);
    expect(
      evaluate(
        { type: 'and', terms: [{ field: 'services', op: 'not_contains', value: 'claude-code' }] },
        { ...d.case.facts, services: null },
      ),
    ).toBe(false);
  });
});
