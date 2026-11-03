import { resolve } from 'node:path';
import { Store } from './store.js';
import { buildKnowledge, KNOWLEDGE_DB } from './knowledge.js';

export function openRuntimeStore(database = process.env.DB_PATH): Store {
  const store = new Store(resolve(database ?? KNOWLEDGE_DB));
  try {
    if (
      !database &&
      store.rules().length === 1 &&
      !store.rules()[0].cornerstoneId &&
      !store.list('accesses').length &&
      !store.list('consultations').length
    ) {
      buildKnowledge(store);
    }
    return store;
  } catch (error) {
    store.close();
    throw error;
  }
}
