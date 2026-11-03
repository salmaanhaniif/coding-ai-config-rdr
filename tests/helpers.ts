import { Advisor } from '../server/service.js';
import { Store } from '../server/store.js';
import { demoCatalog } from '../server/catalog.js';
import type { AccessProfile, CaseInput, ConsultationDetail } from '../shared/domain.js';
export function setup() {
  const store = new Store(':memory:', { catalog: demoCatalog() });
  const advisor = new Advisor(store);
  const access = advisor.createAccess({
    name: 'Test',
    services: ['codex'],
    primaryService: 'codex',
    packageName: 'DEMO',
    modelIds: ['demo-codex-basic', 'demo-codex-deep'],
    confirmed: true,
    priority: 'balanced',
  });
  return { store, advisor, access };
}
export function task(
  access: AccessProfile,
  overrides: Partial<CaseInput['attributes']> = {},
): CaseInput {
  return {
    accessId: access.id,
    description: 'Perbaiki task pengujian',
    acceptance: 'Pengujian relevan lulus',
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
      ...overrides,
    },
  };
}
export function review(c: ConsultationDetail) {
  return {
    kbVersion: c.consultation.kbVersion,
    catalogVersion: c.consultation.catalogVersion,
    reason: 'Penilaian pakar untuk pengujian.',
  };
}
export function approveRoot(advisor: Advisor, access: AccessProfile) {
  const c = advisor.createConsultation(task(access));
  return advisor.approve(c.consultation.id, review(c));
}
