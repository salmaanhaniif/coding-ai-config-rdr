import { closeSync, existsSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { Store } from '../store.js';
import { demoCatalog } from '../catalog.js';
import { buildExpertDemo, type ExpertDemoReport } from './expert.js';

/** Reserve new output files exclusively; never reset or reuse a working database. */
export function createExpertDemoFile(filename: string): {
  database: string;
  reportFile: string;
  report: ExpertDemoReport;
} {
  const database = resolve(filename);
  const reportFile = database + '.report.json';
  if (!database.toLowerCase().endsWith('.sqlite'))
    throw new Error('Database demo harus memakai ekstensi .sqlite.');
  if (basename(database).toLowerCase() === 'devpilot.sqlite')
    throw new Error('Database utama devpilot.sqlite tidak boleh dipakai untuk generator demo.');
  if (existsSync(database) || existsSync(reportFile))
    throw new Error(
      'File database atau laporan sudah ada. Pilih --db dengan nama baru; data lama tidak ditimpa.',
    );
  mkdirSync(dirname(database), { recursive: true });
  closeSync(openSync(database, 'wx'));
  const reportFd = openSync(reportFile, 'wx');
  let store: Store | undefined;
  try {
    store = new Store(database, { catalog: demoCatalog() });
    const report = buildExpertDemo(store);
    writeFileSync(reportFd, JSON.stringify(report, null, 2) + '\n', 'utf8');
    return { database, reportFile, report };
  } finally {
    store?.close();
    closeSync(reportFd);
  }
}
