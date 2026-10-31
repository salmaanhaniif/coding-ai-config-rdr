import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  AccessProfile,
  CaseSnapshot,
  Catalog,
  Consultation,
  RuleNode,
  Task,
} from '../shared/domain.js';
import { demoCatalog } from './catalog.js';
import { AppError } from './errors.js';
export const now = () => new Date().toISOString();
export const uid = () => randomUUID();
export class Store {
  db: DatabaseSync;
  constructor(public filename: string) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.migrate();
  }
  migrate() {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.exec(
        [
          'CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);',
          'CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value INTEGER NOT NULL);',
          'CREATE TABLE IF NOT EXISTS accesses(id TEXT PRIMARY KEY,payload TEXT NOT NULL);',
          'CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,payload TEXT NOT NULL);',
          'CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),access_id TEXT NOT NULL REFERENCES accesses(id),payload TEXT NOT NULL);',
          'CREATE TABLE IF NOT EXISTS catalogs(version INTEGER PRIMARY KEY,payload TEXT NOT NULL);',
          'CREATE TABLE IF NOT EXISTS rules(id TEXT PRIMARY KEY,cornerstone_id TEXT REFERENCES cases(id),true_child TEXT REFERENCES rules(id) DEFERRABLE INITIALLY DEFERRED,false_child TEXT REFERENCES rules(id) DEFERRABLE INITIALLY DEFERRED,payload TEXT NOT NULL);',
          'CREATE TABLE IF NOT EXISTS kb_versions(version INTEGER PRIMARY KEY,payload TEXT NOT NULL);',
          'CREATE TABLE IF NOT EXISTS consultations(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id),task_id TEXT NOT NULL REFERENCES tasks(id),payload TEXT NOT NULL);',
          'CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,consultation_id TEXT NOT NULL REFERENCES consultations(id),payload TEXT NOT NULL);',
          'CREATE TABLE IF NOT EXISTS drafts(consultation_id TEXT PRIMARY KEY REFERENCES consultations(id),payload TEXT NOT NULL);',
          'CREATE TABLE IF NOT EXISTS outcomes(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),payload TEXT NOT NULL);',
          'CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,kind TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL);',
          "INSERT OR IGNORE INTO migrations(version,applied_at) VALUES(1,datetime('now'));",
        ].join('\n'),
      );
      if (!this.db.prepare("SELECT value FROM metadata WHERE key='kb'").get()) {
        const root: RuleNode = {
          id: 'root',
          condition: { type: 'always' },
          conclusion: { kind: 'default' },
          trueChild: null,
          falseChild: null,
          cornerstoneId: null,
          reason: 'Konfigurasi bawaan layanan utama; satu rule awal.',
          createdAt: now(),
        };
        this.saveRules([root]);
        this.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?)').run('kb', 1);
        this.db.prepare('INSERT INTO kb_versions VALUES(?,?)').run(1, JSON.stringify([root]));
      }
      if (!this.db.prepare("SELECT value FROM metadata WHERE key='catalog'").get()) {
        const c = demoCatalog();
        this.db.prepare('INSERT INTO catalogs VALUES(?,?)').run(1, JSON.stringify(c));
        this.db.prepare('INSERT INTO metadata VALUES(?,?)').run('catalog', 1);
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  version(key: 'kb' | 'catalog'): number {
    return Number(
      (this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key) as { value: number })
        .value,
    );
  }
  catalog(): Catalog {
    return JSON.parse(
      (
        this.db
          .prepare('SELECT payload FROM catalogs WHERE version=?')
          .get(this.version('catalog')) as { payload: string }
      ).payload,
    );
  }
  saveCatalog(c: Catalog) {
    this.db.prepare('INSERT INTO catalogs VALUES(?,?)').run(c.version, JSON.stringify(c));
    this.db.prepare("UPDATE metadata SET value=? WHERE key='catalog'").run(c.version);
    this.event('catalog.changed', { version: c.version });
  }
  rules(): RuleNode[] {
    return this.list<RuleNode>('rules');
  }
  saveRules(nodes: RuleNode[]) {
    for (const n of nodes)
      this.db
        .prepare(
          'INSERT INTO rules(id,cornerstone_id,true_child,false_child,payload) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET cornerstone_id=excluded.cornerstone_id,true_child=excluded.true_child,false_child=excluded.false_child,payload=excluded.payload',
        )
        .run(n.id, n.cornerstoneId, n.trueChild, n.falseChild, JSON.stringify(n));
  }
  bumpKB(nodes: RuleNode[]) {
    const version = this.version('kb') + 1;
    this.saveRules(nodes);
    this.db.prepare('INSERT INTO kb_versions VALUES(?,?)').run(version, JSON.stringify(nodes));
    this.db.prepare("UPDATE metadata SET value=? WHERE key='kb'").run(version);
    return version;
  }
  list<T>(
    table: 'accesses' | 'tasks' | 'cases' | 'rules' | 'consultations' | 'outcomes' | 'reviews',
  ): T[] {
    return (
      this.db.prepare('SELECT payload FROM ' + table + ' ORDER BY rowid').all() as {
        payload: string;
      }[]
    ).map((r) => JSON.parse(r.payload));
  }
  get<T>(table: 'accesses' | 'tasks' | 'cases' | 'consultations', id: string): T {
    const row = this.db.prepare('SELECT payload FROM ' + table + ' WHERE id=?').get(id) as
      { payload: string } | undefined;
    if (!row) throw new AppError('NOT_FOUND', 'Data tidak ditemukan.', 404);
    return JSON.parse(row.payload);
  }
  insertAccess(a: AccessProfile) {
    this.db.prepare('INSERT INTO accesses VALUES(?,?)').run(a.id, JSON.stringify(a));
  }
  insertTask(t: Task) {
    this.db.prepare('INSERT INTO tasks VALUES(?,?)').run(t.id, JSON.stringify(t));
  }
  insertCase(c: CaseSnapshot) {
    this.db
      .prepare('INSERT INTO cases VALUES(?,?,?,?)')
      .run(c.id, c.taskId, c.access.id, JSON.stringify(c));
  }
  saveConsultation(c: Consultation) {
    this.db
      .prepare(
        'INSERT INTO consultations VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
      )
      .run(c.id, c.caseId, c.taskId, JSON.stringify(c));
  }
  review(consultationId: string, action: string, reason: string, extra: unknown = {}) {
    const v = {
      id: uid(),
      consultationId,
      action,
      reason,
      extra,
      expert: 'Pakar lokal',
      createdAt: now(),
    };
    this.db
      .prepare('INSERT INTO reviews VALUES(?,?,?)')
      .run(v.id, consultationId, JSON.stringify(v));
    this.event('consultation.' + action, v);
    return v;
  }
  event(kind: string, payload: unknown) {
    this.db
      .prepare('INSERT INTO events VALUES(?,?,?,?)')
      .run(uid(), kind, JSON.stringify(payload), now());
  }
  close() {
    this.db.close();
  }
}
