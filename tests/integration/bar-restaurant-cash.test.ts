import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaBarRepository } from '../../apps/api/src/bar/bar.repository';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Деньги бара по направлению (DATA_MODEL §44–§45, ADR-178): бар ресторана продаёт в кассу ресторана и платит
 * поставщику из неё, не уводя способ оплаты в минус; у салона продажи и оплаты закрыты до кассы салона; счёт гостя
 * только у гостиницы. Запросы от имени выбранного филиала, как из стойки. Всё вымышленное (ADR-010), метка прогона.
 */
describe('бар: деньги по направлению филиала (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Бар проверяется только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const repo = new PrismaBarRepository(prisma as never);
  const tag = randomUUID().slice(0, 8);
  const user = randomUUID();
  const branches: Record<'FOOD_SERVICE' | 'BEAUTY', { org: string; business: string; location: string }> = {
    FOOD_SERVICE: { org: randomUUID(), business: randomUUID(), location: randomUUID() },
    BEAUTY: { org: randomUUID(), business: randomUUID(), location: randomUUID() },
  };
  const as = <T>(vertical: 'FOOD_SERVICE' | 'BEAUTY', fn: () => Promise<T>) => {
    const b = branches[vertical];
    return withSignedInUser(
      { userId: user, organizationId: b.org, scope: 'LOCATION', businessId: b.business, locationId: b.location, vertical },
      fn,
    );
  };
  beforeAll(async () => {
    await prisma.db.user.create({ data: { id: user, email: `bar-cash-${tag}@example.invalid` } });
    for (const [vertical, b] of Object.entries(branches)) {
      await prisma.db.organization.create({ data: { id: b.org, name: `Бар ${vertical} ${tag}` } });
      await prisma.db.business.create({
        data: { id: b.business, organizationId: b.org, name: `Бар ${vertical} ${tag}`, vertical: vertical as never },
      });
      await prisma.db.location.create({
        data: { id: b.location, businessId: b.business, name: `Бар ${vertical} ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' },
      });
    }
  });
  afterAll(async () => prisma.onModuleDestroy());

  /** Товар с проведённым приходом 10 шт по 300 ₸, цена продажи 600 ₸ */
  const stocked = async (vertical: 'FOOD_SERVICE' | 'BEAUTY') =>
    as(vertical, async () => {
      const supplier = (await repo.createSupplier({ name: `Поставщик ${tag}`, phone: null, email: null, details: null })) as { id: string };
      const product = (await repo.createProduct({
        code: `BC-${tag}`, name: `Тоник ${tag}`, categoryId: null, barcode: null, unitsPerPackage: 1,
        markupBasis: 10000, salePriceMinor: 60000n, minimumStockUnits: 0n,
      })) as { id: string };
      const receipt = (await repo.createReceipt({
        supplierId: supplier.id, documentNumber: `BC-${tag}`, documentDate: '2026-10-13', receivedDate: '2026-10-13',
        currency: 'KZT', note: null, lines: [{ productId: product.id, quantityUnits: 10n, unitCostMinor: 30000n, markupBasis: 10000n }],
      } as never)) as { id: string };
      await repo.postReceipt(receipt.id);
      return { product: product.id, receipt: receipt.id };
    });

  it('ресторан: продажа приходом кассы ресторана, оплата поставщику не больше остатка, отмена аннулирует приход', async () => {
    const { product, receipt } = await stocked('FOOD_SERVICE');
    const sale = await as('FOOD_SERVICE', () =>
      repo.sellRetail({ productId: product, quantityUnits: 2n, method: 'CASH', idempotencyKey: `sale-${tag}` }),
    );
    expect(sale).toMatchObject({ kind: 'posted', revenueMinor: '120000' });
    const location = branches.FOOD_SERVICE.location;
    const income = await prisma.db.restaurantCashOperation.findMany({ where: { locationId: location, kind: 'INCOME' } });
    expect(income.map((o) => [o.method, o.amount, o.status])).toEqual([['CASH', 120000n, 'COMPLETED']]);
    const barSale = await prisma.db.barSale.findFirstOrThrow({ where: { locationId: location } });
    expect([barSale.propertyId, barSale.cashOperationId, barSale.restaurantCashOperationId]).toEqual([null, null, income[0]!.id]);
    // в кассе 1 200 ₸ наличными: оплатить 3 000 ₸ нельзя, 1 000 ₸ можно
    expect(
      await as('FOOD_SERVICE', () => repo.payReceipt(receipt, { amountMinor: 300000n, method: 'CASH', note: null , idempotencyKey: randomUUID() })),
    ).toEqual({ kind: 'insufficient_cash', available: 120000n });
    expect(
      await as('FOOD_SERVICE', () => repo.payReceipt(receipt, { amountMinor: 100000n, method: 'CASH', note: null , idempotencyKey: randomUUID() })),
    ).toMatchObject({ kind: 'paid', paidAmount: '100000' });
    const expense = await prisma.db.restaurantCashOperation.findFirstOrThrow({ where: { locationId: location, kind: 'EXPENSE' } });
    expect(expense.amount).toBe(100000n);
    // Правило владельца 13.10.2026: долг поставщику уменьшают только завершённые операции кассы, ресторанной тоже
    expect(await as('FOOD_SERVICE', () => repo.report())).toMatchObject({ currency: 'KZT', supplierPaidMinor: '100000', supplierDebtMinor: '200000' });
    await prisma.db.restaurantCashOperation.update({ where: { id: expense.id }, data: { status: 'VOIDED', voidedAt: new Date() } });
    expect(await as('FOOD_SERVICE', () => repo.report())).toMatchObject({ supplierPaidMinor: '0', supplierDebtMinor: '300000' });
    // Повтор тем же ключом ищется по филиалу (D-KEY, §44): исходная продажа, второй нет
    expect(
      await as('FOOD_SERVICE', () => repo.sellRetail({ productId: product, quantityUnits: 2n, method: 'CASH', idempotencyKey: `sale-${tag}` })),
    ).toMatchObject({ kind: 'posted', id: barSale.id, status: 'POSTED' });
    expect(await prisma.db.barSale.count({ where: { locationId: location } })).toBe(1);
    // счёт гостя только у гостиницы
    expect(
      await as('FOOD_SERVICE', () =>
        repo.sellToFolio({ folioId: randomUUID(), productId: product, quantityUnits: 1n, idempotencyKey: `folio-${tag}` }),
      ),
    ).toEqual({ kind: 'no_folio' });
    // ответы журналов уходят в JSON целиком: вложенный товар не должен нести BigInt (иначе HTTP 500 на /bar/sales и /bar/movements)
    for (const rows of [await as('FOOD_SERVICE', () => repo.sales()), await as('FOOD_SERVICE', () => repo.movements())])
      expect(() => JSON.stringify(rows)).not.toThrow();
    expect(await as('FOOD_SERVICE', () => repo.reverseSale(barSale.id, true, 'Ошибка кассира'))).toMatchObject({ kind: 'reversed' });
    const voided = await prisma.db.restaurantCashOperation.findUniqueOrThrow({ where: { id: income[0]!.id } });
    expect(voided.status).toBe('VOIDED');
    // повтор после отмены возвращает отменённую исходную продажу, а не проводит новую
    expect(
      await as('FOOD_SERVICE', () => repo.sellRetail({ productId: product, quantityUnits: 2n, method: 'CASH', idempotencyKey: `sale-${tag}` })),
    ).toMatchObject({ kind: 'posted', id: barSale.id, status: 'REVERSED' });
  });

  it('салон: продажа и оплата поставщику через кассу филиала салона (§48), счёт гостя закрыт', async () => {
    const { product, receipt } = await stocked('BEAUTY');
    const stock = (await as('BEAUTY', () => repo.stock())) as Array<{ id: string; availableUnits: string }>;
    expect(stock.find((row) => row.id === product)?.availableUnits).toBe('10');
    expect(
      await as('BEAUTY', () => repo.sellRetail({ productId: product, quantityUnits: 1n, method: 'CASH', idempotencyKey: `b-${tag}` })),
    ).toMatchObject({ kind: 'posted', revenueMinor: '60000' });
    const location = branches.BEAUTY.location;
    const income = await prisma.db.restaurantCashOperation.findFirstOrThrow({ where: { locationId: location, kind: 'INCOME' } });
    expect([income.method, income.amount]).toEqual(['CASH', 60000n]);
    expect(await as('BEAUTY', () => repo.payReceipt(receipt, { amountMinor: 70000n, method: 'CASH', note: null , idempotencyKey: randomUUID() }))).toEqual({
      kind: 'insufficient_cash',
      available: 60000n,
    });
    expect(await as('BEAUTY', () => repo.payReceipt(receipt, { amountMinor: 50000n, method: 'CASH', note: null , idempotencyKey: randomUUID() }))).toMatchObject({
      kind: 'paid',
    });
    expect(
      await as('BEAUTY', () => repo.sellToFolio({ folioId: randomUUID(), productId: product, quantityUnits: 1n, idempotencyKey: `bf-${tag}` })),
    ).toEqual({ kind: 'no_folio' });
  });

  it('касса филиала: салон да, гостиница нет; платёж заказа только у ресторана', async () => {
    const hotel = await prisma.db.location.findFirst({ where: { business: { vertical: 'HOSPITALITY' } } });
    if (hotel)
      await expect(
        prisma.db.restaurantCashOperation.create({ data: { locationId: hotel.id, kind: 'INCOME', method: 'CASH', amount: 100n, currency: 'KZT' } }),
      ).rejects.toThrow(/Branch cash location required/);
    const op = await prisma.db.restaurantCashOperation.create({
      data: { locationId: branches.BEAUTY.location, kind: 'INCOME', method: 'CARD_TERMINAL', amount: 100n, currency: 'KZT', note: 'Синтетика' },
    });
    expect(op.locationId).toBe(branches.BEAUTY.location);
  });

  it('филиал ресторана не видит бар салона и наоборот', async () => {
    const food = (await as('FOOD_SERVICE', () => repo.products())) as Array<{ locationId: string }>;
    const beauty = (await as('BEAUTY', () => repo.products())) as Array<{ locationId: string }>;
    expect(food.every((row) => row.locationId === branches.FOOD_SERVICE.location)).toBe(true);
    expect(beauty.every((row) => row.locationId === branches.BEAUTY.location)).toBe(true);
  });
});
