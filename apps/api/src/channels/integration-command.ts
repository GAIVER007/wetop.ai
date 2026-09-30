import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { databaseTenant, withServiceDatabase } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
import { resolveIntegrationProperty } from './integration-property';
import { CHANNEL_OPERATOR_FOREIGN_MESSAGE } from './operator-access';

export const FOREIGN_CHANNEX_PROPERTY =
  'Этот объект менеджера каналов не относится к подключённой гостинице: выбрать можно только объект из её сопоставлений.';

/**
 * Интеграционная команда (Q-225, вариант (а\*), ADR-124): разбор входящих ревизий Channex — запись события, бронь и итог
 * в одной транзакции (ADR-007) — идёт служебной ролью базы, потому что `wetop_app` не должна трогать `external_events`.
 * Служебная роль получает не запрос человека, а эту команду:
 *
 * 1. вход, право «каналы продаж» и «только чтение» проверили до вызова (защитник маршрута, интерсептор оператора, действия
 *    помощника) — на роли организации;
 * 2. здесь, всё ещё на роли организации, объект интеграции выбирает сервер (`INTEGRATION_PROPERTY_ID`, SEC-2), а не запрос;
 *    он должен принадлежать организации вошедшего, иначе отказ;
 * 3. идентификатор объекта Channex из запроса не доверенный вход: он должен быть в сопоставлениях именно этого объекта;
 * 4. только после этого операция целиком уходит на служебную роль. Транзакция внутри неё начинается уже на служебном
 *    соединении: внутри начатой транзакции соединение не меняется (TX_TRAP, `plans/sec1b-stage-b-2026-09-30.md`).
 *
 * Фоновые пути (опрос по таймеру, вебхук, сторож, главный администратор чужой организации) организации не имеют и уже идут
 * служебной ролью: проверять нечего, команда их не меняет. Вложенный вызов внутри команды повторно не проверяется.
 */
export async function runIntegrationCommand<T>(
  prisma: PrismaService,
  channexPropertyId: string | undefined,
  run: (channexPropertyId: string | undefined) => Promise<T>,
): Promise<T> {
  const tenant = databaseTenant();
  if (tenant === null) return run(channexPropertyId);

  // Вопрос про всю установку — служебной ролью: под ролью организации чужие объекты и сопоставления не видны (RLS §17)
  const { property, providerIds } = await withServiceDatabase(async () => {
    const found = await resolveIntegrationProperty(prisma.db);
    if (!found) return { property: null, providerIds: [] as string[] };
    const rows = await prisma.db.channelMapping.findMany({
      where: { propertyId: found.id, provider: 'channex' },
      select: { providerPropertyId: true },
    });
    const ids = rows.map((r) => r.providerPropertyId).filter((id): id is string => Boolean(id));
    return { property: found, providerIds: ids };
  });

  if (!property || property.organizationId !== tenant)
    throw new ForbiddenException(CHANNEL_OPERATOR_FOREIGN_MESSAGE);
  if (channexPropertyId !== undefined && !providerIds.includes(channexPropertyId))
    throw new BadRequestException(FOREIGN_CHANNEX_PROPERTY);

  return withServiceDatabase(() => run(channexPropertyId));
}
