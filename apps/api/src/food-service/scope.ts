import { runWithBeautyWriteAuthorization } from '../beauty/access';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { accessDeniedMessage, canWrite, type Permission } from '@pms/domain';
import type { DbTx } from '@pms/database';
import {
  actorMay,
  currentBusinessId,
  currentLocationId,
  currentOrganizationId,
  currentVertical,
  hasSignedInActor,
  currentUserId,
} from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
export interface FoodScope {
  organizationId: string;
  businessId: string;
  locationId: string;
  timezone: string;
  currency: string;
  /** направление филиала: касса (§48) и зарплата (§19.2) общие у ресторана и салона */
  vertical: 'FOOD_SERVICE' | 'BEAUTY' | 'HOSPITALITY';
}
export function foodMay(permission: Permission) {
  if (!hasSignedInActor() || !actorMay(permission))
    throw new ForbiddenException(accessDeniedMessage(permission));
}
/** Касса филиала (§35.2) общая у ресторана и салона (§48); остальное ресторанное только у ресторана */
export const BRANCH_CASH_VERTICALS = ['FOOD_SERVICE', 'BEAUTY'] as const;
/** Склад кухни и расходников (`branch.stock`) открыт всем трём направлениям (ADR-STOCK-ALL, 21.10.2026) */
export const BRANCH_STOCK_VERTICALS = ['FOOD_SERVICE', 'BEAUTY', 'HOSPITALITY'] as const;
type FoodVertical = (typeof BRANCH_STOCK_VERTICALS)[number];
export async function foodScope(
  db: Pick<DbTx, 'business' | 'location'>,
  verticals: readonly FoodVertical[] = ['FOOD_SERVICE'],
): Promise<FoodScope> {
  const organizationId = currentOrganizationId(),
    businessId = currentBusinessId(),
    locationId = currentLocationId(),
    vertical = currentVertical() as FoodVertical | null | undefined;
  if (
    !hasSignedInActor() ||
    !organizationId ||
    !businessId ||
    !locationId ||
    !vertical ||
    !verticals.includes(vertical)
  )
    throw new ForbiddenException('Выберите бизнес Food Service и филиал');
  const business = await db.business.findFirst({
    where: { id: businessId, organizationId, vertical, status: 'ACTIVE' },
  });
  if (!business) throw new NotFoundException('Бизнес недоступен');
  const location = await db.location.findFirst({
    where: { id: locationId, businessId, status: 'ACTIVE' },
  });
  if (!location) throw new ForbiddenException('Выберите доступный филиал');
  return {
    organizationId,
    businessId,
    locationId,
    timezone: location.timezone,
    currency: location.currency,
    vertical,
  };
}
export async function foodWritable(db: Pick<DbTx, 'organization'>) {
  const id = currentOrganizationId();
  if (!id) throw new ForbiddenException('Войдите в организацию');
  const org = await db.organization.findUnique({
    where: { id },
    select: { status: true, trialEndsAt: true },
  });
  if (!org || !canWrite(org.status, org.trialEndsAt, new Date()))
    throw new ForbiddenException('Организация доступна только для чтения');
}
/** One restaurant write at a time. Parent locks also protect subscription and archive checks. */
export async function foodTransaction<T>(
  prisma: PrismaService,
  scope: FoodScope,
  fn: (tx: DbTx, scope: FoodScope) => Promise<T>,
  verticals?: readonly FoodVertical[],
): Promise<T> {
  try {
    return await prisma.db.$transaction(async (tx) => runWithBeautyWriteAuthorization(tx, async () => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${scope.organizationId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM businesses WHERE id=${scope.businessId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM locations WHERE id=${scope.locationId}::uuid FOR UPDATE`;
      await foodWritable(tx);
      if (currentVertical() === 'FOOD_SERVICE' && process.env.RESTAURANT_CAPACITY_CAPTURE === 'true' && process.env.RESTAURANT_OCCUPANCY_CAPTURE === 'true') {
        const tracking = await tx.$queryRaw<{ location_id: string }[]>`SELECT location_id FROM workload_tracking_coverage WHERE location_id=${scope.locationId}::uuid`;
        if (!tracking.length && (await foodScope(tx, verticals))) await tx.$queryRaw`SELECT capture_restaurant_capacity(${scope.locationId}::uuid)::text`;
      }
      return fn(tx, await foodScope(tx, verticals));
    }));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
      throw new ConflictException('Такая запись уже существует');
    throw error;
  }
}

/**
 * Официант с правом `orders` без `desk` («Личный кабинет», §33.6): работает только от своего сотрудника бизнеса
 * (`employees.user_id`). Стойка (`desk`) работает за всех: null. Нет привязанного сотрудника — отказ.
 */
export async function waiterSelf(
  db: Pick<DbTx, 'employee'>,
  s: Pick<FoodScope, 'businessId'>,
): Promise<{ id: string; name: string } | null> {
  if (actorMay('desk')) return null;
  foodMay('orders');
  const userId = currentUserId();
  const me = userId
    ? await db.employee.findFirst({
        where: { userId, businessId: s.businessId, status: 'ACTIVE' },
        select: { id: true, name: true },
      })
    : null;
  if (!me) throw new ForbiddenException('Ваш вход не привязан к сотруднику этого ресторана: обратитесь к руководителю');
  return me;
}
