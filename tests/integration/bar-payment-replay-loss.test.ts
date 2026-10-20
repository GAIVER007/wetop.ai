import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaBarRepository } from '../../apps/api/src/bar/bar.repository';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Решения владельца 16.10.2026 (ADR-186), перенос смысла PR #279 на бар филиала:
 * M6: оплата поставщику с тем же ключом повтора возвращает первую оплату, деньги не уходят дважды;
 * M9: себестоимость продажи, отменённой без возврата на склад, попадает в списание отчёта.
 * Ресторанный филиал, касса ресторана, всё вымышленное (ADR-010).
 */
describe('бар: повтор оплаты поставщику и потеря при отмене без склада (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Бар проверяется только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const repo = new PrismaBarRepository(prisma as never);
  const tag = randomUUID().slice(0, 8);
  const user = randomUUID();
  const org = randomUUID();
  const business = randomUUID();
  const location = randomUUID();
  const as = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: user, organizationId: org, scope: 'LOCATION', businessId: business, locationId: location, vertical: 'FOOD_SERVICE' },
      fn,
    );
  beforeAll(async () => {
    await prisma.db.user.create({ data: { id: user, email: `bar-replay-${tag}@example.invalid` } });
    await prisma.db.organization.create({ data: { id: org, name: `Бар повтор ${tag}` } });
    await prisma.db.business.create({ data: { id: business, organizationId: org, name: `Бар повтор ${tag}`, vertical: 'FOOD_SERVICE' } });
    await prisma.db.location.create({ data: { id: location, businessId: business, name: `Филиал ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
  });
  afterAll(async () => prisma.onModuleDestroy());

  /** Товар с проведённым приходом 10 шт по 300 ₸ (долг 3 000 ₸), цена продажи 600 ₸ */
  const stocked = async (n: string) =>
    as(async () => {
      const supplier = (await repo.createSupplier({ name: `Поставщик ${tag}-${n}`, phone: null, email: null, details: null })) as { id: string };
      const product = (await repo.createProduct({
        code: `RP-${tag}-${n}`, name: `Тоник ${tag}-${n}`, categoryId: null, barcode: null, unitsPerPackage: 1,
        markupBasis: 10000, salePriceMinor: 60000n, minimumStockUnits: 0n,
      })) as { id: string };
      const receipt = (await repo.createReceipt({
        supplierId: supplier.id, documentNumber: `RP-${tag}-${n}`, documentDate: '2026-10-16', receivedDate: '2026-10-16',
        currency: 'KZT', note: null, lines: [{ productId: product.id, quantityUnits: 10n, unitCostMinor: 30000n, markupBasis: 10000n }],
      } as never)) as { id: string };
      await repo.postReceipt(receipt.id);
      return { product: product.id, receipt: receipt.id };
    });

  it('M6: тот же ключ возвращает первую оплату; другой запрос с тем же ключом отклоняется', async () => {
    const { product, receipt } = await stocked('m6');
    // 5 продаж по 600 ₸: в кассе ресторана 3 000 ₸ наличными на оплату поставщику
    await as(() => repo.sellRetail({ productId: product, quantityUnits: 5n, method: 'CASH', idempotencyKey: `s-${tag}` }));
    const key = randomUUID();
    const first = await as(() => repo.payReceipt(receipt, { amountMinor: 100000n, method: 'CASH', note: null, idempotencyKey: key }));
    expect(first).toMatchObject({ kind: 'paid', paidAmount: '100000', dueAmount: '200000' });
    // двойной клик или повтор после обрыва сети: та же оплата, второй нет
    expect(await as(() => repo.payReceipt(receipt, { amountMinor: 100000n, method: 'CASH', note: null, idempotencyKey: key }))).toMatchObject({
      kind: 'paid',
      id: (first as { id: string }).id,
      paidAmount: '100000',
    });
    expect(await prisma.db.barSupplierPayment.count({ where: { receiptId: receipt } })).toBe(1);
    expect(await prisma.db.restaurantCashOperation.count({ where: { locationId: location, kind: 'EXPENSE' } })).toBe(1);
    // тот же ключ для другой суммы: отказ, денег не трогаем
    await expect(
      as(() => repo.payReceipt(receipt, { amountMinor: 50000n, method: 'CASH', note: null, idempotencyKey: key })),
    ).rejects.toThrow(/Ключ повтора/);
    // оплата остатка целиком и её повтор: повтор не превращается в «переплату»
    const rest = randomUUID();
    const full = await as(() => repo.payReceipt(receipt, { amountMinor: 200000n, method: 'CASH', note: null, idempotencyKey: rest }));
    expect(full).toMatchObject({ kind: 'paid', dueAmount: '0' });
    expect(await as(() => repo.payReceipt(receipt, { amountMinor: 200000n, method: 'CASH', note: null, idempotencyKey: rest }))).toMatchObject({
      kind: 'paid',
      id: (full as { id: string }).id,
    });
    expect(await prisma.db.barSupplierPayment.count({ where: { receiptId: receipt } })).toBe(2);
  });

  it('M9: отмена без возврата на склад уводит себестоимость в списание, с возвратом нет', async () => {
    const { product } = await stocked('m9');
    const before = BigInt(((await as(() => repo.report())) as { writeOffMinor: string }).writeOffMinor);
    const lost = (await as(() => repo.sellRetail({ productId: product, quantityUnits: 2n, method: 'CASH', idempotencyKey: `l-${tag}` }))) as { id: string };
    const back = (await as(() => repo.sellRetail({ productId: product, quantityUnits: 1n, method: 'CASH', idempotencyKey: `b-${tag}` }))) as { id: string };
    await as(() => repo.reverseSale(lost.id, false, 'Разлили'));
    await as(() => repo.reverseSale(back.id, true, 'Ошибка кассира'));
    // 2 шт по 300 ₸ закупки потеряны: 600 ₸ в списании; возвращённая на склад продажа списанием не считается
    expect(BigInt(((await as(() => repo.report())) as { writeOffMinor: string }).writeOffMinor) - before).toBe(60000n);
  });
});
