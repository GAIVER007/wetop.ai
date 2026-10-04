/** Synthetic authentication only; onboarding uses the real service and isolated local database. */
import 'reflect-metadata';
import { cleanupOnboardingFixture } from './cleanup';
import '../../apps/api/src/hotel/hotel.module';
import type { BusinessVertical } from '@pms/domain';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '@pms/database';
import { SharedOnboardingService } from '../../apps/api/src/onboarding/onboarding.module';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';
import { OnboardingService } from '../../apps/api/src/hotel/onboarding';
import { createPropertyInChain, NEW_PROPERTY_DEFAULTS } from '@pms/database';
if (!process.env.DATABASE_URL || !isLocalDatabase(process.env.DATABASE_URL))
  throw new Error('Local isolated database required');
const db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
const service = new SharedOnboardingService({ db } as never);
const hotel = new OnboardingService({ db } as never, { forget() {} } as never);
const userId = randomUUID();
const organizationId = randomUUID();
await db.organization.create({
  data: { id: organizationId, name: `MV3-browser-${organizationId}`, status: 'ACTIVE' },
});
await db.user.create({
  data: { id: userId, name: 'Тестовый владелец', email: `mv3-${userId}@example.invalid` },
});
let actor = {
  userId,
  organizationId,
  role: 'OWNER' as const,
  vertical: 'BEAUTY' as BusinessVertical,
  scope: 'LOCATION' as const,
  businessId: '',
  locationId: '',
};
let vertical = 'BEAUTY';
let calls: string[] = [];
const server = createServer(async (req, res) => {
  res.setHeader('content-type', 'application/json');
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    const body = raw ? JSON.parse(raw) : {};
    const path = req.url?.split('?')[0];
    if (path === '/__test/health') {
      res.end('{}');
      return;
    }
    if (path === '/__test/cleanup') {
      await cleanupOnboardingFixture(db, organizationId, userId);
      res.end('{}');
      return;
    }
    if (path === '/__test/reset') {
      vertical = body.vertical ?? 'BEAUTY';
      calls = [];
      await db.organization.update({
        where: { id: organizationId },
        data: { status: body.readOnly ? 'READ_ONLY' : 'ACTIVE' },
      });
      if (vertical === 'HOSPITALITY') {
        const property = await db.$transaction((tx) =>
          createPropertyInChain(tx, organizationId, {
            name: 'Тестовый отель',
            ...NEW_PROPERTY_DEFAULTS,
          }),
        );
        const location = await db.location.findUniqueOrThrow({
          where: { id: property.locationId },
        });
        actor = { ...actor, locationId: location.id, businessId: location.businessId };
      } else {
        const business = await db.business.create({
          data: {
            organizationId,
            name: 'Тестовый бизнес',
            vertical: vertical as 'BEAUTY' | 'FOOD_SERVICE',
          },
        });
        const location = await db.location.create({
          data: {
            businessId: business.id,
            name: 'Первый филиал',
            timezone: NEW_PROPERTY_DEFAULTS.timezone,
            currency: NEW_PROPERTY_DEFAULTS.currency,
          },
        });
        actor = { ...actor, businessId: business.id, locationId: location.id };
      }
      actor = { ...actor, vertical: vertical as BusinessVertical };
      res.end(JSON.stringify(actor));
      return;
    }
    if (path === '/__test/calls') {
      res.end(JSON.stringify(calls));
      return;
    }
    calls.push(path ?? '');
    if (path === '/auth/me') {
      res.end(
        JSON.stringify({
          user: {
            ...actor,
            id: userId,
            name: 'Тестовый владелец',
            email: 'owner@example.invalid',
            platformAdmin: false,
          },
          context: { ...actor, vertical },
        }),
      );
      return;
    }
    const result = await withSignedInUser(actor, async () => {
      if (path === '/onboarding')
        return req.method === 'POST' ? service.save(body) : service.status();
      if (path === '/hotel/onboarding')
        return req.method === 'POST' ? hotel.provision(body) : hotel.status();
      return null;
    });
    if (result === null) res.statusCode = 404;
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode =
      typeof (error as { getStatus?: () => number }).getStatus === 'function'
        ? (error as { getStatus: () => number }).getStatus()
        : 500;
    res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Fixture error' }));
  }
});
server.listen(55804, '127.0.0.1');
// Fixtures are confined to the disposable local pms_test database, identified by MV3-browser prefix.
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    server.close();
    void db.$disconnect().finally(() => process.exit(0));
  });
