import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { currentIntegrationPropertyId, databaseTenant, withIntegrationPropertyScope, withServiceDatabase } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
import { propertyRef } from '../database/property-ref';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { localPropertyForChannex, mappedChannexProperties } from './mapped-properties';
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
  if (currentIntegrationPropertyId()) return run(channexPropertyId);
  const tenant = databaseTenant();
  if (tenant !== null) {
    const property = await propertyRef(prisma.db, LUXX_APARTS_PROPERTY.name);
    if (property.organizationId !== tenant)
      throw new ForbiddenException(CHANNEL_OPERATOR_FOREIGN_MESSAGE);
    const mappings = await withServiceDatabase(() => mappedChannexProperties(prisma.db));
    const selected = mappings.find((row) => row.localPropertyId === property.id);
    if (!selected) throw new BadRequestException('Для выбранного филиала Channex не подключён');
    if (channexPropertyId && channexPropertyId !== selected?.providerPropertyId)
      throw new BadRequestException(FOREIGN_CHANNEX_PROPERTY);
    return withServiceDatabase(() =>
      withIntegrationPropertyScope(property.id, () => run(selected?.providerPropertyId)),
    );
  }
  const mappings = await mappedChannexProperties(prisma.db);
  const selected = channexPropertyId
    ? await localPropertyForChannex(prisma.db, channexPropertyId)
    : mappings.length === 1 ? mappings[0]!.localPropertyId : null;
  if (!selected) throw new BadRequestException('Укажите сопоставленный объект Channex');
  const providerId = channexPropertyId ?? mappings[0]!.providerPropertyId;
  return withIntegrationPropertyScope(selected, () => run(providerId));
}
