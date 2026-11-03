import { resolve } from 'node:path';
import { createServer } from 'vite';
import { createApp } from '../server/app.js';
import { openRuntimeStore } from '../server/runtime-store.js';
const store = openRuntimeStore();
const app = await createApp(store, { logger: true, staticRoot: resolve('.runtime/no-static-dev') });
const vite = await createServer();
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await vite.close();
  await app.close();
  store.close();
  process.exit(0);
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
try {
  await app.listen({ port: 3001, host: '127.0.0.1' });
  await vite.listen();
  vite.printUrls();
} catch (error) {
  console.error(error);
  await close();
}
