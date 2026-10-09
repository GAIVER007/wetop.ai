import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaBarRepository } from '../../apps/api/src/bar/bar.repository';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Обзор бара по макету владельца (ADR-157) на настоящей PostgreSQL: `stock()` отдаёт поставщика, цену и дату
 * последнего проведённого прихода, `report()` отдаёт месяц объекта и популярные товары. Продаж здесь нет
 * намеренно: розничная продажа держит кассовую операцию, а `cash-operations.test.ts` чистит кассу целиком.
 * Поставщик и товар вымышленные (ADR-010), имена с меткой прогона.
 */
describe('бар: данные обзора на базе', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Обзор бара проверяется только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const repo = new PrismaBarRepository(prisma as never);
  afterAll(async () => prisma.onModuleDestroy());

  it('последний проведённый приход даёт поставщика, закупку и дату; черновик их не меняет', async () => {
    const tag = randomUUID().slice(0, 8);
    const first = (await repo.createSupplier({ name: `Обзор ${tag} первый`, phone: null, email: null, details: null })) as { id: string };
    const second = (await repo.createSupplier({ name: `Обзор ${tag} второй`, phone: null, email: null, details: null })) as { id: string };
    const product = (await repo.createProduct({
      code: `OVR-${tag}`, name: `Обзорный товар ${tag}`, categoryId: null, barcode: null, unitsPerPackage: 1,
      markupBasis: 8800, salePriceMinor: 60000n, minimumStockUnits: 10n,
    })) as { id: string };
    const receipt = (supplierId: string, day: string, cost: bigint) => repo.createReceipt({
      supplierId, documentNumber: `OVR-${tag}-${day}`, documentDate: day, receivedDate: day, currency: 'KZT', note: null,
      lines: [{ productId: product.id, quantityUnits: 12n, unitCostMinor: cost, markupBasis: 8800n }],
    } as never) as Promise<{ id: string }>;
    const older = await receipt(first.id, '2026-09-20', 30000n);
    await repo.postReceipt(older.id);
    const newer = await receipt(second.id, '2026-10-03', 32000n);
    await repo.postReceipt(newer.id);
    // черновик позже по дате, но не проведён: последним приходом не считается
    await receipt(first.id, '2026-10-05', 99900n);

    const row = ((await repo.stock()) as Array<Record<string, unknown>>).find((item) => item.id === product.id)!;
    expect(row).toMatchObject({
      availableUnits: '24',
      stockCostMinor: String(12n * 30000n + 12n * 32000n),
      lastUnitCostMinor: '32000',
      lastReceivedDate: '2026-10-03',
      lastSupplier: { id: second.id, name: `Обзор ${tag} второй` },
      nearestExpiry: null,
    });

    const report = (await repo.report()) as {
      month: { monthStart: string; purchasesMinor: string; purchasesPrevMinor: string; purchasesGrowth: number | null };
      popular: unknown[];
    };
    // месяц объекта целиком: начало месяца, суммы строками в тиынах, прирост целым числом или null
    expect(report.month.monthStart).toMatch(/^\d{4}-\d{2}-01$/);
    expect(report.month.purchasesMinor).toMatch(/^\d+$/);
    expect(report.month.purchasesPrevMinor).toMatch(/^\d+$/);
    expect(report.month.purchasesGrowth === null || Number.isInteger(report.month.purchasesGrowth)).toBe(true);
    expect(Array.isArray(report.popular)).toBe(true);
  });
});
