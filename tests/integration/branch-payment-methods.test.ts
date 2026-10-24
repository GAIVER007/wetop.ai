import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import { BranchPaymentMethodsService } from '../../apps/api/src/food-service/branch-payment-methods';
import { BeautyLoyaltyService } from '../../apps/api/src/beauty/loyalty';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Способы оплаты филиала салона и ресторана (DATA_MODEL §21.7, миграция 20261023000151_branch_payment_method_settings,
 * решение владельца 23.10.2026). База: шесть способов, уникальность, RLS по организации, у приложения нет DELETE.
 * API: без строк всё как раньше; выключенный способ не принимает новых денег в оплате заказа, операции и переводе
 * кассы, выплате зарплаты и продаже сертификата; возврат прежними способами и старые оплаты не меняются.
 * Вымышленные данные (ADR-010).
 */
const url = process.env.DATABASE_URL;
describe('способы оплаты филиала (integration, §21.7)', () => {
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  let db: Db, raw: pg.Client, food: RestaurantService, methods: BranchPaymentMethodsService, loyalty: BeautyLoyaltyService;
  const org = randomUUID(),
    other = randomUUID(),
    user = randomUUID(),
    business = randomUUID(),
    beautyBusiness = randomUUID(),
    location = randomUUID(),
    salon = randomUUID(),
    foreign = randomUUID(),
    foreignBusiness = randomUUID(),
    employee = randomUUID();
  const as = <T>(vertical: 'FOOD_SERVICE' | 'BEAUTY', fn: () => Promise<T>, role: 'OWNER' | 'MANAGER' | 'STAFF' = 'OWNER') =>
    withSignedInUser(
      {
        userId: user,
        organizationId: org,
        role,
        scope: 'LOCATION',
        businessId: vertical === 'BEAUTY' ? beautyBusiness : business,
        locationId: vertical === 'BEAUTY' ? salon : location,
        vertical,
      },
      fn,
    );
  const six = (off: string[] = [], order?: string[]) =>
    (order ?? ['CASH', 'CARD_TERMINAL', 'KASPI', 'HALYK', 'BANK_TRANSFER_PERSON', 'BANK_TRANSFER_LEGAL']).map((method) => ({
      method,
      enabled: !off.includes(method),
    }));

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as unknown as PrismaService;
    food = new RestaurantService(prisma, null, new StockService(prisma));
    methods = new BranchPaymentMethodsService(prisma);
    loyalty = new BeautyLoyaltyService(prisma);
    raw = new pg.Client({ connectionString: url, options: `-c search_path=${process.env.DATABASE_SCHEMA || 'pms_test'},public` });
    await raw.connect();
    await db.organization.createMany({
      data: [
        { id: org, name: 'Способы филиала', status: 'ACTIVE' },
        { id: other, name: 'Чужая организация', status: 'ACTIVE' },
      ],
    });
    await db.user.create({ data: { id: user, name: 'Synthetic owner', email: `branch-pay-${user}@example.invalid` } });
    await db.business.createMany({
      data: [
        { id: business, organizationId: org, name: 'Synthetic food', vertical: 'FOOD_SERVICE' },
        { id: beautyBusiness, organizationId: org, name: 'Synthetic salon', vertical: 'BEAUTY' },
        { id: foreignBusiness, organizationId: other, name: 'Foreign food', vertical: 'FOOD_SERVICE' },
      ],
    });
    await db.location.createMany({
      data: [
        { id: location, businessId: business, name: 'Synthetic branch', timezone: 'Asia/Almaty', currency: 'KZT' },
        { id: salon, businessId: beautyBusiness, name: 'Synthetic salon', timezone: 'Asia/Almaty', currency: 'KZT' },
        { id: foreign, businessId: foreignBusiness, name: 'Foreign branch', timezone: 'Asia/Almaty', currency: 'KZT' },
      ],
    });
    await db.employee.create({ data: { id: employee, businessId: business, name: 'Synthetic waiter' } });
  });
  afterAll(async () => {
    await raw?.end();
    await db?.$disconnect();
  });

  it('база: шесть способов филиала, один раз на филиал, порядок неотрицательный', async () => {
    const insert = (method: string, sort = 0, loc = location) =>
      raw.query(
        `INSERT INTO branch_payment_method_settings(id,location_id,method,enabled,sort_order) VALUES(gen_random_uuid(),$1,$2,true,$3)`,
        [loc, method, sort],
      );
    await raw.query('BEGIN');
    try {
      await insert('CASH');
      for (const [method, sort, message] of [
        ['CASH', 1, 'branch_payment_method_settings_location_id_method_key'],
        ['DEPOSIT', 1, 'branch_payment_method_settings_method_branch'],
        ['EXTERNAL', 1, 'branch_payment_method_settings_method_branch'],
        ['BONUS', 1, 'branch_payment_method_settings_method_branch'],
        ['KASPI', -1, 'branch_payment_method_settings_sort_order_nonnegative'],
      ] as const) {
        await raw.query('SAVEPOINT p');
        await expect(insert(method, sort)).rejects.toThrow(message);
        await raw.query('ROLLBACK TO SAVEPOINT p');
      }
    } finally {
      await raw.query('ROLLBACK');
    }
  });

  it('база: приложение видит только свою организацию и не удаляет строки', async () => {
    await raw.query('BEGIN');
    try {
      for (const loc of [location, foreign])
        await raw.query(
          `INSERT INTO branch_payment_method_settings(id,location_id,method,enabled,sort_order) VALUES(gen_random_uuid(),$1,'CASH',true,0)`,
          [loc],
        );
      await raw.query('SET LOCAL ROLE wetop_app');
      await raw.query(`SELECT set_config('app.org_id',$1,true)`, [org]);
      const seen = await raw.query('SELECT location_id FROM branch_payment_method_settings WHERE location_id = ANY($1)', [
        [location, foreign],
      ]);
      expect(seen.rows.map((r) => r.location_id)).toEqual([location]);
      await raw.query('SAVEPOINT p');
      await expect(raw.query('DELETE FROM branch_payment_method_settings')).rejects.toThrow(/permission denied/);
      await raw.query('ROLLBACK TO SAVEPOINT p');
      await expect(
        raw.query(
          `INSERT INTO branch_payment_method_settings(id,location_id,method,enabled,sort_order) VALUES(gen_random_uuid(),$1,'KASPI',true,1)`,
          [foreign],
        ),
      ).rejects.toThrow(/row-level security/);
    } finally {
      await raw.query('ROLLBACK');
    }
  });

  it('API: без строк все шесть; сохранение порядка и включения, журнал, повтор без изменений не пишет', async () => {
    expect((await as('FOOD_SERVICE', () => methods.get())).methods).toEqual(six());
    await expect(as('FOOD_SERVICE', () => methods.update({ methods: six(['CASH', 'CARD_TERMINAL', 'KASPI', 'HALYK', 'BANK_TRANSFER_PERSON', 'BANK_TRANSFER_LEGAL']) }))).rejects.toThrow(
      'Хотя бы один способ оплаты должен быть включён',
    );
    await expect(as('FOOD_SERVICE', () => methods.update({ methods: six() }), 'STAFF')).rejects.toThrow();
    const order = ['KASPI', 'CASH', 'CARD_TERMINAL', 'BANK_TRANSFER_PERSON', 'BANK_TRANSFER_LEGAL', 'HALYK'];
    const saved = await as('FOOD_SERVICE', () => methods.update({ methods: six(['HALYK'], order) }));
    expect(saved.methods).toEqual(six(['HALYK'], order));
    await as('FOOD_SERVICE', () => methods.update({ methods: six(['HALYK'], order) }));
    const audits = await db.auditLog.findMany({ where: { entityId: location, action: 'branch.payment_methods.updated' } });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.after).toMatchObject({ enabled: ['KASPI', 'CASH', 'CARD_TERMINAL', 'BANK_TRANSFER_PERSON', 'BANK_TRANSFER_LEGAL'] });
    // у салона свои строки: настройка ресторана его не задела
    expect((await as('BEAUTY', () => methods.get())).methods).toEqual(six());
  });

  it('выключенный Halyk не принимает новых денег: заказ, касса, перевод, выплата; старое не меняется', async () => {
    // приход Halyk до выключения: остаток способа, чтобы проверить отказ не из-за пустой кассы
    await db.branchPaymentMethodSetting.deleteMany({ where: { locationId: location } });
    await as('FOOD_SERVICE', () => food.cashOperation({ kind: 'INCOME', method: 'HALYK', amount: 50000, note: 'до выключения' }));
    await as('FOOD_SERVICE', () => methods.update({ methods: six(['HALYK']) }));
    const order = await db.restaurantOrder.create({
      data: { locationId: location, number: 1, guestCount: 2, status: 'SERVED', total: 30000n, currency: 'KZT', openedAt: new Date(), servedAt: new Date() },
    });
    const off = 'Способ оплаты «Halyk» выключен в настройках филиала';
    await expect(as('FOOD_SERVICE', () => food.payOrder(order.id, { method: 'HALYK', amount: 10000, idempotencyKey: randomUUID() }))).rejects.toThrow(off);
    await expect(as('FOOD_SERVICE', () => food.cashOperation({ kind: 'INCOME', method: 'HALYK', amount: 100 }))).rejects.toThrow(off);
    await expect(as('FOOD_SERVICE', () => food.cashOperation({ kind: 'TRANSFER', method: 'CASH', methodTo: 'HALYK', amount: 100 }))).rejects.toThrow(off);
    await expect(
      as('FOOD_SERVICE', () => food.payout(employee, { period: '2026-10', method: 'HALYK', amount: 100, idempotencyKey: randomUUID() })),
    ).rejects.toThrow(off);
    // включённым способом всё работает; деньги, пришедшие Halyk раньше, можно вывести расходом и переводом
    const paid = await as('FOOD_SERVICE', () => food.payOrder(order.id, { method: 'KASPI', amount: 30000, idempotencyKey: randomUUID() }));
    expect(paid).toMatchObject({ status: 'CLOSED' });
    await as('FOOD_SERVICE', () => food.cashOperation({ kind: 'TRANSFER', method: 'HALYK', methodTo: 'CASH', amount: 1000 }));
    await as('FOOD_SERVICE', () => food.cashOperation({ kind: 'EXPENSE', method: 'HALYK', amount: 1000, note: 'хозрасходы' }));
    const cash = await as('FOOD_SERVICE', () => food.cash({}));
    expect(cash.operations.some((o: { method: string; note: string | null }) => o.method === 'HALYK' && o.note === 'до выключения')).toBe(true);
  });

  it('салон: выключенный Kaspi не продаёт сертификат; включённый продаёт', async () => {
    await as('BEAUTY', () => methods.update({ methods: six(['KASPI']) }));
    await expect(
      as('BEAUTY', () => loyalty.sell({ amountMinor: 500000, method: 'KASPI', idempotencyKey: randomUUID() })),
    ).rejects.toThrow('Способ оплаты «Kaspi» выключен в настройках филиала');
    const sold = await as('BEAUTY', () => loyalty.sell({ amountMinor: 500000, method: 'CASH', idempotencyKey: randomUUID() }));
    expect(sold).toBeTruthy();
  });
});
