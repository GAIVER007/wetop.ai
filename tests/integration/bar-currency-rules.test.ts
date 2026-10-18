import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaBarRepository } from '../../apps/api/src/bar/bar.repository';
import { SharedOnboardingService } from '../../apps/api/src/onboarding/onboarding.module';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Решения владельца 18.10.2026 (ADR-187):
 * автоцена бара не в тенге: вверх до целой единицы валюты филиала (раньше такой приход отклонялся);
 * смена валюты филиала запрещена и при деньгах ресторана (оплаты заказов, операции кассы филиала).
 * Ресторанные филиалы, запросы от имени выбранного филиала, всё вымышленное (ADR-010).
 */
describe('бар и ресторан: правила валюты филиала (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const repo = new PrismaBarRepository(prisma as never);
  const onboarding = new SharedOnboardingService(prisma as never);
  const tag = randomUUID().slice(0, 8);
  const user = randomUUID();
  const org = randomUUID();
  const business = randomUUID();
  const usd = randomUUID();
  const cashOnly = randomUUID();
  const actor = (locationId: string) => ({
    userId: user,
    organizationId: org,
    role: 'OWNER' as const,
    scope: 'LOCATION' as const,
    businessId: business,
    locationId,
    vertical: 'FOOD_SERVICE' as const,
  });
  beforeAll(async () => {
    await prisma.db.user.create({ data: { id: user, email: `bar-currency-${tag}@example.invalid` } });
    await prisma.db.organization.create({ data: { id: org, name: `Валюта ${tag}`, status: 'ACTIVE' } });
    await prisma.db.business.create({ data: { id: business, organizationId: org, name: `Валюта ${tag}`, vertical: 'FOOD_SERVICE' } });
    await prisma.db.location.create({ data: { id: usd, businessId: business, name: `Доллары ${tag}`, timezone: 'Asia/Dubai', currency: 'USD' } });
    await prisma.db.location.create({ data: { id: cashOnly, businessId: business, name: `Касса ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
  });
  afterAll(async () => prisma.onModuleDestroy());

  it('приход в долларах проводится, цена продажи вверх до целого доллара', async () => {
    const as = <T>(fn: () => Promise<T>) => withSignedInUser(actor(usd), fn);
    const supplier = (await as(() => repo.createSupplier({ name: `Поставщик ${tag}`, phone: null, email: null, details: null }))) as { id: string };
    const product = (await as(() =>
      repo.createProduct({
        code: `USD-${tag}`, name: `Тоник ${tag}`, categoryId: null, barcode: null, unitsPerPackage: 1,
        markupBasis: 4000, salePriceMinor: 100n, minimumStockUnits: 0n,
      }),
    )) as { id: string };
    // 3,00 USD + 40 % = 4,20 USD → 5,00 USD
    const receipt = (await as(() =>
      repo.createReceipt({
        supplierId: supplier.id, documentNumber: `USD-${tag}`, documentDate: '2026-10-18', receivedDate: '2026-10-18',
        currency: 'USD', note: null, lines: [{ productId: product.id, quantityUnits: 4n, unitCostMinor: 300n, markupBasis: 4000n }],
      } as never),
    )) as { id: string; lines: Array<{ calculatedPrice: string }> };
    expect(receipt.lines[0]!.calculatedPrice).toBe('500');
    await as(() => repo.postReceipt(receipt.id));
    expect((await prisma.db.barProduct.findUniqueOrThrow({ where: { id: product.id } })).salePrice).toBe(500n);
  });

  it('деньги кассы филиала без документов бара: валюту филиала не сменить', async () => {
    await prisma.db.restaurantCashOperation.create({
      data: { locationId: cashOnly, kind: 'INCOME', method: 'CASH', amount: 50000n, currency: 'KZT', note: `Синтетика ${tag}` },
    });
    const as = <T>(fn: () => Promise<T>) => withSignedInUser(actor(cashOnly), fn);
    const draft = { businessName: `Валюта ${tag}`, locationName: `Касса ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' };
    let state = await as(() => onboarding.status());
    for (let i = 0, prev = ''; i < 8 && state.currentStep !== prev; i++) {
      prev = state.currentStep;
      state = await as(() => onboarding.save({ action: 'next', draft, updatedAt: state.updatedAt }));
    }
    await expect(
      as(() => onboarding.save({ action: 'complete', draft: { ...draft, currency: 'USD' }, updatedAt: state.updatedAt })),
    ).rejects.toThrow(/рабочие данные/);
    expect((await prisma.db.location.findUniqueOrThrow({ where: { id: cashOnly } })).currency).toBe('KZT');
  });
});
