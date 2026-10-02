import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NEW_PROPERTY_DEFAULTS, createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY, cashBalances } from '@pms/domain';
import { PrismaFinanceRepository } from '../../apps/api/src/finance/finance.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Касса (DATA_MODEL §21) на настоящей схеме: стартовый набор статей, операция с комиссией одной транзакцией,
 * перевод, аннулирование вместе с комиссией, статья чужого объекта (триггер), касса в общей ленте операций
 * с отбором по источнику. Данные вымышленные (ADR-010), после прогона удаляются.
 */
describe.skipIf(!url)('касса: операции, статьи, лента (integration, DATA_MODEL §21)', () => {
  let db: Db;
  let repo: PrismaFinanceRepository;

  async function cleanup() {
    await db.cashOperation.deleteMany({});
    await db.cashCategory.deleteMany({});
  }

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaFinanceRepository({ db } as unknown as PrismaService);
    const property = await db.property.findFirst({
      where: { name: LUXX_APARTS_PROPERTY.name },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    expect(property, 'в тестовой базе нужен объект').toBeTruthy();
    await cleanup();
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  it('пустой справочник статей заполняется стартовым набором (Q-236), повторное чтение набор не множит', async () => {
    const first = await repo.cashCategories();
    expect(first.map((c) => c.name)).toContain('Комиссия банка');
    expect(first.map((c) => c.name)).toContain('Начальный остаток');
    expect(first.map((c) => c.name)).not.toContain('Расходы Хостел №2');
    const second = await repo.cashCategories();
    expect(second).toHaveLength(first.length);
  });

  it('операция с комиссией — две строки одной транзакцией; аннулирование снимает обе; повтор — ошибка', async () => {
    const categories = await repo.cashCategories();
    const fee = categories.find((c) => c.name === 'Комиссия банка')!;
    const id = await repo.createCashOperation({
      kind: 'INCOME',
      method: 'KASPI',
      methodTo: null,
      amountMinor: 100_000n,
      categoryId: categories.find((c) => c.kind === 'INCOME')!.id,
      note: 'тестовое поступление',
      occurredAt: '2031-06-01T06:00:00Z',
      commission: { amountMinor: 950n, categoryId: fee.id },
    });
    const rows = await db.cashOperation.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ kind: 'EXPENSE', relatedId: id, amount: 950n });
    // слагаемые остатков: поступление минус комиссия
    const balances = cashBalances(await repo.cashBalanceSources());
    const kaspi = balances.balances.find((b) => b.method === 'KASPI')!;
    expect(kaspi.balanceMinor).toBe(100_000n - 950n);

    const record = await repo.cashOperationById(id);
    expect(record).toMatchObject({ status: 'COMPLETED', commissionId: rows[1]!.id });
    await repo.voidCashOperation(id);
    const voided = await db.cashOperation.findMany({});
    expect(voided.every((o) => o.status === 'VOIDED')).toBe(true);
    await expect(repo.voidCashOperation(id)).rejects.toThrow(/аннулирована/);
    expect(cashBalances(await repo.cashBalanceSources()).totalMinor).toBe(0n);
  });

  it('статья чужого объекта отвергается базой (триггер), перевод попадает в ленту с отбором по источнику', async () => {
    // чужая статья: объект другой организации через общую цепочку (DATA_MODEL §18, v2.6)
    const org = await db.organization.create({ data: { name: 'Касса чужие' }, select: { id: true } });
    const otherProperty = (
      await db.$transaction((tx) =>
        createPropertyInChain(tx, org.id, { name: 'Касса чужие', ...NEW_PROPERTY_DEFAULTS }),
      )
    ).id;
    const foreign = await db.cashCategory.create({
      data: { propertyId: otherProperty, kind: 'EXPENSE', name: 'Чужая статья' },
    });
    await expect(
      repo.createCashOperation({
        kind: 'EXPENSE',
        method: 'CASH',
        methodTo: null,
        amountMinor: 100n,
        categoryId: foreign.id,
        note: null,
        occurredAt: null,
        commission: null,
      }),
    ).rejects.toThrow(/другому объекту/);

    const transferId = await repo.createCashOperation({
      kind: 'TRANSFER',
      method: 'KASPI',
      methodTo: 'CASH',
      amountMinor: 5_000n,
      categoryId: null,
      note: null,
      occurredAt: '2031-06-02T06:00:00Z',
      commission: null,
    });
    const lenta = await repo.periodOperations('2031-06-01', '2031-06-30', {
      source: 'CASH',
      limit: 50,
    });
    const mine = lenta.rows.find((r) => r.id === transferId);
    expect(mine).toMatchObject({
      kind: 'TRANSFER',
      method: 'KASPI',
      methodTo: 'CASH',
      amountMinor: 5_000n,
      confirmationNumber: null,
    });
    // источник «брони» кассу не отдаёт
    const bookingsOnly = await repo.periodOperations('2031-06-01', '2031-06-30', {
      source: 'RESERVATIONS',
      limit: 50,
    });
    expect(bookingsOnly.rows.find((r) => r.id === transferId)).toBeUndefined();
    // отбор по новому типу
    const transfers = await repo.periodOperations('2031-06-01', '2031-06-30', {
      type: 'TRANSFER',
      limit: 50,
    });
    expect(transfers.rows.map((r) => r.id)).toContain(transferId);

    await db.cashOperation.deleteMany({ where: { id: transferId } });
    await db.cashCategory.delete({ where: { id: foreign.id } });
    const chain = await db.property.findUniqueOrThrow({
      where: { id: otherProperty },
      select: { locationId: true, location: { select: { businessId: true } } },
    });
    await db.property.delete({ where: { id: otherProperty } });
    await db.location.delete({ where: { id: chain.locationId } });
    await db.business.delete({ where: { id: chain.location.businessId } });
    await db.organization.delete({ where: { id: org.id } });
  });
});
