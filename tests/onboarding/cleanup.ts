import type { Db } from '@pms/database';
import { isLocalDatabase } from '../tools/seed-local';
/** Delete only a marked synthetic fixture owned by this localhost browser suite. */
export async function cleanupOnboardingFixture(db: Db, organizationId: string, userId?: string) {
  if (!isLocalDatabase(process.env.DATABASE_URL ?? '')) throw new Error('Local database required');
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org?.name.startsWith('MV3-browser-')) throw new Error('Fixture marker required');
  await db.$transaction(async (tx) => {
    const propertyIds = (
      await tx.property.findMany({ where: { organizationId }, select: { id: true } })
    ).map((p) => p.id);
    const locationIds = (
      await tx.location.findMany({ where: { business: { organizationId } }, select: { id: true } })
    ).map((l) => l.id);
    const ownedEntities = [...propertyIds, ...locationIds];
    const authors = (
      await tx.auditLog.findMany({
        where: { entityId: { in: ownedEntities } },
        select: { userId: true },
      })
    )
      .map((a) => a.userId)
      .filter((id): id is string => Boolean(id));
    await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
    await tx.auditLog.deleteMany({ where: { entityId: { in: ownedEntities } } });
    await tx.dailyRate.deleteMany({ where: { ratePlan: { propertyId: { in: propertyIds } } } });
    await tx.ratePlanAccommodationType.deleteMany({
      where: { ratePlan: { propertyId: { in: propertyIds } } },
    });
    await tx.inventoryUnit.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await tx.physicalRoom.deleteMany({
      where: { floor: { building: { propertyId: { in: propertyIds } } } },
    });
    await tx.floor.deleteMany({ where: { building: { propertyId: { in: propertyIds } } } });
    await tx.building.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await tx.accommodationType.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await tx.ratePlan.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await tx.property.deleteMany({ where: { organizationId } });
    await tx.onboardingProgress.deleteMany({ where: { locationId: { in: locationIds } } });
    await tx.location.deleteMany({ where: { id: { in: locationIds } } });
    await tx.business.deleteMany({ where: { organizationId } });
    await tx.organization.delete({ where: { id: organizationId } });
    await tx.user.deleteMany({
      where: {
        id: { in: userId ? [userId] : authors },
        email: { startsWith: 'mv3-', endsWith: '@example.invalid' },
      },
    });
  });
}
