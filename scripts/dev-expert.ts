import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseExpertArgs } from './expert-args.js';
try {
  const args = parseExpertArgs(process.argv.slice(2));
  if (args.help)
    console.log(
      'npm run dev:expert -- [--db data/nama-demo.sqlite]\nMembuka database hasil demo:expert; tidak membuat ulang tree.',
    );
  else {
    const filename = resolve(args.database);
    if (!existsSync(filename))
      throw new Error('Database demo belum ada. Jalankan npm run demo:expert terlebih dahulu.');
    const db = new DatabaseSync(filename, { readOnly: true });
    try {
      if (!db.prepare("SELECT id FROM events WHERE kind='demo.expert.completed' LIMIT 1").get())
        throw new Error(
          'Database bukan hasil generator simulasi pakar yang selesai. Pilih file demo yang sesuai.',
        );
    } finally {
      db.close();
    }
    process.env.DB_PATH = filename;
    console.log('SIMULASI PAKAR — database terpisah: ' + filename);
    await import('./dev.js');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
