import { ForbiddenException } from '@nestjs/common';
import { canAt, canWrite } from '@pms/domain';
import type { DbTx } from '@pms/database';
import { currentAssignments, currentBusinessId, currentLocationId, currentOrganizationId, currentRole, hasSignedInActor } from '../auth/request-context';

/** No name/first-property fallback for the user-facing inventory writer. */
export async function verifiedLocationProperty(db: Pick<DbTx, 'property'>) {
  const locationId = currentLocationId(), organizationId = currentOrganizationId(), businessId = currentBusinessId();
  if (!hasSignedInActor() || !locationId || !organizationId || !businessId)
    throw new ForbiddenException('Выберите доступный гостиничный филиал');
  const property = await db.property.findFirst({
    where: { locationId, organizationId, location: { status: 'ACTIVE', businessId, business: { organizationId, status: 'ACTIVE', vertical: 'HOSPITALITY' } } },
    select: { id: true },
  });
  if (!property || !canAt(currentRole() ?? 'STAFF', currentAssignments(), 'property', { businessId, locationId }))
    throw new ForbiddenException('Нет прав на изменение фонда этого филиала');
  return property.id;
}

/** Runs inside the existing editor transaction, before any source mutation. */
export async function captureInventoryBeforeWrite(tx: DbTx, propertyId: string) {
  if (hasSignedInActor()) {
    const id = await verifiedLocationProperty(tx);
    if (id !== propertyId) throw new ForbiddenException('Объект изменился');
    await tx.$queryRaw`SELECT id FROM organizations WHERE id=${currentOrganizationId()}::uuid FOR SHARE`;
    const org = await tx.organization.findUnique({ where: { id: currentOrganizationId()! }, select: { status: true, trialEndsAt: true } });
    if (!org || !canWrite(org.status, org.trialEndsAt, new Date()))
      throw new ForbiddenException('Организация доступна только для чтения');
  }
  // Default off: held migration 118 is never referenced without opt-in.
  if (process.env.HOSPITALITY_WORKLOAD_CAPTURE === 'true') {
    if (!hasSignedInActor()) throw new ForbiddenException('Для старта наблюдения войдите в филиал');
    await tx.$queryRaw`SELECT capture_hospitality_workload(${propertyId}::uuid)::text`;
  }
}
