import { createExpertDemoFile } from '../server/demo/files.js';
import { parseExpertArgs } from './expert-args.js';
try {
  const args = parseExpertArgs(process.argv.slice(2));
  if (args.help)
    console.log(
      'npm run demo:expert -- [--db data/nama-baru.sqlite]\nMembuat database baru dan laporan keputusan SIMULASI PAKAR. Tidak menimpa file lama.',
    );
  else {
    const result = createExpertDemoFile(args.database);
    console.log(result.report.notice);
    console.log('Database: ' + result.database);
    console.log('Laporan: ' + result.reportFile);
    console.log(
      'Root awal: ' +
        result.report.initialNodeCount +
        ' → node akhir: ' +
        result.report.finalNodeCount,
    );
    console.log(
      'Kasus disetujui/dikoreksi: ' +
        result.report.entries.length +
        '; contoh koreksi ditolak: ' +
        result.report.rejected.length,
    );
    for (const e of result.report.entries)
      console.log(
        e.key +
          ' | ' +
          e.decision +
          ' | ' +
          e.beforeRule +
          ' → ' +
          e.afterRule +
          ' | ' +
          e.model +
          ' | effort ' +
          e.effort,
      );
    console.log(
      'Buka aplikasi: npm run dev:expert' +
        (args.database !== 'data/expert-demo.sqlite'
          ? ' -- --db ' + JSON.stringify(args.database)
          : ''),
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
