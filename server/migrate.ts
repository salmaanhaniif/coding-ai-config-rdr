import { resolve } from 'node:path';
import { openRuntimeStore } from './runtime-store.js';
const store = openRuntimeStore();
console.log(
  'Database siap. KB v' +
    store.version('kb') +
    '; ' +
    store.rules().length +
    ' rule. Seed tidak menimpa data.',
);
store.close();
