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
} from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
export interface FoodScope {
  organizationId: string;
  businessId: string;
  locationId: string;
  timezone: string;
  currency: string;
}
export function foodMay(permission: Permission) {
  if (!hasSignedInActor() || !actorMay(permission))
    throw new ForbiddenException(accessDeniedMessage(permission));
}
export async function foodScope(db: Pick<DbTx, 'business' | 'location'>): Promise<FoodScope> {
  const organizationId = currentOrganizationId(),
    businessId = currentBusinessId(),
    locationId = currentLocationId();
  if (
    !hasSignedInActor() ||
    !organizationId ||
    !businessId ||
    !locationId ||
    currentVertical() !== 'FOOD_SERVICE'
  )
    throw new ForbiddenException('Выберите бизнес Food Service и филиал');
  const business = await db.business.findFirst({
    where: { id: businessId, organizationId, vertical: 'FOOD_SERVICE', status: 'ACTIVE' },
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
): Promise<T> {
  try {
    return await prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${scope.organizationId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM businesses WHERE id=${scope.businessId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM locations WHERE id=${scope.locationId}::uuid FOR UPDATE`;
      await foodWritable(tx);
      return fn(tx, await foodScope(tx));
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
      throw new ConflictException('Такая запись уже существует');
    throw error;
  }
}
