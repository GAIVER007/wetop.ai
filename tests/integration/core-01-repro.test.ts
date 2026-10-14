import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, NEW_PROPERTY_DEFAULTS, type Db } from '@pms/database';
import { PrismaUnitOfWork } from '../../apps/api/src/reservations/reservations.repository';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import {
  withIntegrationPropertyScope,
  withServiceDatabase,
  withSignedInUser,
} from '../../apps/api/src/auth/request-context';

const url = process.env.DATABASE_URL;

/**
 * CORE-01 (verification gate): документированная репродукция подтверждённого дефекта U2-1.
 *
 * `resetExternalEventAttempts` (reservations.repository.ts) пишет `updateMany({ provider, externalEventId })`
 * без привязки к организации или объекту, а `retryEvent` (channels/inbound.service.ts) выполняет его под
 * служебной ролью: администратор каналов организации X, зная revisionId чужой организации Y, сбрасывает
 * счётчик попыток и статус ЕЁ события (строка уникальна глобально по (provider, external_event_id)).
 *
 * Тест утверждает ЖЕЛАЕМОЕ поведение (чужая строка не тронута) и помечен `it.fails`: пока дефект жив,
 * прогон зелёный; когда CORE-SECURITY-FIX добавит привязку, тест начнёт падать и `.fails` нужно снять.
 */
describe.skipIf(!url)('CORE-01 репродукции: границы областей (настоящая PostgreSQL)', () => {
  let db: Db;
  const orgX = randomUUID(),
    orgY = randomUUID(),
    userX = randomUUID();
  let propertyX: string, businessX: string, locationX: string;
  const revisionY = `CORE01-REV-${randomUUID()}`;

  beforeAll(async () => {
    db = createPrismaClient(url);
    await db.organization.createMany({
      data: [orgX, orgY].map((id) => ({ id, name: 'CORE-01 synthetic', status: 'ACTIVE' })),
    });
    await db.user.create({
      data: { id: userX, name: 'Synthetic admin X', email: `core01-${userX}@example.invalid` },
    });
    const px = await createPropertyInChain(db, orgX, {
      name: 'CORE01 Hotel X',
      ...NEW_PROPERTY_DEFAULTS,
    });
    propertyX = px.id;
    locationX = px.locationId;
    businessX = (
      await db.location.findUniqueOrThrow({ where: { id: px.locationId }, select: { businessId: true } })
    ).businessId;
    const py = await createPropertyInChain(db, orgY, {
      name: 'CORE01 Hotel Y',
      ...NEW_PROPERTY_DEFAULTS,
    });
    await db.externalEvent.create({
      data: {
        propertyId: py.id,
        provider: 'channex',
        externalEventId: revisionY,
        type: 'booking_revision',
        payloadHash: 'core01',
        status: 'FAILED',
        attemptCount: 3,
        lastError: 'synthetic',
      },
    });
  });

  afterAll(async () => {
    await db.externalEvent.deleteMany({ where: { externalEventId: revisionY } });
    for (const org of [orgX, orgY]) {
      await db.property.deleteMany({ where: { organizationId: org } });
      await db.location.deleteMany({ where: { business: { organizationId: org } } });
      await db.business.deleteMany({ where: { organizationId: org } });
    }
    await db.user.delete({ where: { id: userX } });
    await db.organization.deleteMany({ where: { id: { in: [orgX, orgY] } } });
  });

  it.fails(
    'повтор события каналов не трогает событие чужой организации (U2-1, пока дефект)',
    async () => {
      const uow = new PrismaUnitOfWork({ db } as PrismaService);
      // ровно путь retryEvent для человека: служебная роль + integration-scope СВОЕГО объекта X
      await withSignedInUser(
        {
          userId: userX,
          organizationId: orgX,
          role: 'OWNER' as const,
          scope: 'LOCATION' as const,
          businessId: businessX,
          locationId: locationX,
          vertical: 'HOSPITALITY' as const,
        },
        () =>
          withServiceDatabase(() =>
            withIntegrationPropertyScope(propertyX, () =>
              uow.run((repo) => repo.resetExternalEventAttempts('channex', revisionY)),
            ),
          ),
      );
      const foreign = await db.externalEvent.findUniqueOrThrow({
        where: { provider_externalEventId: { provider: 'channex', externalEventId: revisionY } },
      });
      // желаемое: строка организации Y не изменилась; сегодня write проходит (attemptCount 0, RECEIVED)
      expect({
        attemptCount: foreign.attemptCount,
        status: foreign.status,
        lastError: foreign.lastError,
      }).toEqual({
        attemptCount: 3,
        status: 'FAILED',
        lastError: 'synthetic',
      });
    },
  );
});
