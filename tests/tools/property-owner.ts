import type { Db, DbTx } from '@pms/database';

/**
 * Передать объект тестовой базы другой организации — вместе с Business его цепочки (Platform P1,
 * DATA_MODEL v2.5). Объект вошедшего ищется только по цепочке Organization → Business → Location →
 * Property, поэтому смена одного `properties.organization_id` оставила бы объект за прежней организацией.
 * Только внутри откатываемой транзакции теста: переносится весь Business со всеми его филиалами.
 */
export async function moveProperty(
  tx: Pick<DbTx, 'property' | 'business'>,
  propertyId: string,
  organizationId: string,
): Promise<void> {
  const { location } = await tx.property.update({
    where: { id: propertyId },
    data: { organizationId },
    select: { location: { select: { businessId: true } } },
  });
  await tx.business.update({ where: { id: location.businessId }, data: { organizationId } });
}

/** Убрать цепочку Business → Location тестовых организаций — после удаления их объектов, до удаления самих организаций */
export async function deleteOrganizationChain(db: Pick<Db, 'location' | 'business'>, organizationIds: string[]): Promise<void> {
  await db.location.deleteMany({ where: { business: { organizationId: { in: organizationIds } } } });
  await db.business.deleteMany({ where: { organizationId: { in: organizationIds } } });
}
