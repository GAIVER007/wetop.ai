import { fullQaPorts } from './ports';
import { qaProxyResponseHeaders } from './proxy-transport';
/** Full AppModule with real guards, sessions and RLS. Only synthetic localhost data. */
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { createServer, request as proxyRequest } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { createPrismaClient, createPropertyInChain, NEW_PROPERTY_DEFAULTS } from '@pms/database';
import { hashPassword } from '@pms/domain';
import { AppModule } from '../../apps/api/src/app.module';
import { ARI_PUBLISHER, NoopAriPublisher } from '../../apps/api/src/channels/ari-publisher';
import { isLocalDatabase } from '../tools/seed-local';
import { cleanupOnboardingFixture } from '../onboarding/cleanup';
if (!isLocalDatabase(process.env.DATABASE_URL || '') || process.env.AUTH_REQUIRED !== '1')
  throw new Error('Local isolated DB and real session guard required');
const db = createPrismaClient(process.env.DATABASE_URL!, 'pms_test');
const evidence = async (value: unknown) => {
  await mkdir('test-results', { recursive: true });
  await appendFile('test-results/onboarding-full-evidence.jsonl', JSON.stringify(value) + '\n');
};
const fixtures: Array<{ organizationId: string; userId: string }> = [];
const module = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(ARI_PUBLISHER)
  .useClass(NoopAriPublisher)
  .compile();
const app = module.createNestApplication({ logger: false });
const traceEnabled = process.env.WETOP_QA_PROXY_TRACE === '1';
const traceId = (value: unknown) =>
  typeof value === 'string' && /^qa-[0-9]+-[0-9]+$/.test(value) ? value : undefined;
if (traceEnabled)
  app.use(
    (
      req: { headers: Record<string, unknown>; method: string; path: string },
      res: { statusCode: number; on: (event: string, callback: () => void) => void },
      next: () => void,
    ) => {
      const id = traceId(req.headers['x-wetop-qa-trace']);
      const at = new Date().toISOString();
      const start = Date.now();
      void evidence({ kind: 'api-start', id, at, method: req.method, route: req.path });
      res.on('finish', () => {
        void evidence({
          kind: 'api-response',
          id,
          at: new Date().toISOString(),
          status: res.statusCode,
          elapsedMs: Date.now() - start,
        });
      });
      next();
    },
  );
app.use(
  (
    req: { path: string },
    res: { status: (s: number) => { end: () => void } },
    next: () => void,
  ) => {
    if (/^\/(channels|guard|webhooks|booking|collect|assistant|bot)(\/|$)/.test(req.path))
      res.status(403).end();
    else next();
  },
);
await app.listen(fullQaPorts.api, '127.0.0.1');
let fault = 'none';
let last: {
  organizationId: string;
  userId: string;
  businessId: string;
  locationId: string;
} | null = null;
let socketSequence = 0;
const socketTrace = new WeakMap<
  object,
  { socketId: number; lastId: string | undefined; requests: number }
>();
const proxy = createServer(async (req, res) => {
  const socket = socketTrace.get(req.socket);
  if (socket) {
    socket.requests++;
    socket.lastId = traceId(req.headers['x-wetop-qa-trace']);
  }
  if (req.url?.startsWith('/__qa/')) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    res.setHeader('content-type', 'application/json');
    if (req.url === '/__qa/health') {
      res.end('{}');
      return;
    }
    if (req.url === '/__qa/reset') {
      fault = 'none';
      const id = randomUUID();
      const name = `MV3-browser-full-${id}`;
      const org = await db.organization.create({ data: { name, status: 'ACTIVE' } });
      let businessId: string, locationId: string;
      if (body.vertical === 'HOSPITALITY') {
        const property = await db.$transaction((tx) =>
          createPropertyInChain(tx, org.id, { name, ...NEW_PROPERTY_DEFAULTS }),
        );
        locationId = property.locationId;
        businessId = (await db.location.findUniqueOrThrow({ where: { id: locationId } }))
          .businessId;
      } else {
        const business = await db.business.create({
          data: {
            organizationId: org.id,
            name,
            vertical: body.vertical === 'FOOD_SERVICE' ? 'FOOD_SERVICE' : 'BEAUTY',
          },
        });
        businessId = business.id;
        locationId = (
          await db.location.create({
            data: { businessId, name, timezone: 'Asia/Almaty', currency: 'KZT' },
          })
        ).id;
      }
      const password = randomBytes(24).toString('base64url') + 'aA1!';
      const user = await db.user.create({
        data: {
          email: `mv3-${id}@example.invalid`,
          emailVerifiedAt: new Date(),
          passwordHash: await hashPassword(password),
        },
      });
      await db.membership.create({
        data: { organizationId: org.id, userId: user.id, role: 'OWNER' },
      });
      last = { organizationId: org.id, userId: user.id, businessId, locationId };
      fixtures.push(last);
      await evidence({
        kind: 'fixture',
        ...last,
        vertical: body.vertical || 'BEAUTY',
        baseline: { progress: 0, units: 0, rates: 0 },
      });
      res.end(JSON.stringify({ ...last, email: user.email, password }));
      return;
    }
    if (req.url === '/__qa/branch' && last) {
      const location = await db.location.create({
        data: {
          businessId: last.businessId,
          name: 'QA additional branch',
          timezone: 'Asia/Almaty',
          currency: 'KZT',
        },
      });
      await evidence({
        kind: 'branch',
        organizationId: last.organizationId,
        businessId: last.businessId,
        locationId: location.id,
      });
      res.end(JSON.stringify({ businessId: last.businessId, locationId: location.id }));
      return;
    }
    if (req.url === '/__qa/fault') {
      fault = body.mode;
      res.end('{}');
      return;
    }
    if (req.url === '/__qa/access' && last) {
      if (body.role)
        await db.membership.update({
          where: {
            userId_organizationId: { userId: last.userId, organizationId: last.organizationId },
          },
          data: { role: body.role },
        });
      if (body.status)
        await db.organization.update({
          where: { id: last.organizationId },
          data: { status: body.status },
        });
      if (body.expire)
        await db.session.updateMany({
          where: { userId: last.userId },
          data: { expiresAt: new Date(0) },
        });
      if (body.revoke)
        await db.session.updateMany({
          where: { userId: last.userId },
          data: { revokedAt: new Date() },
        });
      res.end('{}');
      return;
    }
    if (req.url === '/__qa/snapshot' && last) {
      res.end(
        JSON.stringify({
          progress: await db.onboardingProgress.findMany({
            where: { location: { business: { organizationId: last.organizationId } } },
          }),
          units: await db.inventoryUnit.count({
            where: { property: { organizationId: last.organizationId } },
          }),
          rates: await db.ratePlan.count({
            where: { property: { organizationId: last.organizationId } },
          }),
        }),
      );
      return;
    }
    if (req.url === '/__qa/cleanup') {
      for (const f of fixtures) {
        const org = await db.organization.findUniqueOrThrow({ where: { id: f.organizationId } });
        if (!org.name.startsWith('MV3-browser-full-')) throw new Error('Synthetic marker required');
        const progress = await db.onboardingProgress.findMany({
          where: { location: { business: { organizationId: f.organizationId } } },
        });
        const audit = await db.auditLog.findMany({
          where: { organizationId: f.organizationId },
          select: { id: true, entityId: true, action: true, createdAt: true },
        });
        await evidence({ kind: 'before-cleanup', ...f, progress, audit });
        await db.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
          await tx.auditLog.deleteMany({ where: { organizationId: f.organizationId } });
        });
        await db.session.deleteMany({
          where: { organizationId: f.organizationId, userId: f.userId },
        });
        await db.membership.deleteMany({
          where: { organizationId: f.organizationId, userId: f.userId },
        });
        await cleanupOnboardingFixture(db, f.organizationId, f.userId);
        await evidence({
          kind: 'cleanup',
          ...f,
          organizationsRemaining: await db.organization.count({ where: { id: f.organizationId } }),
          usersRemaining: await db.user.count({ where: { id: f.userId } }),
        });
      }
      fixtures.length = 0;
      res.end('{}');
      return;
    }
    res.statusCode = 404;
    res.end('{}');
    return;
  }
  const mode = fault;
  const started = Date.now();
  const id = traceId(req.headers['x-wetop-qa-trace']);
  if (traceEnabled) {
    void evidence({
      kind: 'proxy-start',
      socketId: socket?.socketId,
      id,
      at: new Date().toISOString(),
      route: req.url,
      method: req.method,
      fault: mode,
    });
    res.on('close', () => {
      if (!res.writableFinished)
        void evidence({
          kind: 'proxy-incomplete-close',
          id,
          at: new Date().toISOString(),
          fault: mode,
          elapsedMs: Date.now() - started,
        });
    });
  }
  if (process.env.WETOP_QA_PROXY_TRACE === '1') {
    const route = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    res.on('finish', () => {
      void evidence({
        kind: 'proxy-response',
        id,
        at: new Date().toISOString(),
        route,
        method: req.method,
        fault: mode,
        status: res.statusCode,
        elapsedMs: Date.now() - started,
      });
    });
    req.on('aborted', () => {
      void evidence({
        kind: 'proxy-aborted',
        id,
        at: new Date().toISOString(),
        route,
        method: req.method,
        fault: mode,
        elapsedMs: Date.now() - started,
      });
    });
  }
  if (mode === 'offline') {
    req.socket.destroy();
    return;
  }
  if (req.url === '/onboarding' && req.method === 'POST' && mode === 'timeout') {
    fault = 'none';
    req.resume();
    req.socket.on('close', () => res.destroy());
    return;
  }
  if (req.url === '/onboarding' && req.method === 'POST' && mode === 'before503') {
    fault = 'none';
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ message: 'QA unavailable before commit' }));
    return;
  }
  const upstream = proxyRequest(
    {
      hostname: '127.0.0.1',
      port: fullQaPorts.api,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (reply) => {
      if (
        req.method === 'POST' &&
        ((req.url === '/onboarding' && mode === 'after') ||
          ((req.url === '/bar/sales/retail' || req.url === '/bar/sales/folio') &&
            mode === 'bar_after') ||
          (req.url === '/bar/write-offs' && mode === 'bar_writeoff_after') ||
          (/^\/bar\/receipts\/[^/]+\/payments$/.test(req.url ?? '') &&
            mode === 'bar_supplier_after'))
      ) {
        fault = 'none';
        reply.resume();
        reply.on('end', () => {
          if (process.env.WETOP_QA_PROXY_TRACE === '1')
            void evidence({
              kind: 'proxy-intentional-drop',
              id,
              at: new Date().toISOString(),
              route: req.url,
              status: reply.statusCode,
              fault: mode,
            });
          req.socket.destroy();
        });
        return;
      }
      res.writeHead(reply.statusCode || 500, qaProxyResponseHeaders(reply.headers));
      reply.pipe(res);
    },
  );
  upstream.on('error', (error: NodeJS.ErrnoException) => {
    if (process.env.WETOP_QA_PROXY_TRACE === '1')
      void evidence({
        kind: 'proxy-upstream-error',
        id,
        at: new Date().toISOString(),
        code: error.code ?? 'UNKNOWN',
        fault: mode,
      });
    res.statusCode = 503;
    res.end('{}');
  });
  req.pipe(upstream);
});
if (traceEnabled)
  proxy.on('connection', (socket) => {
    const state = {
      socketId: ++socketSequence,
      requests: 0,
      lastId: undefined as string | undefined,
    };
    socketTrace.set(socket, state);
    socket.on('close', (hadError) => {
      void evidence({
        kind: 'proxy-socket-close',
        at: new Date().toISOString(),
        ...state,
        hadError,
      });
    });
  });
await new Promise<void>((resolve) => proxy.listen(fullQaPorts.proxy, '127.0.0.1', resolve));
console.log('Full guarded QA API ready, external dispatch disabled');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    proxy.close();
    void app
      .close()
      .then(() => db.$disconnect())
      .then(() => process.exit(0));
  });
