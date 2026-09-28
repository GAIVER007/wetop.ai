import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { OnboardingService } from '../../apps/api/src/hotel/onboarding';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
import { deleteOrganizationChain } from '../tools/property-owner';
import { purgeAuditRows } from '../tools/audit-purge';

config({ quiet: true });

/**
 * После сброса платформы (ADR-118) у организации остаются владелец и членство, объекта нет. Онбординг должен
 * начинаться с пустого места: форма открывается, а сохранение создаёт объект сразу в цепочке
 * Organization → Business → Location → Property (DATA_MODEL v2.6) и заводит номера под ним
 * (plans/onboarding-without-property-2026-09-28.md). До правки оба шага отвечали 404 «объекта нет».
 */
describe.skipIf(!process.env.DATABASE_URL)('онбординг организации без объекта (после сброса)', () => {
  it('status просит онбординг, provision создаёт объект в цепочке и номера под ним', async () => {
    const db = createPrismaClient();
    const marker = randomUUID();
    const org = await db.organization.create({ data: { name: `TEST onboarding ${marker}` } });
    const user = await db.user.create({ data: { email: `onboarding-${marker}@example.invalid` } });
    const service = new OnboardingService({ db } as PrismaService, { forget: () => {} } as never);
    const as = <T>(fn: () => Promise<T>) => withSignedInUser({ userId: user.id, organizationId: org.id }, fn);
    try {
      expect(await as(() => service.status())).toEqual({
        needed: true,
        name: org.name,
        currency: 'KZT',
      });
      // GET ничего не пишет
      expect(await db.property.count({ where: { organizationId: org.id } })).toBe(0);

      const result = await as(() =>
        service.provision({
          currency: 'KZT',
          categories: [
            { name: 'Двухместный', kind: 'PRIVATE_ROOM', capacityAdults: 2, units: 2, priceMinor: 1_500_000 },
          ],
        }),
      );
      expect(result).toMatchObject({ ok: true, categories: 1, units: 2 });

      const property = await db.property.findFirstOrThrow({
        where: { organizationId: org.id },
        select: {
          id: true,
          name: true,
          timezone: true,
          currency: true,
          location: { select: { business: { select: { organizationId: true, vertical: true } } } },
        },
      });
      expect(property).toMatchObject({
        name: org.name,
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        location: { business: { organizationId: org.id, vertical: 'HOSPITALITY' } },
      });
      expect(await db.accommodationType.count({ where: { propertyId: property.id } })).toBe(1);
      expect(await db.inventoryUnit.count({ where: { propertyId: property.id } })).toBe(2);
      // после онбординга форма его больше не просит
      expect((await as(() => service.status())).needed).toBe(false);
    } finally {
      await purgeAuditRows(db, { userId: user.id });
      const ids = (await db.property.findMany({ where: { organizationId: org.id }, select: { id: true } })).map(
        (p) => p.id,
      );
      await db.dailyRate.deleteMany({ where: { accommodationType: { propertyId: { in: ids } } } });
      await db.inventoryUnit.deleteMany({ where: { propertyId: { in: ids } } });
      await db.physicalRoom.deleteMany({ where: { floor: { building: { propertyId: { in: ids } } } } });
      await db.floor.deleteMany({ where: { building: { propertyId: { in: ids } } } });
      await db.building.deleteMany({ where: { propertyId: { in: ids } } });
      await db.ratePlanAccommodationType.deleteMany({ where: { accommodationType: { propertyId: { in: ids } } } });
      await db.ratePlan.deleteMany({ where: { propertyId: { in: ids } } });
      await db.accommodationType.deleteMany({ where: { propertyId: { in: ids } } });
      await db.property.deleteMany({ where: { id: { in: ids } } });
      await deleteOrganizationChain(db, [org.id]);
      await db.user.delete({ where: { id: user.id } });
      await db.organization.delete({ where: { id: org.id } });
      forgetPropertyRef();
      await db.$disconnect();
    }
  }, 120000);
});
