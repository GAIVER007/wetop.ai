import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaUnitsRepository } from '../../apps/api/src/units/units.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { purgeAuditRows } from '../tools/audit-purge';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Предохранители в самой базе — ТЗ аудита 25.09.2026, блок 3 (миграция `20260925000022_integrity_guards`,
 * `plans/security-audit-fixes-2026-09-25.md`).
 *
 * С-4: дубль OTA-брони держал только check-then-act в коде — на гонке два запроса проходили проверку оба.
 * Теперь дубль (property_id, external_id) отвергает UNIQUE; NULL у ручных броней различны, их он не трогает.
 * С-14: отрицательный или нулевой платёж, возврат и разнесение базу устраивали; журнал действий можно было
 * править и чистить любым кодом с DATABASE_URL. Теперь CHECK'и на деньги и триггер «журнал только
 * дописывается» с обходом строго для уборки тестовых данных (set_config в той же транзакции).
 * С-3: блокировка ячейки проверяла проживания до транзакции — гость успевал заселиться между проверкой и
 * вставкой. Теперь createBlock берёт категорийный замок (тот же, что путь брони) и перепроверяет внутри.
 */
describe.skipIf(!url)('предохранители базы: UNIQUE external_id, CHECK деньги, журнал, блокировка (integration)', () => {
  let db: Db;
  const mark = `INTEGRITY-${Date.now().toString(36)}`;

  beforeAll(async () => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    if (!db) return;
    await db.$executeRawUnsafe(`DELETE FROM reservations WHERE confirmation_number LIKE '${mark}%'`);
    await db.$executeRawUnsafe(`DELETE FROM payments WHERE note LIKE '${mark}%'`);
    await purgeAuditRows(db, { entityId: mark });
    await db.$disconnect();
  });

  /** Копия существующей строки со своим id и нужными полями — не зависит от списка NOT NULL колонок */
  async function cloneReservation(confirmation: string, externalId: string | null) {
    await db.$executeRawUnsafe(
      `CREATE TEMP TABLE _clone AS SELECT * FROM reservations LIMIT 1;
       UPDATE _clone SET id = gen_random_uuid(), confirmation_number = '${confirmation}',
         external_id = ${externalId === null ? 'NULL' : `'${externalId}'`};
       INSERT INTO reservations SELECT * FROM _clone;
       DROP TABLE _clone;`,
    );
  }

  it('дубль (property_id, external_id) отвергает база, а не только код; NULL у ручных броней различны', async () => {
    await cloneReservation(`${mark}-A`, `${mark}-OTA-1`);
    await expect(cloneReservation(`${mark}-B`, `${mark}-OTA-1`)).rejects.toThrow(/23505|unique/i);
    // ручные брони без внешнего номера друг другу не мешают
    await cloneReservation(`${mark}-C`, null);
    await cloneReservation(`${mark}-D`, null);
  });

  it('платёж, разнесение и возврат на ноль и в минус отвергает база', async () => {
    const property = await db.property.findFirstOrThrow({ select: { id: true } });
    for (const amount of ['0', '-100']) {
      await expect(
        db.$executeRawUnsafe(
          `INSERT INTO payments (id, property_id, method, amount, currency, note)
           VALUES (gen_random_uuid(), '${property.id}', 'CASH', ${amount}, 'KZT', '${mark}-p')`,
        ),
      ).rejects.toThrow(/23514|check/i);
    }
    const allocation = await db.paymentAllocation.findFirst({
      select: { paymentId: true, folioId: true },
    });
    if (allocation) {
      await expect(
        db.$executeRawUnsafe(
          `INSERT INTO refunds (id, payment_id, folio_id, amount)
           VALUES (gen_random_uuid(), '${allocation.paymentId}', '${allocation.folioId}', 0)`,
        ),
      ).rejects.toThrow(/23514|check/i);
      await expect(
        db.$executeRawUnsafe(
          `UPDATE payment_allocations SET amount = 0
           WHERE payment_id = '${allocation.paymentId}' AND folio_id = '${allocation.folioId}'`,
        ),
      ).rejects.toThrow(/23514|check/i);
    }
  });

  it('журнал действий только дописывается: UPDATE и DELETE отвергаются, уборка проходит с отметкой', async () => {
    await db.auditLog.create({
      data: { entityType: 'Reservation', entityId: mark, action: 'integrity.probe', after: { ok: true } },
    });
    await expect(
      db.$executeRawUnsafe(`UPDATE audit_logs SET action = 'forged' WHERE entity_id = '${mark}'`),
    ).rejects.toThrow(/append-only|дописывается/i);
    await expect(db.auditLog.deleteMany({ where: { entityId: mark } })).rejects.toThrow(
      /append-only|дописывается/i,
    );
    // путь уборки тестовых данных — set_config в той же транзакции (cli-purge-test-data)
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
      await tx.auditLog.deleteMany({ where: { entityId: mark } });
    });
    expect(await db.auditLog.count({ where: { entityId: mark } })).toBe(0);
  });

  it('блокировка перепроверяет проживания внутри транзакции — заселённую ячейку не закрыть', async () => {
    const stay = await db.allocation.findFirstOrThrow({
      where: { reservationItem: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } } },
      select: {
        inventoryUnitId: true,
        startDate: true,
        endDate: true,
        inventoryUnit: { select: { accommodationTypeId: true } },
      },
    });
    const repo = new PrismaUnitsRepository({ db } as PrismaService);
    const day = (d: Date) => d.toISOString().slice(0, 10);
    await expect(
      repo.createBlock(
        { id: stay.inventoryUnitId, accommodationTypeId: stay.inventoryUnit.accommodationTypeId },
        { dateFrom: day(stay.startDate), dateTo: day(stay.endDate), type: 'MAINTENANCE', reason: mark },
        { before: [], after: { probe: mark } },
      ),
    ).rejects.toThrow(/проживание/);
    expect(
      await db.inventoryBlock.count({ where: { inventoryUnitId: stay.inventoryUnitId, reason: mark } }),
    ).toBe(0);
  });

  it('блокировка ждёт категорийный замок брони, а не пролезает мимо него', async () => {
    const unit = await db.inventoryUnit.findFirstOrThrow({
      where: { allocations: { none: {} } },
      select: { id: true, accommodationTypeId: true },
    });
    const other = createPrismaClient(url);
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    let lockTaken!: () => void;
    const taken = new Promise<void>((r) => (lockTaken = r));
    let lockTakenAt = 0;
    // «бронь» держит категорию: тот же ключ, что lockCategories в reservations.repository
    const holder = other.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pms.category:${unit.accommodationTypeId}`}, 0))`;
      lockTakenAt = Date.now();
      lockTaken();
      await held;
    });
    // ждём, пока замок действительно взят: свежее соединение второго клиента в CI открывалось дольше прежних
    // 50 мс, блокировка успевала пройти до замка, и тест падал не по делу (прогон main 03.10.2026)
    await taken;
    const repo = new PrismaUnitsRepository({ db } as PrismaService);
    const block = repo
      .createBlock(
        { id: unit.id, accommodationTypeId: unit.accommodationTypeId },
        { dateFrom: '2031-01-01', dateTo: '2031-01-02', type: 'MAINTENANCE', reason: mark },
        { before: [], after: { probe: mark } },
      )
      .then((id) => ({ id, finishedAt: Date.now() }));
    // пока «бронь» держит категорию, блокировка не проходит
    const early = await Promise.race([block.then(() => 'done'), new Promise((r) => setTimeout(() => r('waiting'), 400))]);
    expect(early).toBe('waiting');
    release();
    const done = await block;
    expect(done.finishedAt).toBeGreaterThan(lockTakenAt);
    await holder;
    await db.inventoryBlock.deleteMany({ where: { reason: mark } });
    await other.$disconnect();
  });
});
