import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaBarRepository } from '../../apps/api/src/bar/bar.repository';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { MenuModifiersService } from '../../apps/api/src/food-service/modifiers';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * «Меню бара» (DATA_MODEL §62.3, срез K3, миграция 157): гостиница и салон заводят меню с техкартой и добавками, продают
 * позицию меню на баре; деньги как у продажи бара (касса гостиницы или филиала, у гостиницы ещё счёт гостя), склад
 * кухни списывается по техкарте и добавкам сразу. Повтор ключа без второй продажи, возврат на склад по желанию.
 * Вымышленные данные (ADR-010).
 */
describe('меню бара у гостиницы и салона (integration, §62.3)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const repo = new PrismaBarRepository(prisma as never);
  const stock = new StockService(prisma);
  const menu = new RestaurantService(prisma, null, stock);
  const mods = new MenuModifiersService(prisma);
  const tag = randomUUID().slice(0, 8);
  type Vertical = 'HOSPITALITY' | 'BEAUTY';
  type Branch = { vertical: Vertical; org: string; business: string; location: string; property: string | null; user: string };
  const make = (vertical: Vertical): Branch => ({ vertical, org: randomUUID(), business: randomUUID(), location: randomUUID(), property: vertical === 'HOSPITALITY' ? randomUUID() : null, user: randomUUID() });
  const hotel = make('HOSPITALITY'),
    salon = make('BEAUTY');
  const as = <T>(b: Branch, fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: b.user, organizationId: b.org, role: 'OWNER', scope: 'LOCATION', vertical: b.vertical, businessId: b.business, locationId: b.location },
      fn,
    );
  const ids: Record<string, { coffee: string; beans: string; milk: string; milkMod: string }> = {};
  const onHand = async (b: Branch) => Object.fromEntries((await as(b, () => stock.products())).items.map((p) => [p.name, p.onHand]));

  beforeAll(async () => {
    for (const b of [hotel, salon]) {
      await prisma.db.user.create({ data: { id: b.user, email: `barmenu-${b.user}@example.invalid`, name: 'Владелец' } });
      await prisma.db.organization.create({ data: { id: b.org, name: `Меню бара ${tag}`, status: 'ACTIVE' } });
      await prisma.db.business.create({ data: { id: b.business, organizationId: b.org, name: `Бизнес ${tag}`, vertical: b.vertical } });
      await prisma.db.location.create({ data: { id: b.location, businessId: b.business, name: `Филиал ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
      if (b.property)
        await prisma.db.property.create({
          data: { id: b.property, organizationId: b.org, locationId: b.location, name: `Объект ${b.property}`, timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' },
        });
      const beans = (await as(b, () => stock.createProduct({ name: 'Кофе зерно', unit: 'г' }))).id;
      const milk = (await as(b, () => stock.createProduct({ name: 'Молоко', unit: 'мл' }))).id;
      // зерно 1 кг по 10 000 ₸/кг, молоко 1 л по 600 ₸/л
      await as(b, () => stock.receipt({ lines: [{ productId: beans, qty: '1000', unitCost: 1_000_000 }, { productId: milk, qty: '1000', unitCost: 60_000 }] }));
      const cat = await as(b, () => menu.createCategory({ name: 'Кофе', station: 'BAR' }));
      const coffee = (await as(b, () => menu.createMenuItem({ categoryId: cat.id, name: 'Американо', price: 80000 }))).id;
      await as(b, () => menu.replaceIngredients(coffee, { ingredients: [{ name: 'Кофе', normQty: '18', unit: 'г', unitCost: 1_000_000, productId: beans }] }));
      const group = await as(b, () =>
        mods.createGroup({ name: 'Добавки', minSelect: 0, maxSelect: 2, modifiers: [{ name: 'Молоко', priceDeltaMinor: 20000, ingredients: [{ productId: milk, normQty: '50' }] }] }),
      );
      await as(b, () => mods.setItemGroups(coffee, { groupIds: [group.id] }));
      ids[b.vertical] = { coffee, beans, milk, milkMod: group.modifiers[0]!.id };
    }
  });
  afterAll(async () => prisma.onModuleDestroy());

  it.each([['HOSPITALITY'], ['BEAUTY']] as const)(
    '%s: меню заводится; 2 кофе с молоком за наличные: касса +2 000 ₸, зерно 36 г и молоко 100 мл ушли, себестоимость 420 ₸',
    async (v) => {
      const b = v === 'HOSPITALITY' ? hotel : salon;
      const id = ids[v]!;
      const key = `menu-${v}-${tag}`;
      const sale = await as(b, () => repo.sellMenu({ menuItemId: id.coffee, quantityUnits: 2n, modifierIds: [id.milkMod], method: 'CASH', idempotencyKey: key }));
      // цена строки 800 + 200 ₸ = 1 000 ₸ × 2; себестоимость 36 г × 10 000 ₸/кг + 100 мл × 600 ₸/л = 360 + 60 ₸
      expect(sale).toMatchObject({ kind: 'posted', revenueMinor: '200000', costMinor: '42000' });
      expect(await onHand(b)).toMatchObject({ 'Кофе зерно': '964', Молоко: '900' });
      const row = await prisma.db.barSale.findFirstOrThrow({ where: { id: (sale as { id: string }).id }, include: { lines: true } });
      expect(row.lines).toHaveLength(1);
      expect(row.lines[0]).toMatchObject({ productId: null, menuItemId: id.coffee, quantityUnits: 2n, salePrice: 100000n, revenue: 200000n, cost: 42000n, note: 'Американо: Молоко' });
      expect(Boolean(row.cashOperationId ?? row.restaurantCashOperationId)).toBe(true);
      const moves = await prisma.db.kitchenStockMovement.findMany({ where: { barSaleId: row.id } });
      expect(moves.map((m) => [m.kind, m.qty.toString()]).sort()).toEqual([['CONSUMPTION', '-100'], ['CONSUMPTION', '-36']]);
      // повтор тем же ключом: та же продажа, склад не тронут
      const again = await as(b, () => repo.sellMenu({ menuItemId: id.coffee, quantityUnits: 2n, modifierIds: [id.milkMod], method: 'CASH', idempotencyKey: key }));
      expect((again as { id: string }).id).toBe(row.id);
      expect(await onHand(b)).toMatchObject({ 'Кофе зерно': '964' });
      // возврат с возвратом на склад: продукты вернулись
      expect(await as(b, () => repo.reverseSale(row.id, true, 'Не приготовили'))).toMatchObject({ kind: 'reversed', restocked: true });
      expect(await onHand(b)).toMatchObject({ 'Кофе зерно': '1000', Молоко: '1000' });
    },
  );

  it('без продуктов на складе продажа проходит: недостача записана, себестоимость только по тому, что было', async () => {
    const id = ids.BEAUTY!;
    await as(salon, () => stock.writeOff({ productId: id.milk, qty: '1000', reason: 'Прокисло' }));
    const sale = await as(salon, () => repo.sellMenu({ menuItemId: id.coffee, quantityUnits: 1n, modifierIds: [id.milkMod], method: 'CASH', idempotencyKey: `short-${tag}` }));
    expect(sale).toMatchObject({ kind: 'posted', revenueMinor: '100000', costMinor: '18000' });
    const short = await prisma.db.kitchenStockMovement.findFirstOrThrow({ where: { barSaleId: (sale as { id: string }).id, kind: 'SHORTAGE' } });
    expect(short.qty.toString()).toBe('-50');
  });

  it('гостиница: в счёт гостя начисление «Бар: Американо»; салону счёта гостя нет', async () => {
    const id = ids.HOSPITALITY!;
    const type = randomUUID(), rate = randomUUID(), reservation = randomUUID(), item = randomUUID(), folio = randomUUID();
    await prisma.db.accommodationType.create({ data: { id: type, propertyId: hotel.property!, code: `T-${tag}`, name: 'Номер', kind: 'APARTMENT', capacityAdults: 1 } as never });
    await prisma.db.ratePlan.create({ data: { id: rate, propertyId: hotel.property!, code: `R-${tag}`, name: 'Тариф', currency: 'KZT' } as never });
    await prisma.db.reservation.create({ data: { id: reservation, propertyId: hotel.property!, confirmationNumber: `C-${tag}`, source: 'DESK', status: 'CONFIRMED', arrivalDate: new Date('2026-10-24'), departureDate: new Date('2026-10-25'), adults: 1, currency: 'KZT', totalAmount: 0n } as never });
    await prisma.db.reservationItem.create({ data: { id: item, reservationId: reservation, accommodationTypeId: type, ratePlanId: rate, arrivalDate: new Date('2026-10-24'), departureDate: new Date('2026-10-25'), price: 0n, status: 'CONFIRMED' } as never });
    await prisma.db.folio.create({ data: { id: folio, reservationItemId: item, currency: 'KZT' } as never });
    const sale = await as(hotel, () => repo.sellMenu({ menuItemId: id.coffee, quantityUnits: 1n, modifierIds: [], folioId: folio, idempotencyKey: `folio-${tag}` }));
    expect(sale).toMatchObject({ kind: 'posted', revenueMinor: '80000' });
    const charge = await prisma.db.charge.findFirstOrThrow({ where: { folioId: folio } });
    expect([charge.description, charge.amount]).toEqual(['Бар: Американо', 80000n]);
    expect(await as(salon, () => repo.sellMenu({ menuItemId: ids.BEAUTY!.coffee, quantityUnits: 1n, modifierIds: [], folioId: folio, idempotencyKey: `nf-${tag}` }))).toEqual({ kind: 'no_folio' });
  });

  it('чужая позиция меню и обязательный выбор: отказ без продажи', async () => {
    expect(await as(salon, () => repo.sellMenu({ menuItemId: ids.HOSPITALITY!.coffee, quantityUnits: 1n, modifierIds: [], method: 'CASH', idempotencyKey: `x-${tag}` }))).toEqual({ kind: 'not_found' });
    await expect(as(salon, () => repo.sellMenu({ menuItemId: ids.BEAUTY!.coffee, quantityUnits: 1n, modifierIds: [ids.HOSPITALITY!.milkMod], method: 'CASH', idempotencyKey: `y-${tag}` }))).rejects.toThrow(/недоступна/);
    expect(await prisma.db.barSale.count({ where: { idempotencyKey: { in: [`x-${tag}`, `y-${tag}`] } } })).toBe(0);
  });
});
