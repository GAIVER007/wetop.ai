import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { accessDeniedMessage, canWrite, type Permission } from '@pms/domain';
import {
  actorMay,
  currentBusinessId,
  currentLocationId,
  currentOrganizationId,
  currentVertical,
  hasSignedInActor,
} from '../auth/request-context';
import { isOverlapViolation, type DbTx } from '@pms/database';
import type { PrismaService } from '../database/prisma.provider';

/** Общее для модулей салона: где мы находимся и можно ли (DATA_MODEL §19, срезы B3 и B4) */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Салон вошедшего: бизнес BEAUTY его организации и выбранный филиал, если он есть */
export interface BeautyScope {
  organizationId: string;
  businessId: string;
  /** Филиал из указателя запроса; его нет при просмотре каталога бизнеса */
  locationId: string | null;
  locationName: string | null;
  locationCurrency: string | null;
  /** IANA-пояс филиала: день недели и время графика считаются по нему (AGENTS.md §13) */
  locationTimezone: string | null;
}

export function mayBeauty(permission: Permission): void {
  if (!hasSignedInActor() || !actorMay(permission))
    throw new ForbiddenException(accessDeniedMessage(permission));
}

/** Explicit server-verified context only; no first-business or first-location fallback. */
export async function beautyScope(
  prisma: Pick<PrismaService, 'db'> | { db: DbTx },
  requireLocation = false,
): Promise<BeautyScope> {
  const organizationId = currentOrganizationId();
  if (!hasSignedInActor() || !organizationId) throw new ForbiddenException('Войдите в организацию');
  const pointed = currentBusinessId();
  if (!pointed || currentVertical() !== 'BEAUTY')
    throw new ForbiddenException('Выберите бизнес Beauty');
  const business = await prisma.db.business.findFirst({
    where: {
      organizationId,
      vertical: 'BEAUTY',
      status: 'ACTIVE',
      id: pointed,
    },
    select: { id: true },
  });
  if (!business) throw new NotFoundException('Салон в этой организации не настроен');

  const locationId = currentLocationId();
  const select = { id: true, name: true, currency: true, timezone: true };
  const location = locationId
    ? await prisma.db.location.findFirst({
        where: { id: locationId, businessId: business.id, status: 'ACTIVE' },
        select,
      })
    : null;
  if ((locationId && !location) || (requireLocation && !location))
    throw new ForbiddenException('Выберите доступный филиал');

  return {
    organizationId,
    businessId: business.id,
    locationId: location?.id ?? null,
    locationName: location?.name ?? null,
    locationCurrency: location?.currency ?? null,
    locationTimezone: location?.timezone ?? null,
  };
}

/** A service call cannot bypass the HTTP subscription guard. */
export async function mayBeautyWrite(prisma: PrismaService, permission: Permission): Promise<void> {
  mayBeauty(permission);
  await assertWritable(prisma.db);
}
async function assertWritable(db: Pick<DbTx, 'organization'>): Promise<void> {
  const id = currentOrganizationId();
  if (!hasSignedInActor() || !id) throw new ForbiddenException('Войдите в организацию');
  const org = await db.organization.findUnique({
    where: { id },
    select: { status: true, trialEndsAt: true },
  });
  if (!org || !canWrite(org.status, org.trialEndsAt, new Date()))
    throw new ForbiddenException('Организация доступна только для чтения');
}

/** Revalidate under parent row locks, keeping archive/subscription changes outside this write. */
export async function beautyTransaction<T>(
  prisma: PrismaService,
  scope: BeautyScope,
  fn: (tx: DbTx) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${scope.organizationId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${scope.businessId}::uuid FOR SHARE`;
      if (scope.locationId)
        await tx.$queryRaw`SELECT id FROM locations WHERE id = ${scope.locationId}::uuid FOR SHARE`;
      await assertWritable(tx);
      await beautyScope({ db: tx }, scope.locationId !== null);
      return fn(tx);
    });
  } catch (error) {
    if (isOverlapViolation(error)) throw new ConflictException('Мастер в это время уже занят');
    throw error;
  }
}
