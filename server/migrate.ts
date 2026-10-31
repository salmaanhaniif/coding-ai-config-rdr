import { resolve } from 'node:path';
import { Store } from './store.js';
const store = new Store(resolve(process.env.DB_PATH ?? 'data/devpilot.sqlite'));
console.log(
  'Database siap. KB v' +
    store.version('kb') +
    '; ' +
    store.rules().length +
    ' rule. Seed tidak menimpa data.',
);
store.close();
