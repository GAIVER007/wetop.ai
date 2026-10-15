import { ConflictException, ForbiddenException } from '@nestjs/common';
import { accessDeniedMessage, canWrite, siteBuilderAccess, siteBuilderDenied, type ExtensionAccess, type Permission } from '@pms/domain';
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

/** Лицензия конструктора филиала (MKT9.2): строка `site_builder_entitlements` и срок по часам сервера */
export async function siteBuilderAccessIn(tx: DbTx, locationId: string, now: Date = new Date()): Promise<{
  access: ExtensionAccess;
  status: 'TRIAL' | 'ACTIVE' | 'OFF' | null;
  activeUntil: Date | null;
}> {
  const row = await tx.siteBuilderEntitlement.findUnique({ where: { locationId }, select: { status: true, activeUntil: true } });
  return { access: siteBuilderAccess(row, now), status: row?.status ?? null, activeUntil: row?.activeUntil ?? null };
}

/** Перепроверка внутри транзакции под замком: бизнес и филиал ещё действуют, организация не только для чтения */
async function recheck(tx: DbTx, scope: SiteScope, write: boolean, license: boolean): Promise<void> {
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
  if (!license) return;
  // MKT9.2: без действующей лицензии филиала конструктор только читается; проверка в той же транзакции, что запись
  const { access } = await siteBuilderAccessIn(tx, scope.locationId);
  if (access !== 'active') throw new ForbiddenException(siteBuilderDenied(access));
}

/**
 * Работа с сайтом филиала в одной транзакции. Запись держит филиал `FOR UPDATE` (две вкладки не заведут два сайта и
 * не поставят две версии одной ревизии), организацию и бизнес `FOR SHARE`, как Food (`food-service/scope.ts`).
 *
 * MKT9.2: запись по умолчанию требует действующей лицензии конструктора филиала (403 `SITE_BUILDER_NOT_ENABLED` или
 * `SITE_BUILDER_EXPIRED`). Отказываются от неё явно только действия, которые ничего не создают и не тратят ИИ:
 * пауза, архив и выбор сайта брони (`{ license: false }`)
 */
export async function siteTransaction<T>(
  prisma: PrismaService,
  scope: SiteScope,
  write: boolean,
  fn: (tx: DbTx) => Promise<T>,
  options: { license?: boolean } = {},
): Promise<T> {
  return prisma.db.$transaction(async (tx) => {
    if (write) {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id=${scope.organizationId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM businesses WHERE id=${scope.businessId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM locations WHERE id=${scope.locationId}::uuid FOR UPDATE`;
    }
    await recheck(tx, scope, write, write && options.license !== false);
    return fn(tx);
  });
}

/** Ранняя проверка записи и лицензии до дорогой работы (обработка картинки, сбор брифа); итог решает транзакция записи */
export function assertSiteBuilderWrite(prisma: PrismaService, scope: SiteScope): Promise<void> {
  return siteTransaction(prisma, scope, true, async () => undefined);
}
