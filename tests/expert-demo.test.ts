import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Consultation, RuleNode } from '../shared/domain.js';
import { buildExpertDemo, demoProfiles, expertCases } from '../server/demo/expert.js';
import { createExpertDemoFile } from '../server/demo/files.js';
import { Advisor } from '../server/service.js';
import { Store } from '../server/store.js';
import { evaluate, infer } from '../server/rdr.js';
import { parseExpertArgs } from '../scripts/expert-args.js';
const stores: Store[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const setup = () => {
  const store = new Store(':memory:', { catalog: demoCatalog() });
  stores.push(store);
  return store;
};
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'devpilot-expert-'));
  dirs.push(dir);
  return dir;
};
describe('Keputusan simulasi pakar', () => {
  it('membangun dari satu root menjadi lima node lewat persetujuan/koreksi dengan riwayat nyata', () => {
    const store = setup();
    expect(store.rules()).toHaveLength(1);
    expect(store.rules()[0].cornerstoneId).toBeNull();
    const report = buildExpertDemo(store);
    expect(report.initialNodeCount).toBe(1);
    expect(report.finalNodeCount).toBe(5);
    expect(report.entries).toHaveLength(10);
    expect(report.entries.filter((e) => e.decision === 'correct')).toHaveLength(4);
    expect(report.entries[0].nodeCount).toBe(1);
    expect(store.version('kb')).toBe(6);
    const reviews = store.list<{ reason: string; action: string }>('reviews');
    expect(reviews.filter((r) => r.action === 'corrected')).toHaveLength(4);
    expect(reviews.every((r) => r.reason.startsWith('[SIMULASI PAKAR'))).toBe(true);
    expect(store.catalog().profiles).toHaveLength(8);
    expect(report.notice).toContain('bukan validasi ahli independen');
  });
  it('pohon mengikuti urutan R0 → R1, R1 kiri R2/kanan R3, R3 kiri R4', () => {
    const store = setup();
    const report = buildExpertDemo(store);
    const ids = Object.fromEntries(
      Object.entries(report.nodeLabels).map(([id, label]) => [label, id]),
    );
    const nodes = new Map(store.rules().map((n) => [n.id, n]));
    expect(nodes.get(ids.R0)?.trueChild).toBe(ids.R1);
    expect(nodes.get(ids.R1)?.falseChild).toBe(ids.R2);
    expect(nodes.get(ids.R1)?.trueChild).toBe(ids.R3);
    expect(nodes.get(ids.R3)?.falseChild).toBe(ids.R4);
  });
  it('semua kondisi pembeda benar pada kasus baru dan salah pada cornerstone yang dikoreksi', () => {
    const store = setup();
    const report = buildExpertDemo(store);
    const advisor = new Advisor(store);
    for (const entry of report.entries.filter((e) => e.decision === 'correct')) {
      const detail = advisor.detail(entry.consultationId);
      const previousNode = JSON.parse(
        (
          store.db
            .prepare('SELECT payload FROM kb_versions WHERE version=?')
            .get(detail.consultation.kbVersion - 1) as { payload: string }
        ).payload,
      ) as RuleNode[];
      const old = previousNode.find(
        (n) =>
          n.id ===
          Object.keys(report.nodeLabels).find((id) => report.nodeLabels[id] === entry.beforeRule),
      )!;
      const cornerstone = store.get<{ facts: typeof detail.case.facts }>(
        'cases',
        old.cornerstoneId!,
      );
      expect(evaluate(entry.condition!, detail.case.facts)).toBe(true);
      expect(evaluate(entry.condition!, cornerstone.facts)).toBe(false);
    }
    expect(report.entries.find((e) => e.key === 'K4')?.cornerstoneBefore).toBe('K1');
    expect(report.entries.find((e) => e.key === 'K2')?.cornerstoneBefore).toBe('K0');
  });
  it('menolak tiga koreksi contoh tanpa mengubah KB dan melindungi K1b dari kondisi terlalu luas', () => {
    const store = setup();
    const report = buildExpertDemo(store);
    expect(report.rejected.map((r) => r.code)).toEqual([
      'NOT_MATCHING',
      'NOT_DISTINGUISHING',
      'REGRESSION',
    ]);
    const advisor = new Advisor(store);
    const protectedEntry = report.entries.find((e) => e.key === 'K1b')!;
    const c = advisor.detail(protectedEntry.consultationId);
    expect(report.nodeLabels[infer(store.rules(), c.case.facts).lastMatchedNode]).toBe('R0');
  });
  it('K4 memakai AND dan effort bawaan, K5 mempertahankan R1 walau terminal R4 salah', () => {
    const store = setup();
    const report = buildExpertDemo(store);
    const k4 = report.entries.find((e) => e.key === 'K4')!;
    expect(k4.condition?.terms).toHaveLength(2);
    expect(k4.effort).toBe('default');
    expect(k4.profileId).toBe(demoProfiles.codexEvidence);
    expect(k4.cornerstoneBefore).toBe('K1');
    const k5 = report.entries.find((e) => e.key === 'K5')!;
    expect(k5.afterRule).toBe('R1');
    expect(k5.trace.at(-1)).toEqual({ rule: 'R4', matched: false, branch: 'false' });
  });
  it('setiap kasus tetap menghasilkan konfigurasi yang diharapkan setelah seluruh tree terbentuk', () => {
    const store = setup();
    const report = buildExpertDemo(store);
    const advisor = new Advisor(store);
    for (const entry of report.entries) {
      const detail = advisor.detail(entry.consultationId);
      const result = infer(store.rules(), detail.case.facts);
      expect(report.nodeLabels[result.lastMatchedNode]).toBe(entry.afterRule);
      expect(detail.consultation.issues).toEqual([]);
      expect(detail.consultation.resolved?.profile.id).toBe(
        expertCases.find((c) => c.key === entry.key)!.expectedProfile,
      );
    }
    expect(report.entries.find((e) => e.key === 'K3')?.beforeStatus).toBe('NEEDS_INFORMATION');
    expect(report.entries.find((e) => e.key === 'K7')?.profileId).toBe(demoProfiles.claudeDeep);
    expect(report.entries.find((e) => e.key === 'K4')?.taskId).toBe(
      report.entries.find((e) => e.key === 'K1')?.taskId,
    );
  });
  it('menolak menjalankan ulang pada DB terisi tanpa mengubah state', () => {
    const store = setup();
    buildExpertDemo(store);
    const before = JSON.stringify(new Advisor(store).overview());
    expect(() => buildExpertDemo(store)).toThrow('database baru');
    expect(JSON.stringify(new Advisor(store).overview())).toBe(before);
  });
});
describe('File dan command simulasi', () => {
  it('menyimpan database/report yang dapat dibuka ulang dan menolak menimpa keduanya', () => {
    const file = join(temp(), 'demo.sqlite');
    const result = createExpertDemoFile(file);
    expect(JSON.parse(readFileSync(result.reportFile, 'utf8')).finalNodeCount).toBe(5);
    const before = readFileSync(file);
    expect(() => createExpertDemoFile(file)).toThrow('sudah ada');
    expect(readFileSync(file)).toEqual(before);
    const reopened = new Store(file, { catalog: demoCatalog() });
    stores.push(reopened);
    expect(reopened.rules()).toHaveLength(5);
    expect(reopened.list<Consultation>('consultations')).toHaveLength(10);
    expect(
      reopened.db.prepare("SELECT id FROM events WHERE kind='demo.expert.completed'").get(),
    ).toBeTruthy();
  });
  it('menolak nama database utama dan report yang sudah ada tanpa menimpanya', () => {
    const dir = temp();
    expect(() => createExpertDemoFile(join(dir, 'devpilot.sqlite'))).toThrow('Database utama');
    const file = join(dir, 'demo.sqlite');
    writeFileSync(file + '.report.json', 'existing report');
    expect(() => createExpertDemoFile(file)).toThrow('sudah ada');
    expect(readFileSync(file + '.report.json', 'utf8')).toBe('existing report');
    expect(() => createExpertDemoFile(join(dir, 'demo.txt'))).toThrow('ekstensi');
  });
  it('mengurai argumen eksplisit dan menolak flag reset atau argumen tidak dikenal', () => {
    expect(parseExpertArgs([]).database).toBe('data/expert-demo.sqlite');
    expect(parseExpertArgs(['--db', 'data/new demo.sqlite']).database).toBe('data/new demo.sqlite');
    expect(parseExpertArgs(['--help']).help).toBe(true);
    expect(() => parseExpertArgs(['--reset'])).toThrow('Argumen');
  });
});
import { demoCatalog } from '../server/catalog.js';
