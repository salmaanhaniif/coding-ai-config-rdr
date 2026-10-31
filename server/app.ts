import Fastify from 'fastify';
import staticFiles from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import { Advisor } from './service.js';
import { Store } from './store.js';
import { AppError } from './errors.js';
export async function createApp(
  store: Store,
  options: { staticRoot?: string; logger?: boolean } = {},
) {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 1024 * 1024 });
  const advisor = new Advisor(store);
  app.addHook('onRequest', async (req, reply) => {
    if (req.method !== 'GET' && req.headers.origin) {
      let origin: URL;
      try {
        origin = new URL(req.headers.origin);
      } catch {
        throw new AppError('ORIGIN', 'Origin tidak valid.', 403);
      }
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname))
        return reply
          .code(403)
          .send({
            error: { code: 'ORIGIN', message: 'Aplikasi demo hanya menerima origin lokal.' },
          });
    }
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError)
      return reply
        .code(400)
        .send({
          error: { code: 'VALIDATION', message: 'Input tidak valid.', details: error.issues },
        });
    if (error instanceof AppError)
      return reply
        .code(error.status)
        .send({ error: { code: error.code, message: error.message, details: error.details } });
    if ((error as { statusCode?: number }).statusCode === 400)
      return reply
        .code(400)
        .send({ error: { code: 'BAD_REQUEST', message: 'Format permintaan tidak valid.' } });
    request.log.error(error);
    return reply
      .code(500)
      .send({
        error: { code: 'INTERNAL', message: 'Terjadi kesalahan internal. Periksa log server.' },
      });
  });
  app.get('/api/health', async () => ({ ok: true, mode: 'local-demo' }));
  app.get('/api/overview', async () => advisor.overview());
  app.get('/api/tree', async () => ({ version: store.version('kb'), nodes: store.rules() }));
  app.get('/api/catalog', async () => store.catalog());
  app.put('/api/catalog', async (req) => advisor.updateCatalog(req.body));
  app.post('/api/accesses', async (req, reply) =>
    reply.code(201).send(advisor.createAccess(req.body)),
  );
  app.post('/api/consultations', async (req, reply) =>
    reply.code(201).send(advisor.createConsultation(req.body)),
  );
  app.get<{ Params: { id: string } }>('/api/consultations/:id', async (req) =>
    advisor.detail(req.params.id),
  );
  app.post<{ Params: { id: string } }>('/api/consultations/:id/refresh', async (req) =>
    advisor.refresh(req.params.id),
  );
  app.post<{ Params: { id: string } }>('/api/consultations/:id/approve', async (req) =>
    advisor.approve(req.params.id, req.body),
  );
  app.post<{ Params: { id: string } }>('/api/consultations/:id/information', async (req) =>
    advisor.information(req.params.id, req.body),
  );
  app.get<{ Params: { id: string } }>('/api/consultations/:id/draft', async (req) =>
    advisor.getDraft(req.params.id),
  );
  app.put<{ Params: { id: string } }>('/api/consultations/:id/draft', async (req) =>
    advisor.draft(req.params.id, req.body),
  );
  app.post<{ Params: { id: string } }>('/api/consultations/:id/correction/preview', async (req) =>
    advisor.preview(req.params.id, req.body),
  );
  app.post<{ Params: { id: string } }>('/api/consultations/:id/correction', async (req) =>
    advisor.correct(req.params.id, req.body),
  );
  app.get<{ Params: { id: string } }>('/api/tasks/:id', async (req) =>
    advisor.taskDetail(req.params.id),
  );
  app.post<{ Params: { id: string } }>('/api/tasks/:id/outcomes', async (req, reply) =>
    reply.code(201).send(advisor.outcome(req.params.id, req.body)),
  );
  const staticRoot = options.staticRoot ?? resolve('dist');
  if (existsSync(staticRoot)) {
    await app.register(staticFiles, { root: staticRoot });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/')
        ? reply
            .code(404)
            .send({ error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } })
        : reply.sendFile('index.html'),
    );
  }
  return app;
}
