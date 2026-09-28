import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { ConflictException } from '@nestjs/common';
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
 * Первый онбординг организации без объекта создаёт объект в своей транзакции (onboarding-without-property.test.ts).
 * Два одновременных сохранения (двойной щелчок, две вкладки) оба видели «объекта нет» и оба заводили объект:
 * у организации оказывалось два объекта с номерами, а резолвер брал самый ранний. Строка организации теперь
 * запирается на время транзакции: второе сохранение ждёт первое, видит его объект с номерами и получает «уже настроен».
 */
describe.skipIf(!process.env.DATABASE_URL)('онбординг без объекта: два одновременных сохранения', () => {
  it('объект один, одно сохранение проходит, второе — «отель уже настроен»', async () => {
    const db = createPrismaClient();
    const marker = randomUUID();
    const org = await db.organization.create({ data: { name: `TEST onboarding race ${marker}` } });
    const user = await db.user.create({ data: { email: `onboarding-race-${marker}@example.invalid` } });
    const service = new OnboardingService({ db } as PrismaService, { forget: () => {} } as never);
    const as = <T>(fn: () => Promise<T>) => withSignedInUser({ userId: user.id, organizationId: org.id }, fn);
    const body = {
      currency: 'KZT',
      categories: [{ name: 'Койко-место', kind: 'DORM_BED', capacityAdults: 1, units: 2, priceMinor: 900_000 }],
    };
    try {
      const results = await Promise.allSettled([as(() => service.provision(body)), as(() => service.provision(body))]);
      expect(await db.property.count({ where: { organizationId: org.id } })).toBe(1);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect(rejected[0]!.reason).toBeInstanceOf(ConflictException);
    } finally {
      const properties = await db.property.findMany({ where: { organizationId: org.id }, select: { id: true } });
      for (const { id: propertyId } of properties) {
        await db.dailyRate.deleteMany({ where: { ratePlan: { propertyId } } });
        await db.ratePlanAccommodationType.deleteMany({ where: { ratePlan: { propertyId } } });
        await db.ratePlan.deleteMany({ where: { propertyId } });
        await db.inventoryUnit.deleteMany({ where: { propertyId } });
        await db.physicalRoom.deleteMany({ where: { floor: { building: { propertyId } } } });
        await db.floor.deleteMany({ where: { building: { propertyId } } });
        await db.building.deleteMany({ where: { propertyId } });
        await db.accommodationType.deleteMany({ where: { propertyId } });
        await purgeAuditRows(db, { entityId: propertyId });
        await db.property.delete({ where: { id: propertyId } });
      }
      await deleteOrganizationChain(db, [org.id]);
      await db.user.deleteMany({ where: { id: user.id } });
      await db.organization.deleteMany({ where: { id: org.id } });
      forgetPropertyRef();
      await db.$disconnect();
    }
  });
});
