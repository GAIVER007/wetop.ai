import type { Db } from '@pms/database';
import { withServiceDatabase } from '../auth/request-context';

/**
 * Данные интеграции — `external_events`, `system_incidents`, `channel_outbox` (SEC-1b, стадия B, Q-222; решение владельца
 * 30.09.2026, ADR-124). Роли запросов организации `wetop_app` прав на них не останется, кроме `INSERT` в `channel_outbox`
 * (очередь пишется внутри транзакции команды, `ratesChanged(…, tx)`). Всё остальное — чтение, правка, удаление — идёт через
 * эти ворота: запрос выполняется служебной ролью, а остальная работа запроса остаётся на `wetop_app` с RLS. Запрос человека
 * целиком на служебное соединение не переводится.
 *
 * Ограничения, которые нельзя обойти внутри ворот:
 * - внутри транзакции, начатой под организацией, соединение не меняется: такие места выносят из транзакции или решают отдельно
 *   (обработка входящих ревизий, `reservations.repository.ts`, Q-225);
 * - фильтр по объекту остаётся в самих запросах вызывающего и должен браться из выбранного сервером объекта, а не из запроса.
 *
 * Обращения к этим трём моделям мимо ворот запрещены тестом `integration-tables.guard.test.ts`.
 */
export type IntegrationTables = Pick<Db, 'externalEvent' | 'systemIncident' | 'channelOutbox'>;

function viaServiceRole<M extends object>(model: M): M {
  return new Proxy(model, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value !== 'function') return value;
      // Запрос Prisma ленивый: `withServiceDatabase` ждёт его внутри служебного контекста (request-context.ts, `runAwaited`)
      return (...args: unknown[]) =>
        withServiceDatabase(
          async () => await (value as (...a: unknown[]) => unknown).apply(target, args),
        );
    },
  });
}

export function integrationTables(db: Db): IntegrationTables {
  return {
    externalEvent: viaServiceRole(db.externalEvent),
    systemIncident: viaServiceRole(db.systemIncident),
    channelOutbox: viaServiceRole(db.channelOutbox),
  };
}

/** То же для сырого SQL по этим таблицам (`$queryRaw`/`$executeRaw`) */
export function onIntegrationTables<T>(fn: () => Promise<T>): Promise<T> {
  return withServiceDatabase(fn);
}
