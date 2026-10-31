import { beforeEach, afterEach, it, expect } from 'vitest';
import { Store } from '../server/store.js';
import { createApp } from '../server/app.js';
import type { FastifyInstance } from 'fastify';
import { task } from './helpers.js';
import type { AccessProfile, ConsultationDetail } from '../shared/domain.js';
let store: Store;
let app: FastifyInstance;
beforeEach(async () => {
  store = new Store(':memory:');
  app = await createApp(store, { staticRoot: 'does-not-exist' });
});
afterEach(async () => {
  await app.close();
  store.close();
});
const accessInput = {
  name: 'API Demo',
  services: ['codex'],
  primaryService: 'codex',
  packageName: 'DEMO',
  modelIds: ['demo-codex-basic', 'demo-codex-deep'],
  confirmed: true,
  priority: 'balanced',
};
it('HTTP end-to-end: profil, konsultasi, bootstrap, preview, koreksi dan riwayat', async () => {
  let r = await app.inject({ method: 'POST', url: '/api/accesses', payload: accessInput });
  expect(r.statusCode).toBe(201);
  const access = r.json<AccessProfile>();
  r = await app.inject({ method: 'POST', url: '/api/consultations', payload: task(access) });
  expect(r.statusCode).toBe(201);
  const root = r.json<ConsultationDetail>();
  r = await app.inject({
    method: 'POST',
    url: '/api/consultations/' + root.consultation.id + '/approve',
    payload: {
      kbVersion: root.consultation.kbVersion,
      catalogVersion: 1,
      reason: 'Default sesuai, jadikan acuan.',
    },
  });
  expect(r.statusCode).toBe(200);
  r = await app.inject({
    method: 'POST',
    url: '/api/consultations',
    payload: { ...task(access, { failures: 3, taskStatus: 'stuck' }), taskId: root.case.taskId },
  });
  const c = r.json<ConsultationDetail>();
  const correction = {
    kbVersion: c.consultation.kbVersion,
    catalogVersion: 1,
    reason: 'Memerlukan investigasi lebih mendalam.',
    profileId: 'demo-codex-deep-profile',
    condition: { type: 'and', terms: [{ field: 'failures', op: 'gte', value: 3 }] },
  };
  r = await app.inject({
    method: 'POST',
    url: '/api/consultations/' + c.consultation.id + '/correction/preview',
    payload: correction,
  });
  expect(r.statusCode).toBe(200);
  expect(r.json().protectedCount).toBe(1);
  r = await app.inject({
    method: 'POST',
    url: '/api/consultations/' + c.consultation.id + '/correction',
    payload: correction,
  });
  expect(r.statusCode).toBe(200);
  expect(r.json().consultation.status).toBe('CORRECTED_APPROVED');
  r = await app.inject({ method: 'GET', url: '/api/tasks/' + c.case.taskId });
  expect(r.json().consultations).toHaveLength(2);
  r = await app.inject({ method: 'GET', url: '/api/tree' });
  expect(r.json().nodes).toHaveLength(2);
});
it('HTTP validasi terstruktur, input JSON rusak, dan missing ID', async () => {
  const r = await app.inject({
    method: 'POST',
    url: '/api/accesses',
    payload: { ...accessInput, services: [] },
  });
  expect(r.statusCode).toBe(400);
  expect(r.json().error.code).toBe('VALIDATION');
  const bad = await app.inject({
    method: 'POST',
    url: '/api/accesses',
    headers: { 'content-type': 'application/json' },
    payload: '{broken',
  });
  expect(bad.statusCode).toBe(400);
  const missing = await app.inject('/api/consultations/missing');
  expect(missing.statusCode).toBe(404);
  expect(missing.json().error.code).toBe('NOT_FOUND');
});
it('HTTP akses katalog memakai version check', async () => {
  let r = await app.inject('/api/catalog');
  const c = r.json();
  r = await app.inject({ method: 'PUT', url: '/api/catalog', payload: c });
  expect(r.statusCode).toBe(200);
  expect(r.json().version).toBe(2);
  r = await app.inject({ method: 'PUT', url: '/api/catalog', payload: c });
  expect(r.statusCode).toBe(409);
});
it('HTTP outcome dan task tidak dikenal', async () => {
  const a = await app.inject({ method: 'POST', url: '/api/accesses', payload: accessInput });
  const c = (
    await app.inject({ method: 'POST', url: '/api/consultations', payload: task(a.json()) })
  ).json<ConsultationDetail>();
  const payload = {
    success: 'yes',
    evidence: 'Tes lulus',
    durationMinutes: 5,
    attempts: 1,
    tokens: null,
    apiCost: null,
    currency: null,
    subscriptionUsage: null,
  };
  const r = await app.inject({
    method: 'POST',
    url: '/api/tasks/' + c.case.taskId + '/outcomes',
    payload,
  });
  expect(r.statusCode).toBe(201);
  expect(r.json().tokens).toBeNull();
  const missing = await app.inject({ method: 'POST', url: '/api/tasks/missing/outcomes', payload });
  expect(missing.statusCode).toBe(404);
});
it('origin nonlokal ditolak untuk mutasi, origin lokal diterima', async () => {
  const denied = await app.inject({
    method: 'POST',
    url: '/api/accesses',
    payload: accessInput,
    headers: { origin: 'https://example.com' },
  });
  expect(denied.statusCode).toBe(403);
  const ok = await app.inject({
    method: 'POST',
    url: '/api/accesses',
    payload: accessInput,
    headers: { origin: 'http://127.0.0.1:5173' },
  });
  expect(ok.statusCode).toBe(201);
});

it('hasil build dapat disajikan bersama API tanpa membocorkan route API ke fallback SPA', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'devpilot-static-'));
  try {
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>DevPilot QA</title>');
    await app.close();
    app = await createApp(store, { staticRoot: dir });
    expect((await app.inject('/')).body).toContain('DevPilot QA');
    expect((await app.inject('/api/health')).json().ok).toBe(true);
    expect((await app.inject('/api/not-found')).statusCode).toBe(404);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
