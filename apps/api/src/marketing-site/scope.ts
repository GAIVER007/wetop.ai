import { ConflictException, ForbiddenException } from '@nestjs/common';
import { accessDeniedMessage, canWrite, type Permission } from '@pms/domain';
import type { DbTx } from '@pms/database';
import {
  actorMay,
  currentBusinessId,
  currentLocationId,
  currentOrganizationId,
  currentScope,
  currentVertical,
  hasSignedInActor,
} from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';

/**
 * Строгий scope управления сайтом (MKT3, `docs/marketing/README.md` §5, ADR-149 п. 9). Филиал берётся только из
 * указателя, который `AuthorInterceptor` уже проверил в организации вошедшего; тело запроса филиал не выбирает. Отката в
 * организацию, «первый филиал» и «первый объект» здесь нет:
 * - указатель прислан, но сервер его не подтвердил (устаревший, чужой, архивный) → 403;
 * - указателя нет, выбрана организация или только бизнес → 409 «Выберите филиал»;
 * - бизнес выбора не гостиница → 403 (v0 только Hospitality).
 */
export interface SiteScope {
  organizationId: string;
  businessId: string;
  locationId: string;
}

export const CHOOSE_LOCATION = 'Выберите филиал';

export function siteScope(pointerSent: boolean, permission: Permission = 'settings'): SiteScope {
  if (!hasSignedInActor() || !actorMay(permission)) throw new ForbiddenException(accessDeniedMessage(permission));
  const organizationId = currentOrganizationId();
  const businessId = currentBusinessId();
  const locationId = currentLocationId();
  const scope = currentScope();
  if (scope !== 'LOCATION' || !organizationId || !businessId || !locationId) {
    if (scope !== 'BUSINESS' && pointerSent)
      throw new ForbiddenException('Выбранный филиал недоступен: выберите филиал заново');
    throw new ConflictException(CHOOSE_LOCATION);
  }
  if (currentVertical() !== 'HOSPITALITY')
    throw new ForbiddenException('Сайт и SEO пока доступны только гостиницам');
  return { organizationId, businessId, locationId };
}

/** Перепроверка внутри транзакции под замком: бизнес и филиал ещё действуют, организация не только для чтения */
async function recheck(tx: DbTx, scope: SiteScope, write: boolean): Promise<void> {
  const business = await tx.business.findFirst({
    where: { id: scope.businessId, organizationId: scope.organizationId, status: 'ACTIVE', vertical: 'HOSPITALITY' },
    select: { id: true },
  });
  const location = await tx.location.findFirst({
    where: { id: scope.locationId, businessId: scope.businessId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!business || !location) throw new ForbiddenException('Выбранный филиал недоступен: выберите филиал заново');
  if (!write) return;
  const org = await tx.organization.findUnique({
    where: { id: scope.organizationId },
    select: { status: true, trialEndsAt: true },
  });
  if (!org || !canWrite(org.status, org.trialEndsAt, new Date()))
    throw new ForbiddenException('Организация доступна только для чтения');
}

/**
 * Работа с сайтом филиала в одной транзакции. Запись держит филиал `FOR UPDATE` (две вкладки не заведут два сайта и
 * не поставят две версии одной ревизии), организацию и бизнес `FOR SHARE`, как Food (`food-service/scope.ts`).
 */
export async function siteTransaction<T>(
  prisma: PrismaService,
  scope: SiteScope,
  write: boolean,
  fn: (tx: DbTx) => Promise<T>,
): Promise<T> {
  return prisma.db.$transaction(async (tx) => {
    if (write) {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${scope.organizationId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM businesses WHERE id=${scope.businessId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM locations WHERE id=${scope.locationId}::uuid FOR UPDATE`;
    }
    await recheck(tx, scope, write);
    return fn(tx);
  });
}
