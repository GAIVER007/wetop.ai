import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaBarRepository } from '../../apps/api/src/bar/bar.repository';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Излишек при инвентаризации бара (ADR-175, Q-BAR-9, DATA_MODEL §47): новая партия без строки прихода по средней
 * себестоимости остатка, без остатка по цене, названной человеком, иначе отказ. Партия излишка продаётся по FIFO
 * последней. Филиал ресторана, всё вымышленное (ADR-010), метка прогона.
 */
describe('бар: излишек при инвентаризации (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Бар проверяется только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const repo = new PrismaBarRepository(prisma as never);
  const tag = randomUUID().slice(0, 8);
  const user = randomUUID();
  const b = { org: randomUUID(), business: randomUUID(), location: randomUUID() };
  const as = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: user, organizationId: b.org, scope: 'LOCATION', businessId: b.business, locationId: b.location, vertical: 'FOOD_SERVICE' },
      fn,
    );
  let supplier = '';
  beforeAll(async () => {
    await prisma.db.user.create({ data: { id: user, email: `bar-surplus-${tag}@example.invalid` } });
    await prisma.db.organization.create({ data: { id: b.org, name: `Излишек ${tag}` } });
    await prisma.db.business.create({ data: { id: b.business, organizationId: b.org, name: `Излишек ${tag}`, vertical: 'FOOD_SERVICE' } });
    await prisma.db.location.create({
      data: { id: b.location, businessId: b.business, name: `Излишек ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' },
    });
    supplier = ((await as(() => repo.createSupplier({ name: `Поставщик ${tag}`, phone: null, email: null, details: null }))) as { id: string }).id;
  });
  afterAll(async () => prisma.onModuleDestroy());

  const product = async (code: string) =>
    ((await as(() =>
      repo.createProduct({
        code: `${code}-${tag}`, name: `${code} ${tag}`, categoryId: null, barcode: null, unitsPerPackage: 1,
        markupBasis: 10000, salePriceMinor: 60000n, minimumStockUnits: 0n,
      }),
    )) as { id: string }).id;
  const receive = async (productId: string, units: bigint, unitCostMinor: bigint, doc: string) =>
    as(async () => {
      const receipt = (await repo.createReceipt({
        supplierId: supplier, documentNumber: `${doc}-${tag}`, documentDate: '2026-10-15', receivedDate: '2026-10-15',
        currency: 'KZT', note: null, lines: [{ productId, quantityUnits: units, unitCostMinor, markupBasis: 10000n }],
      } as never)) as { id: string };
      await repo.postReceipt(receipt.id);
    });

  it('излишек при остатке: партия по средней себестоимости, без строки прихода, продаётся последней', async () => {
    const id = await product('AVG');
    await receive(id, 10n, 30000n, 'A1');
    await receive(id, 10n, 40000n, 'A2');
    const counted = await as(() => repo.inventoryCount({ productId: id, actualUnits: 22n, reason: 'Пересчёт смены', unitCostMinor: null }));
    expect(counted).toMatchObject({ kind: 'adjusted', systemUnits: '20', actualUnits: '22', differenceUnits: '2', costMinor: '70000' });
    const lot = await prisma.db.barStockLot.findFirstOrThrow({ where: { productId: id, receiptLineId: null } });
    expect([lot.receivedUnits, lot.remainingUnits, lot.unitCost, lot.locationId]).toEqual([2n, 2n, 35000n, b.location]);
    const move = await prisma.db.barStockMovement.findFirstOrThrow({ where: { productId: id, lotId: lot.id } });
    expect([move.kind, move.units, move.unitCost, move.sourceType]).toEqual(['INVENTORY_ADJUSTMENT', 2n, 35000n, 'BAR_INVENTORY_COUNT']);
    const audit = await prisma.db.auditLog.findFirstOrThrow({ where: { entityType: 'bar_inventory_count', entityId: move.sourceId } });
    expect(audit.after).toMatchObject({ differenceUnits: '2', unitCost: '35000', cost: '70000', manualPrice: false });
    // FIFO: 21 шт съедают обе партии прихода и одну единицу излишка; себестоимость 10×300 + 10×400 + 1×350 ₸
    const sale = await as(() => repo.sellRetail({ productId: id, quantityUnits: 21n, method: 'CASH', idempotencyKey: `avg-${tag}` }));
    expect(sale).toMatchObject({ kind: 'posted', costMinor: '735000' });
    expect((await prisma.db.barStockLot.findUniqueOrThrow({ where: { id: lot.id } })).remainingUnits).toBe(1n);
  });

  it('излишек на пустом складе: без цены отказ без следа, с ценой новая партия по ней', async () => {
    const id = await product('EMPTY');
    const before = await prisma.db.barStockMovement.count({ where: { productId: id } });
    expect(await as(() => repo.inventoryCount({ productId: id, actualUnits: 3n, reason: 'Нашли ящик', unitCostMinor: null }))).toEqual({
      kind: 'surplus_requires_cost',
      systemUnits: 0n,
    });
    expect(await prisma.db.barStockMovement.count({ where: { productId: id } })).toBe(before);
    const counted = await as(() => repo.inventoryCount({ productId: id, actualUnits: 3n, reason: 'Нашли ящик', unitCostMinor: 25000n }));
    expect(counted).toMatchObject({ kind: 'adjusted', differenceUnits: '3', costMinor: '75000' });
    const lot = await prisma.db.barStockLot.findFirstOrThrow({ where: { productId: id } });
    expect([lot.receiptLineId, lot.remainingUnits, lot.unitCost]).toEqual([null, 3n, 25000n]);
    const audit = await prisma.db.auditLog.findFirstOrThrow({ where: { entityType: 'bar_inventory_count', after: { path: ['productId'], equals: id } } });
    expect(audit.after).toMatchObject({ unitCost: '25000', manualPrice: true });
  });

  it('база не пускает партию без строки прихода на чужой филиал', async () => {
    const id = await product('GUARD');
    const other = await prisma.db.location.findFirstOrThrow({ where: { id: { not: b.location } } });
    await expect(
      prisma.db.barStockLot.create({
        data: { locationId: other.id, productId: id, receiptLineId: null, receivedUnits: 1n, remainingUnits: 1n, unitCost: 1n, receivedAt: new Date() },
      }),
    ).rejects.toThrow(/ownership mismatch/);
  });
});
