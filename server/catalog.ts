import {
  catalogSchema,
  type AccessProfile,
  type Catalog,
  type Conclusion,
  type Resolved,
} from '../shared/domain.js';
import { demand } from './errors.js';
export function demoCatalog(): Catalog {
  const models: Catalog['models'] = [];
  const profiles: Catalog['profiles'] = [];
  for (const service of ['codex', 'claude-code'] as const)
    for (const tier of ['basic', 'deep'] as const) {
      const modelId = 'demo-' + service + '-' + tier;
      models.push({
        id: modelId,
        name:
          'DEMO ' +
          (service === 'codex' ? 'Codex' : 'Claude Code') +
          ' ' +
          (tier === 'basic' ? 'Basic' : 'Deep'),
        service,
        efforts: tier === 'basic' ? ['default', 'medium'] : ['default', 'medium', 'high'],
        active: true,
        demo: true,
        source: 'Data sintetis untuk demonstrasi; bukan kemampuan model nyata.',
        verifiedAt: null,
      });
      profiles.push({
        id: modelId + '-profile',
        name: 'DEMO ' + service + ' / ' + (tier === 'basic' ? 'Perubahan terarah' : 'Investigasi'),
        modelId,
        effort: tier === 'basic' ? 'default' : 'high',
        mode: tier === 'basic' ? 'execution' : 'investigation',
        skillIds: tier === 'basic' ? [] : ['demo-debug'],
        nextStep:
          tier === 'basic'
            ? 'Kerjakan satu perubahan terarah dan jalankan pengujian relevan.'
            : 'Reproduksi masalah, periksa bukti, lalu uji satu hipotesis sebelum membuat perbaikan.',
        context: 'Tujuan, kriteria penerimaan, file relevan, dan bukti error bila ada.',
        reason:
          tier === 'basic'
            ? 'Profil dasar untuk kasus yang disetujui pakar.'
            : 'Profil investigasi yang dapat dipilih pakar saat koreksi.',
        reconsider:
          'Konsultasikan kembali jika hasil tidak memenuhi kriteria atau bukti baru mengubah pendekatan.',
        active: true,
      });
    }
  return {
    version: 1,
    models,
    profiles,
    skills: [
      {
        id: 'demo-debug',
        name: 'DEMO Debugging Terarah',
        description: 'Prosedur sintetis: reproduksi, hipotesis, perbaikan, verifikasi.',
        services: ['codex', 'claude-code'],
        active: true,
        demo: true,
        source: 'Workflow demonstrasi lokal, tidak dipasang pada coding agent.',
        verifiedAt: null,
      },
    ],
    defaults: {
      codex: 'demo-codex-basic-profile',
      'claude-code': 'demo-claude-code-basic-profile',
    },
  };
}
export function validateCatalog(input: unknown): Catalog {
  const c = catalogSchema.parse(input);
  for (const group of [c.models, c.skills, c.profiles])
    demand(
      new Set(group.map((x) => x.id)).size === group.length,
      'CATALOG_INVALID',
      'ID katalog duplikat.',
    );
  for (const skill of c.skills)
    if (!skill.demo)
      demand(
        URL.canParse(skill.source) &&
          !!skill.verifiedAt &&
          !Number.isNaN(Date.parse(skill.verifiedAt)),
        'CATALOG_INVALID',
        'Skill nyata memerlukan sumber dan tanggal verifikasi.',
      );
  for (const p of c.profiles) {
    const model = c.models.find((m) => m.id === p.modelId);
    demand(model, 'CATALOG_INVALID', 'Model profil tidak ditemukan.');
    demand(model.efforts.includes(p.effort), 'CATALOG_INVALID', 'Effort profil tidak didukung.');
    for (const id of p.skillIds) {
      const skill = c.skills.find((s) => s.id === id);
      demand(
        skill && skill.services.includes(model.service),
        'CATALOG_INVALID',
        'Skill tidak kompatibel dengan profil.',
      );
    }
  }
  for (const service of ['codex', 'claude-code'] as const)
    if (c.defaults[service]) {
      const profile = c.profiles.find((p) => p.id === c.defaults[service]);
      const model = c.models.find((m) => m.id === profile?.modelId);
      demand(
        profile && model?.service === service,
        'CATALOG_INVALID',
        'Default harus merujuk profil untuk layanan yang sama.',
      );
    }
  return c;
}
export function profileSnapshot(c: Catalog, id: string): Resolved {
  const profile = c.profiles.find((p) => p.id === id);
  demand(profile, 'PROFILE_MISSING', 'Profil konfigurasi tidak ditemukan.');
  const model = c.models.find((m) => m.id === profile.modelId);
  demand(model, 'MODEL_MISSING', 'Model tidak ditemukan.');
  const skills = profile.skillIds.map((id) => {
    const s = c.skills.find((s) => s.id === id);
    demand(s, 'SKILL_MISSING', 'Skill tidak ditemukan.');
    return s;
  });
  return structuredClone({ profile, model, skills, catalogVersion: c.version });
}
export function configurationIssues(r: Resolved, access: AccessProfile, c: Catalog): string[] {
  const issues: string[] = [];
  const model = c.models.find((m) => m.id === r.model.id);
  const profile = c.profiles.find((p) => p.id === r.profile.id);
  if (!access.confirmed) issues.push('Konfirmasi akses model terlebih dahulu.');
  if (!access.services.includes(r.model.service) || !access.modelIds.includes(r.model.id))
    issues.push('Model hasil RDR tidak termasuk akses yang dikonfirmasi.');
  if (!model?.active || model.service !== r.model.service)
    issues.push('Model tidak aktif atau layanan berubah; perlu tinjauan pakar.');
  if (!profile?.active) issues.push('Profil konfigurasi tidak aktif.');
  if (!model?.efforts.includes(r.profile.effort))
    issues.push('Effort tidak didukung model saat ini.');
  for (const s of r.skills) {
    const current = c.skills.find((x) => x.id === s.id);
    if (!current?.active || !current.services.includes(r.model.service))
      issues.push('Skill tidak aktif atau tidak kompatibel: ' + s.name);
  }
  return issues;
}
export function resolveConclusion(
  raw: Conclusion,
  access: AccessProfile,
  c: Catalog,
): { resolved: Resolved | null; issues: string[] } {
  if (raw.kind === 'fixed') {
    const resolved = structuredClone(raw.snapshot);
    return { resolved, issues: configurationIssues(resolved, access, c) };
  }
  const id = c.defaults[access.primaryService];
  if (!id)
    return { resolved: null, issues: ['Pemetaan default untuk layanan utama belum tersedia.'] };
  const resolved = profileSnapshot(c, id);
  return { resolved, issues: configurationIssues(resolved, access, c) };
}
