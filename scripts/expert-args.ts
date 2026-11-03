import { DEMO_EXPERT_DB } from '../server/demo/expert.js';
export function parseExpertArgs(args: string[]): { database: string; help: boolean } {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h'))
    return { database: DEMO_EXPERT_DB, help: true };
  if (args.length === 0) return { database: DEMO_EXPERT_DB, help: false };
  if (args.length === 2 && args[0] === '--db' && args[1]) return { database: args[1], help: false };
  throw new Error('Argumen tidak dikenal. Gunakan --db data/nama-baru.sqlite atau --help.');
}
