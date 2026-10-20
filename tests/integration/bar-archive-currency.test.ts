import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaBarRepository } from '../../apps/api/src/bar/bar.repository';
import { SharedOnboardingService } from '../../apps/api/src/onboarding/onboarding.module';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Решения владельца 16.10.2026 по остатку O-4 (ADR-186):
 * N6: архивный поставщик и архивная категория видны в старых документах, но в новые не попадают;
 * смена валюты филиала запрещена, пока у бара есть проведённые документы (без курса пересчёт невозможен).
 * Ресторанный филиал, запросы от имени выбранного филиала, всё вымышленное (ADR-010).
 */
describe('бар: архив справочников и валюта филиала (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Бар проверяется только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const repo = new PrismaBarRepository(prisma as never);
  const onboarding = new SharedOnboardingService(prisma as never);
  const tag = randomUUID().slice(0, 8);
  const user = randomUUID();
  const org = randomUUID();
  const business = randomUUID();
  const location = randomUUID();
  const actor = {
    userId: user,
    organizationId: org,
    role: 'OWNER' as const,
    scope: 'LOCATION' as const,
    businessId: business,
    locationId: location,
    vertical: 'FOOD_SERVICE' as const,
  };
  const as = <T>(fn: () => Promise<T>) => withSignedInUser(actor, fn);
  beforeAll(async () => {
    await prisma.db.user.create({ data: { id: user, email: `bar-archive-${tag}@example.invalid` } });
    await prisma.db.organization.create({ data: { id: org, name: `Бар архив ${tag}`, status: 'ACTIVE' } });
    await prisma.db.business.create({ data: { id: business, organizationId: org, name: `Бар архив ${tag}`, vertical: 'FOOD_SERVICE' } });
    await prisma.db.location.create({ data: { id: location, businessId: business, name: `Филиал ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
  });
  afterAll(async () => prisma.onModuleDestroy());

  const receiptInput = (supplierId: string, productId: string, n: string) =>
    ({
      supplierId, documentNumber: `AR-${tag}-${n}`, documentDate: '2026-10-16', receivedDate: '2026-10-16',
      currency: 'KZT', note: null, lines: [{ productId, quantityUnits: 5n, unitCostMinor: 30000n, markupBasis: 10000n }],
    }) as never;

  it('N6: архивные поставщик и категория видны в старых документах, в новые не попадают', async () => {
    const category = (await as(() => repo.createCategory({ name: `Соки ${tag}`, defaultMarkupBasis: 10000 } as never))) as { id: string };
    const spare = (await as(() => repo.createCategory({ name: `Воды ${tag}`, defaultMarkupBasis: 10000 } as never))) as { id: string };
    const supplier = (await as(() => repo.createSupplier({ name: `Поставщик ${tag}`, phone: null, email: null, details: null }))) as { id: string };
    const product = (await as(() =>
      repo.createProduct({
        code: `AR-${tag}`, name: `Сок ${tag}`, categoryId: category.id, barcode: null, unitsPerPackage: 1,
        markupBasis: 10000, salePriceMinor: 60000n, minimumStockUnits: 0n,
      }),
    )) as { id: string };
    const receipt = (await as(() => repo.createReceipt(receiptInput(supplier.id, product.id, '1')))) as { id: string };
    await as(() => repo.postReceipt(receipt.id));

    await as(() => repo.setSupplierActive(supplier.id, false));
    await as(() => repo.setCategoryActive(category.id, false));
    await as(() => repo.setCategoryActive(spare.id, false));

    // старые документы и карточки показывают архивное имя
    const receipts = (await as(() => repo.receipts())) as Array<{ id: string; supplier: { name: string } }>;
    expect(receipts.find((r) => r.id === receipt.id)?.supplier.name).toBe(`Поставщик ${tag}`);
    const products = (await as(() => repo.products())) as Array<{ id: string; category: { name: string } | null }>;
    expect(products.find((p) => p.id === product.id)?.category?.name).toBe(`Соки ${tag}`);

    // новый приход с архивным поставщиком не создаётся
    const before = await prisma.db.barReceipt.count({ where: { locationId: location } });
    await expect(as(() => repo.createReceipt(receiptInput(supplier.id, product.id, '2')))).rejects.toThrow(/архив/);
    expect(await prisma.db.barReceipt.count({ where: { locationId: location } })).toBe(before);

    // новый товар в архивной категории не создаётся, перевод товара в архивную категорию тоже
    await expect(
      as(() =>
        repo.createProduct({
          code: `AR2-${tag}`, name: `Сок 2 ${tag}`, categoryId: category.id, barcode: null, unitsPerPackage: 1,
          markupBasis: 10000, salePriceMinor: 60000n, minimumStockUnits: 0n,
        }),
      ),
    ).rejects.toThrow(/архив/);
    expect(await prisma.db.barProduct.count({ where: { locationId: location, code: `AR2-${tag}` } })).toBe(0);
    const patch = { name: `Сок ${tag}`, barcode: null, unitsPerPackage: 1, markupBasis: 10000, minimumStockUnits: 0n };
    await expect(as(() => repo.updateProduct(product.id, { ...patch, categoryId: spare.id } as never))).rejects.toThrow(/архив/);

    // правка товара, который уже в архивной категории, её не теряет и не запрещается
    expect(await as(() => repo.updateProduct(product.id, { ...patch, name: `Сок свежий ${tag}`, categoryId: category.id } as never))).toMatchObject({
      name: `Сок свежий ${tag}`,
      categoryId: category.id,
    });
  });

  it('валюта: при проведённых документах бара онбординг не меняет валюту филиала', async () => {
    const draft = { businessName: `Бар архив ${tag}`, locationName: `Филиал ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' };
    let state = await as(() => onboarding.status());
    // до последнего шага настройки: «далее», пока шаг меняется
    for (let i = 0, prev = ''; i < 8 && state.currentStep !== prev; i++) {
      prev = state.currentStep;
      state = await as(() => onboarding.save({ action: 'next', draft, updatedAt: state.updatedAt }));
    }
    await expect(
      as(() => onboarding.save({ action: 'complete', draft: { ...draft, currency: 'USD' }, updatedAt: state.updatedAt })),
    ).rejects.toThrow(/рабочие данные/);
    expect((await prisma.db.location.findUniqueOrThrow({ where: { id: location } })).currency).toBe('KZT');
  });
});
