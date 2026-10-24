import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Заготовки (DATA_MODEL §62, срез K1): гостиница, салон и ресторан заводят заготовку с техкартой, «Приготовили»
 * списывает ингредиенты FIFO и приходует партию заготовки по себестоимости, сторно возвращает всё назад, циклы и
 * техкарта у сырья запрещены. Вымышленные данные (ADR-010).
 */
describe('заготовки склада кухни (integration, §62)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  let db: Db;
  let stock: StockService;
  type Branch = { org: string; business: string; location: string; user: string; vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE' };
  const branches: Branch[] = (['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const).map((vertical) => ({
    org: randomUUID(),
    business: randomUUID(),
    location: randomUUID(),
    user: randomUUID(),
    vertical,
  }));
  const as = <T>(b: Branch, fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: b.user, organizationId: b.org, role: 'OWNER', scope: 'LOCATION', vertical: b.vertical, businessId: b.business, locationId: b.location },
      fn,
    );

  beforeAll(async () => {
    db = createPrismaClient(url);
    stock = new StockService({ db } as unknown as PrismaService);
    for (const b of branches) {
      await db.organization.create({ data: { id: b.org, name: `Заготовки ${b.org.slice(0, 8)}`, status: 'ACTIVE' } });
      await db.business.create({ data: { id: b.business, organizationId: b.org, name: b.vertical, vertical: b.vertical } });
      await db.location.create({ data: { id: b.location, businessId: b.business, name: 'Филиал', timezone: 'Asia/Almaty', currency: 'KZT' } });
      await db.user.create({ data: { id: b.user, email: `prep-${b.user}@example.invalid`, name: 'Владелец' } });
    }
  });
  afterAll(async () => db?.$disconnect());

  it.each(branches.map((b) => [b.vertical, b] as const))(
    '%s: колбаса из мяса и соли, «Приготовили» 2.5 кг по FIFO, цена партии из себестоимости, сторно возвращает',
    async (_v, b) => {
      const meat = await as(b, () => stock.createProduct({ name: 'Мясо', unit: 'г' }));
      const salt = await as(b, () => stock.createProduct({ name: 'Соль', unit: 'г' }));
      const sausage = await as(b, () => stock.createProduct({ name: 'Колбаса домашняя', unit: 'г', kind: 'PREP' }));
      expect(sausage.kind).toBe('PREP');
      // мясо двумя партиями: 1 кг по 2 000 ₸/кг, затем 3 кг по 3 000 ₸/кг; соль 1 кг по 100 ₸/кг
      await as(b, () => stock.receipt({ receivedOn: '2026-10-20', lines: [{ productId: meat.id, qty: '1000', unitCost: 200_000 }] }));
      await as(b, () => stock.receipt({ receivedOn: '2026-10-21', lines: [{ productId: meat.id, qty: '3000', unitCost: 300_000 }, { productId: salt.id, qty: '1000', unitCost: 10_000 }] }));
      // на 1 кг колбасы: 800 г мяса и 20 г соли
      await as(b, () => stock.setPrepRecipe(sausage.id, { yieldQty: '1000', lines: [{ ingredientId: meat.id, normQty: '800' }, { ingredientId: salt.id, normQty: '20' }] }));
      expect((await as(b, () => stock.prepRecipe(sausage.id))).lines.map((l) => [l.ingredientName, l.normQty])).toEqual([
        ['Мясо', '800'],
        ['Соль', '20'],
      ]);

      const made = await as(b, () => stock.produce({ productId: sausage.id, qty: '2500' }));
      // мясо 2 000 г: 1 000 г по 2 000 ₸/кг (200 000) + 1 000 г по 3 000 ₸/кг (300 000); соль 50 г (500)
      expect(made.costMinor).toBe('500500');
      expect(made.shortages).toEqual([]);
      // 500 500 тиынов за 2.5 кг → 200 200 за кг
      expect(made.lot.unitCostMinor).toBe('200200');
      expect(made.lot.remainingQty).toBe('2500');
      const view = Object.fromEntries((await as(b, () => stock.products())).items.map((p) => [p.name, p.onHand]));
      expect(view).toMatchObject({ Мясо: '2000', Соль: '950', 'Колбаса домашняя': '2500' });
      const moves = await db.kitchenStockMovement.findMany({ where: { locationId: b.location }, orderBy: { createdAt: 'asc' } });
      expect(moves.filter((m) => m.kind === 'PRODUCTION_OUT').every((m) => m.productionLotId === made.lot.id)).toBe(true);
      expect(moves.filter((m) => m.kind === 'PRODUCTION_IN')).toHaveLength(1);

      // сторно, пока из партии ничего не взяли: ингредиенты вернулись в свои партии, заготовки нет
      await as(b, () => stock.reverseLot(made.lot.id));
      const back = Object.fromEntries((await as(b, () => stock.products())).items.map((p) => [p.name, p.onHand]));
      expect(back).toMatchObject({ Мясо: '4000', Соль: '1000', 'Колбаса домашняя': '0' });
      await expect(as(b, () => stock.reverseLot(made.lot.id))).rejects.toThrow(/уже сторнирован/);
    },
  );

  it('не хватает ингредиента: остаток списан, недостача записана, партия заготовки по фактической себестоимости', async () => {
    const b = branches[0]!;
    const milk = await as(b, () => stock.createProduct({ name: 'Молоко', unit: 'мл' }));
    const cream = await as(b, () => stock.createProduct({ name: 'Крем', unit: 'г', kind: 'PREP' }));
    await as(b, () => stock.receipt({ lines: [{ productId: milk.id, qty: '300', unitCost: 50_000 }] }));
    await as(b, () => stock.setPrepRecipe(cream.id, { yieldQty: '100', lines: [{ ingredientId: milk.id, normQty: '200' }] }));
    const made = await as(b, () => stock.produce({ productId: cream.id, qty: '200' }));
    expect(made.shortages).toEqual([{ productId: milk.id, name: 'Молоко', qty: '100' }]);
    // 300 мл по 500 ₸/л = 15 000 тиынов за 200 г → 75 000 за кг
    expect(made.costMinor).toBe('15000');
    expect(made.lot.unitCostMinor).toBe('75000');
    // сторно гасит и недостачу: молоко снова 300 мл
    await as(b, () => stock.reverseLot(made.lot.id));
    expect((await as(b, () => stock.products())).items.find((p) => p.id === milk.id)?.onHand).toBe('300');
  });

  it('заготовка как продукт: из партии взяли, сторно запрещено; списание партии заготовки по FIFO работает', async () => {
    const b = branches[1]!;
    const water = await as(b, () => stock.createProduct({ name: 'Вода', unit: 'мл' }));
    const syrup = await as(b, () => stock.createProduct({ name: 'Сироп', unit: 'мл', kind: 'PREP' }));
    await as(b, () => stock.receipt({ lines: [{ productId: water.id, qty: '1000', unitCost: 1_000 }] }));
    await as(b, () => stock.setPrepRecipe(syrup.id, { yieldQty: '1000', lines: [{ ingredientId: water.id, normQty: '500' }] }));
    const made = await as(b, () => stock.produce({ productId: syrup.id, qty: '1000' }));
    await as(b, () => stock.writeOff({ productId: syrup.id, qty: '100', reason: 'Проба' }));
    await expect(as(b, () => stock.reverseLot(made.lot.id))).rejects.toThrow(/уже списано/);
  });

  it('запреты: техкарта только у заготовки, без циклов, ингредиент своего бизнеса; вид не меняется после прихода', async () => {
    const [h, s] = [branches[0]!, branches[1]!];
    const raw = await as(h, () => stock.createProduct({ name: 'Хлеб', unit: 'шт' }));
    const a = await as(h, () => stock.createProduct({ name: 'Соус А', unit: 'г', kind: 'PREP' }));
    const c = await as(h, () => stock.createProduct({ name: 'Соус Б', unit: 'г', kind: 'PREP' }));
    const foreign = await as(s, () => stock.createProduct({ name: 'Чужая соль', unit: 'г' }));
    await expect(as(h, () => stock.setPrepRecipe(raw.id, { yieldQty: '1', lines: [{ ingredientId: a.id, normQty: '1' }] }))).rejects.toThrow(/не заготовка/);
    await as(h, () => stock.setPrepRecipe(a.id, { yieldQty: '100', lines: [{ ingredientId: c.id, normQty: '50' }] }));
    await expect(as(h, () => stock.setPrepRecipe(c.id, { yieldQty: '100', lines: [{ ingredientId: a.id, normQty: '50' }] }))).rejects.toThrow(/по кругу/);
    await expect(as(h, () => stock.setPrepRecipe(c.id, { yieldQty: '100', lines: [{ ingredientId: foreign.id, normQty: '5' }] }))).rejects.toThrow(/недоступен/);
    // сам триггер базы тоже держит цикл, даже мимо API
    await expect(
      db.kitchenPrepRecipeLine.create({ data: { productId: c.id, ingredientId: a.id, normQty: '1' } }).catch(async (e) => {
        await db.kitchenPrepRecipe.create({ data: { productId: c.id, yieldQty: '1' } });
        return db.kitchenPrepRecipeLine.create({ data: { productId: c.id, ingredientId: a.id, normQty: '1' } }).catch(() => { throw e; });
      }),
    ).rejects.toThrow();
    await as(h, () => stock.receipt({ lines: [{ productId: raw.id, qty: '5', unitCost: 10_000 }] }));
    await expect(as(h, () => stock.updateProduct(raw.id, { kind: 'PREP' }))).rejects.toThrow(/Вид нельзя сменить/);
    await expect(as(h, () => stock.produce({ productId: raw.id, qty: '1' }))).rejects.toThrow(/не заготовка/);
    await expect(as(h, () => stock.produce({ productId: c.id, qty: '1' }))).rejects.toThrow(/нет техкарты/);
  });
});
