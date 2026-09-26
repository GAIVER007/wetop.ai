import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { AuditService } from '../../apps/api/src/audit/audit.module';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { purgeAuditRows } from '../tools/audit-purge';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Список журнала считает сводку в базе и не тянет снимки брони (волна 4 плана wetop-domain).
 *
 * Модульный тест проверяет форму запроса, но не то, что SQL выполняется: `jsonb_typeof`, `->>` и
 * фильтр по массиву действий должны отработать на живом Postgres. Тест пишет только свои строки
 * с меткой в `entity_id` и удаляет их за собой.
 */
describe.skipIf(!url)('журнал действий: список (integration, DATABASE_URL required)', () => {
  let db: Db;
  let service: AuditService;
  const mark = `INTEGRATION-AUDIT-${Date.now().toString(36)}`;
  const number = `${mark}-20260917-AAA111`;
  // снимок «как на массовой правке цен»: из него наружу должна ехать одна короткая строка
  const bigSnapshot = { confirmationNumber: number, changes: Array.from({ length: 500 }, (_, i) => ({ i, price: '1540000' })) };

  beforeAll(async () => {
    db = createPrismaClient(url);
    service = new AuditService({ db } as PrismaService);
    await db.auditLog.createMany({
      data: [
        { id: randomUUID(), entityType: 'Reservation', entityId: mark, action: 'reservation.create', after: bigSnapshot },
        { id: randomUUID(), entityType: 'InventoryUnit', entityId: mark, action: 'unit.block', before: { code: `${mark}-B07` } },
        { id: randomUUID(), entityType: 'Property', entityId: mark, action: 'exely.sync', after: { ok: true } },
      ],
    });
  });

  afterAll(async () => {
    if (db) {
      await purgeAuditRows(db, { entityId: mark });
      await db.$disconnect();
    }
  });

  it('сводка берётся из снимка: номер брони из after, код ячейки из before', async () => {
    const rows = await service.list({ limit: 500, system: true });
    const mine = rows.filter((r) => r.entityId === mark);
    expect(mine.map((r) => r.subject).sort()).toEqual([`${mark}-B07`, null, number].sort());
    // в строке списка снимков нет — только короткие поля, доступность цели и автор (имя из `users`, ADR-023)
    expect(Object.keys(mine[0]!).sort()).toEqual(
      [
        'action',
        'at',
        'author',
        'entityId',
        'entityType',
        'id',
        'subject',
        'targetAvailable',
      ].sort(),
    );
    // строки без автора — система: у этих записей `user_id` пуст
    expect(mine.map((r) => r.author)).toEqual([null, null, null]);
  });

  it('поиск идёт по снимкам всей истории', async () => {
    const found = await service.list({ limit: 500, q: number });
    expect(found.map((r) => r.subject)).toContain(number);
    const byUnit = await service.list({ limit: 500, q: `${mark}-B07` });
    expect(byUnit.map((r) => r.subject)).toContain(`${mark}-B07`);
  });

  it('служебные строки синхронизации Exely по умолчанию скрыты', async () => {
    const withSystem = await service.list({ limit: 500, system: true });
    const without = await service.list({ limit: 500 });
    expect(withSystem.filter((r) => r.entityId === mark && r.action === 'exely.sync')).toHaveLength(1);
    expect(without.filter((r) => r.entityId === mark && r.action === 'exely.sync')).toHaveLength(0);
  });
});
