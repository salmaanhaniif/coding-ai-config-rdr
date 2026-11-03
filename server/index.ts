import { resolve } from 'node:path';
import { openRuntimeStore } from './runtime-store.js';
import { createApp } from './app.js';
const store = openRuntimeStore();
const app = await createApp(store, { logger: true });
const close = async () => {
  await app.close();
  store.close();
  process.exit(0);
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
try {
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: '127.0.0.1' });
} catch (error) {
  app.log.error(error);
  store.close();
  process.exit(1);
}
