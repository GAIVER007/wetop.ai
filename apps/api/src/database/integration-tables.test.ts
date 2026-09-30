import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { databaseTenant, withServiceDatabase, withSignedInUser } from '../auth/request-context';
import { integrationTables } from './integration-tables';

/**
 * SEC-1b, стадия B (Q-222, решение владельца 30.09.2026): у роли запросов организации `wetop_app` не будет прав на
 * `external_events`, `system_incidents` и `channel_outbox` (кроме `INSERT` в очередь). Запросы к ним идут через
 * `integrationTables(db)`: каждый такой запрос выполняется служебной ролью, а остальная работа запроса — на `wetop_app`
 * с RLS. Здесь проверяется именно переключение роли: по `databaseTenant()`, которым `TenantPool` выбирает пул.
 */
function fakeDb() {
  const seen: Array<{ model: string; op: string; tenant: string | null }> = [];
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_t, op: string) => async (args: unknown) => {
          seen.push({ model: name, op, tenant: databaseTenant() });
          return { args };
        },
      },
    );
  const db = {
    externalEvent: model('externalEvent'),
    systemIncident: model('systemIncident'),
    channelOutbox: model('channelOutbox'),
    property: model('property'),
  };
  return { db, seen };
}

describe('ворота к данным интеграции: запрос идёт служебной ролью, остальное — организацией', () => {
  it('запрос человека организации: три таблицы — без организации (служебный пул), после — снова организация', async () => {
    const { db, seen } = fakeDb();
    await withSignedInUser({ userId: 'u1', organizationId: 'org-a' }, async () => {
      expect(databaseTenant()).toBe('org-a');
      const t = integrationTables(db as never);
      await t.externalEvent.findFirst({ where: { provider: 'x' } });
      await t.systemIncident.updateMany({ where: {}, data: {} });
      await t.channelOutbox.count({ where: {} });
      expect(databaseTenant()).toBe('org-a');
      await (db as never as { property: { findFirst(): Promise<unknown> } }).property.findFirst();
    });
    expect(seen).toEqual([
      { model: 'externalEvent', op: 'findFirst', tenant: null },
      { model: 'systemIncident', op: 'updateMany', tenant: null },
      { model: 'channelOutbox', op: 'count', tenant: null },
      { model: 'property', op: 'findFirst', tenant: 'org-a' },
    ]);
  });

  it('аргументы и результат проходят как есть; автор и организация запроса сохраняются для остального кода', async () => {
    const { db } = fakeDb();
    await withSignedInUser({ userId: 'u1', organizationId: 'org-a' }, async () => {
      const args = { where: { provider: 'channex' } };
      const out = (await integrationTables(db as never).externalEvent.findMany(
        args as never,
      )) as unknown as {
        args: unknown;
      };
      expect(out.args).toBe(args);
    });
  });

  it('служебный вызывающий (нет организации) остаётся служебным', async () => {
    const { db, seen } = fakeDb();
    await integrationTables(db as never).channelOutbox.findMany({} as never);
    await withServiceDatabase(() =>
      integrationTables(db as never).channelOutbox.findMany({} as never),
    );
    expect(seen.map((s) => s.tenant)).toEqual([null, null]);
  });

  it('модель, не входящая в ворота, недоступна: типы и объект не отдают лишнего', () => {
    const { db } = fakeDb();
    expect(Object.keys(integrationTables(db as never)).sort()).toEqual([
      'channelOutbox',
      'externalEvent',
      'systemIncident',
    ]);
  });
});
