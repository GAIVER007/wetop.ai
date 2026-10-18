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
import { currentBeautyOperation, withVerifiedBeautyOperation } from '../auth/request-context';
import { assertCurrentBeautyMembership, authorizeBeautyRequirement, currentBeautyPositionAccess } from './access';

/** Общее для модулей салона: где мы находимся и можно ли (DATA_MODEL §19, срезы B3 и B4) */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Салон вошедшего: бизнес BEAUTY его организации и выбранный филиал, если он есть */
export interface BeautyScope {
  organizationId: string;
  businessId: string;
  businessName?: string;
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
    select: { id: true, name: true },
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
    ...(typeof business.name === 'string' ? {businessName:business.name} : {}),
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
    return await prisma.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${scope.organizationId}::uuid FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${scope.businessId}::uuid FOR UPDATE`;
        if (scope.locationId)
          await tx.$queryRaw`SELECT id FROM locations WHERE id = ${scope.locationId}::uuid FOR UPDATE`;
        await assertWritable(tx);
        const operation = currentBeautyOperation();
        if (operation) {
          await assertCurrentBeautyMembership(tx);
          await authorizeBeautyRequirement(tx, operation, operation.legacy);
        }
        await beautyScope({ db: tx }, scope.locationId !== null);
        if (process.env.BEAUTY_WORKLOAD_CAPTURE === 'true')
          await tx.$queryRaw`SELECT set_config('app.beauty_capture','true',true)`;
        const result = operation
          ? await withVerifiedBeautyOperation(operation, () => fn(tx), await currentBeautyPositionAccess(tx))
          : await fn(tx);
        if (process.env.BEAUTY_WORKLOAD_CAPTURE === 'true') {
          const locations = await tx.location.findMany({ where: { businessId: scope.businessId }, select: { id: true } });
          for (const location of locations.sort((a,b)=>a.id.localeCompare(b.id)))
            await tx.$queryRaw`SELECT capture_beauty_schedule(${location.id}::uuid)::text`;
        }
        return result;
      },
      { maxWait: 5000, timeout: 10000 },
    );
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002')
      throw new ConflictException('Идентификатор уже занят. Проверьте сохранённые данные.');
    if (isOverlapViolation(error)) throw new ConflictException('Мастер в это время уже занят');
    throw error;
  }
}
