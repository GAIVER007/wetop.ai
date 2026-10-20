import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaBarRepository } from '../../apps/api/src/bar/bar.repository';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Охрана владения бара без объекта гостиницы (DATA_MODEL §44, §45, §48; план бара этап 5): строки прихода, партии,
 * движения, строки продажи и связи с кассой филиала не ссылаются на другой филиал. Оба филиала одной организации
 * (ресторан и салон), поэтому RLS здесь не помогает: держат только триггеры. Всё вымышленное (ADR-010).
 */
describe('бар: дочерние строки не пересекают филиалы (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Бар проверяется только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const repo = new PrismaBarRepository(prisma as never);
  const db = prisma.db;
  const tag = randomUUID().slice(0, 8);
  const user = randomUUID();
  const org = randomUUID();
  const branch = {
    FOOD_SERVICE: { business: randomUUID(), location: randomUUID() },
    BEAUTY: { business: randomUUID(), location: randomUUID() },
  };
  type V = keyof typeof branch;
  const as = <T>(v: V, fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: user, organizationId: org, scope: 'LOCATION', businessId: branch[v].business, locationId: branch[v].location, vertical: v },
      fn,
    );
  const own: Record<V, { product: string; receipt: string; line: string; lot: string; sale: string; cash: string }> = {} as never;

  beforeAll(async () => {
    await db.user.create({ data: { id: user, email: `bar-children-${tag}@example.invalid` } });
    await db.organization.create({ data: { id: org, name: `Филиалы ${tag}`, status: 'ACTIVE' } });
    for (const v of ['FOOD_SERVICE', 'BEAUTY'] as const) {
      const b = branch[v];
      await db.business.create({ data: { id: b.business, organizationId: org, name: `${v} ${tag}`, vertical: v } });
      await db.location.create({ data: { id: b.location, businessId: b.business, name: `${v} ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
      own[v] = await as(v, async () => {
        const supplier = (await repo.createSupplier({ name: `Поставщик ${tag}`, phone: null, email: null, details: null })) as { id: string };
        const product = (await repo.createProduct({
          code: `CH-${tag}`, name: `Сок ${tag}`, categoryId: null, barcode: null, unitsPerPackage: 1,
          markupBasis: 10000, salePriceMinor: 60000n, minimumStockUnits: 0n,
        })) as { id: string };
        const receipt = (await repo.createReceipt({
          supplierId: supplier.id, documentNumber: `CH-${tag}`, documentDate: '2026-10-16', receivedDate: '2026-10-16',
          currency: 'KZT', note: null, lines: [{ productId: product.id, quantityUnits: 10n, unitCostMinor: 30000n, markupBasis: 10000n }],
        } as never)) as { id: string };
        await repo.postReceipt(receipt.id);
        const sale = (await repo.sellRetail({ productId: product.id, quantityUnits: 1n, method: 'CASH', idempotencyKey: `ch-${tag}` })) as { id: string };
        const line = await db.barReceiptLine.findFirstOrThrow({ where: { receiptId: receipt.id } });
        const lot = await db.barStockLot.findFirstOrThrow({ where: { receiptLineId: line.id } });
        const saleRow = await db.barSale.findUniqueOrThrow({ where: { id: sale.id } });
        if (!saleRow.restaurantCashOperationId) throw new Error('Expected posted sale to have restaurant cash operation');
        return { product: product.id, receipt: receipt.id, line: line.id, lot: lot.id, sale: sale.id, cash: saleRow.restaurantCashOperationId };
      });
    }
  });
  afterAll(async () => prisma.onModuleDestroy());

  const a = () => own.FOOD_SERVICE;
  const b = () => own.BEAUTY;
  const loc = (v: V) => branch[v].location;

  it('обе стороны настоящие: продажа каждого филиала легла в кассу своего филиала', async () => {
    for (const v of ['FOOD_SERVICE', 'BEAUTY'] as const) {
      const cash = await db.restaurantCashOperation.findUniqueOrThrow({ where: { id: own[v].cash } });
      expect([cash.locationId, cash.amount]).toEqual([loc(v), 60000n]);
    }
  });

  it('строка прихода: товар другого филиала отклоняется', async () => {
    await expect(
      db.barReceiptLine.create({
        data: { receiptId: a().receipt, productId: b().product, quantityUnits: 1n, unitCost: 1n, amount: 1n, markupBasis: 0, calculatedPrice: 1n },
      }),
    ).rejects.toThrow(/receipt line ownership mismatch/);
  });

  it('партия: строка прихода и товар другого филиала отклоняются, без прихода тоже', async () => {
    const lot = { receivedUnits: 1n, remainingUnits: 1n, unitCost: 1n, receivedAt: new Date() };
    await expect(db.barStockLot.create({ data: { ...lot, locationId: loc('BEAUTY'), productId: b().product, receiptLineId: a().line } })).rejects.toThrow(
      /stock lot ownership mismatch/,
    );
    await expect(db.barStockLot.create({ data: { ...lot, locationId: loc('FOOD_SERVICE'), productId: b().product, receiptLineId: null } })).rejects.toThrow(
      /stock lot ownership mismatch/,
    );
  });

  it('движение: партия другого филиала отклоняется', async () => {
    await expect(
      db.barStockMovement.create({
        data: {
          locationId: loc('BEAUTY'), productId: b().product, lotId: a().lot, kind: 'INVENTORY_ADJUSTMENT', units: -1n, unitCost: 1n,
          sourceType: 'BAR_INVENTORY_COUNT', sourceId: randomUUID(),
        },
      }),
    ).rejects.toThrow(/movement lot ownership mismatch/);
  });

  it('строка продажи: товар другого филиала отклоняется', async () => {
    await expect(
      db.barSaleLine.create({ data: { saleId: a().sale, productId: b().product, quantityUnits: 1n, salePrice: 1n, revenue: 1n, cost: 1n } }),
    ).rejects.toThrow(/sale line ownership mismatch/);
  });

  it('касса филиала: продажа и оплата поставщику не берут операцию кассы другого филиала', async () => {
    await expect(db.barSale.update({ where: { id: b().sale }, data: { restaurantCashOperationId: null } })).resolves.toBeTruthy();
    await expect(db.barSale.update({ where: { id: b().sale }, data: { restaurantCashOperationId: a().cash } })).rejects.toThrow(
      /restaurant cash ownership mismatch/,
    );
    await expect(
      db.barSupplierPayment.create({ data: { receiptId: b().receipt, restaurantCashOperationId: a().cash, amount: 1n, paidAt: new Date() } }),
    ).rejects.toThrow(/supplier payment ownership mismatch/);
  });
});
