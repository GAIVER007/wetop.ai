/** Local synthetic authentication ONLY; real portal/Beauty/Food handlers, guards and DB. */
import 'reflect-metadata';
import '../../apps/api/src/hotel/hotel.module';
import { Controller, Get, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { json, type Request, type Response, type NextFunction } from 'express';
import { createPrismaClient } from '@pms/database';
import { EmployeePortalModule } from '../../apps/api/src/employee-portal/employee-portal.module';
import { BeautyModule } from '../../apps/api/src/beauty/beauty.module';
import { FoodModule } from '../../apps/api/src/food-service/food.module';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { SITE_ASSET_STORAGE } from '../../apps/api/src/marketing-site/asset-storage';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { Access } from '../../apps/api/src/auth/access.decorator';
import { scopeView } from '../../apps/api/src/auth/request-context';
import { DiskPortalStorage } from './disk-storage';
import { assertPortalDatabase, seedPortalFixture, type PortalActor } from './fixture-support';

const db = createPrismaClient(assertPortalDatabase(), 'pms_test');
// Isolated synthetic replay receipts; never inherit a production signing secret.
process.env.SESSION_SECRET = 'synthetic-employee-portal-fixture-replay-key';
const port = Number(process.env.EMPLOYEE_PORTAL_API_PORT || '26831');
const storage = new DiskPortalStorage(undefined, `http://127.0.0.1:${port}`);
const prisma = { db } as PrismaService;
let fixture = await seedPortalFixture(db);

class FixtureShellController {
  async me(req: Request & { user: PortalActor }) {
    const user = Object.fromEntries(Object.entries(req.user).filter(([key]) => key !== 'userId'));
    const organization = await db.organization.findUniqueOrThrow({ where: { id: req.user.organizationId } });
    return { user: { ...user, organization }, organization, context: scopeView() };
  }
  async shell(req: Request & { user: PortalActor }) {
    const businesses = await db.business.findMany({ where: { organizationId: req.user.organizationId }, include: { locations: true } });
    return { organization: { id: req.user.organizationId }, businesses, context: scopeView() };
  }
  scope() { return scopeView(); }
}
Controller()(FixtureShellController);
for (const [name, path] of [['me', 'auth/me'], ['shell', 'shell'], ['scope', 'scope/resolve']] as const) {
  const d = Object.getOwnPropertyDescriptor(FixtureShellController.prototype, name)!;
  Get(path)(FixtureShellController.prototype, name, d);
  Access('self')(FixtureShellController.prototype, name, d);
  if (name !== 'scope') Req()(FixtureShellController.prototype, name, 0);
}
const module = await Test.createTestingModule({ imports: [EmployeePortalModule, BeautyModule, FoodModule], controllers: [FixtureShellController] })
  .overrideProvider(PrismaService).useValue(prisma)
  .overrideProvider(SITE_ASSET_STORAGE).useValue(storage).compile();
const app = module.createNestApplication();
app.use(json({ limit: '32kb' }));
app.use((req: Request & { user?: PortalActor }, res: Response, next: NextFunction) => {
  void (async () => {
    if (req.path === '/__test/health' && req.method === 'GET') return res.json({ ok: true, syntheticAuthentication: true, vertical: fixture.vertical });
    if (req.path === '/__test/reset' && req.method === 'POST') {
      const vertical = req.body?.vertical ?? 'BEAUTY';
      if (!['BEAUTY', 'FOOD_SERVICE'].includes(vertical)) return res.status(400).json({ message: 'Invalid vertical' });
      fixture = await seedPortalFixture(db, vertical);
      return res.json(fixture);
    }
    if (req.path.startsWith('/__assets/') && req.method === 'GET') {
      try {
        const bytes = await storage.readByUrl(req.originalUrl);
        return res.type('image/webp').setHeader('Cache-Control', 'no-store').send(bytes);
      } catch { return res.status(404).end(); }
    }
    // No anonymous private access: RoleGuard alone intentionally accepts service requests.
    if (!req.path.startsWith('/employee-portal/public/')) {
      const key = req.headers['x-wetop-session'];
      if (typeof key !== 'string' || !Object.hasOwn(fixture.actors, key)) return res.status(401).json({ message: 'Synthetic fixture session required' });
      req.user = fixture.actors[key as keyof typeof fixture.actors];
    }
    // Scope is NOT injected from fixture actor: real AuthorInterceptor validates x-wetop-scope.
    next();
  })().catch(next);
});
app.useGlobalGuards(new RoleGuard(new Reflector()));
app.useGlobalInterceptors(new AuthorInterceptor(prisma));
await app.listen(port, '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => {
  void app.close().then(() => db.$disconnect()).finally(() => process.exit(0));
});
