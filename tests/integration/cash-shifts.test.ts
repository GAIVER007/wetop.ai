import { cashBalances } from '@pms/domain';
import { PrismaFinanceRepository } from '../../apps/api/src/finance/finance.repository';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, NEW_PROPERTY_DEFAULTS, type Db } from '@pms/database';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import {
  CashShiftsService,
  type CashCommand,
} from '../../apps/api/src/finance/cash-shifts.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { SHIFT_REQUIRED_MESSAGE, assertShiftOpen } from '../../apps/api/src/finance/shift-guard';

describe.skipIf(!process.env.DATABASE_URL)('кассовые смены всех вертикалей, настоящая база', () => {
  let db: Db, service: CashShiftsService;
  const org = randomUUID(),
    owner = randomUUID(),
    cashier = randomUUID();
  const places: Array<{
    businessId: string;
    locationId: string;
    vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
  }> = [];
  const at = <T>(place: (typeof places)[number], userId: string, fn: () => Promise<T>) =>
    withSignedInUser(
      {
        userId,
        organizationId: org,
        role: userId === owner ? 'OWNER' : 'STAFF',
        scope: 'LOCATION',
        ...place,
      },
      fn,
    );
  const command = (place: (typeof places)[number], body: CashCommand, userId = owner) =>
    at(place, userId, () => service.command({ key: randomUUID(), ...body })) as Promise<
      Awaited<ReturnType<CashShiftsService['state']>>
    >;
  beforeAll(async () => {
    db = createPrismaClient();
    service = new CashShiftsService({ db } as PrismaService);
    await db.organization.create({
      data: { id: org, name: 'Касса тестовая организация', status: 'ACTIVE' },
    });
    for (const id of [owner, cashier]) {
      await db.user.create({
        data: {
          id,
          email: `cash-${id}@example.test`,
          name: id === owner ? 'Тестовый владелец' : 'Тестовый кассир',
        },
      });
      await db.membership.create({
        data: { userId: id, organizationId: org, role: id === owner ? 'OWNER' : 'STAFF' },
      });
    }
    for (const vertical of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const) {
      const business = await db.business.create({
        data: { organizationId: org, name: `Тест ${vertical}`, vertical },
      });
      const location = await db.location.create({
        data: {
          businessId: business.id,
          name: `Касса ${vertical}`,
          timezone: 'Asia/Almaty',
          currency: 'KZT',
        },
      });
      if (vertical === 'HOSPITALITY')
        await db.property.create({
          data: {
            ...NEW_PROPERTY_DEFAULTS,
            name: 'Тестовая гостиница кассы',
            organizationId: org,
            locationId: location.id,
          },
        });
      places.push({ businessId: business.id, locationId: location.id, vertical });
    }
  });
  afterAll(async () => {
    if (!db) return;
    const registers = await db.cashRegister.findMany({
      where: { organizationId: org },
      select: { id: true },
    });
    const ids = registers.map((r) => r.id);
    const shifts = await db.cashShift.findMany({
      where: { registerId: { in: ids } },
      select: { id: true },
    });
    await db.cashCommand.deleteMany({ where: { registerId: { in: ids } } });
    await db.cashHandover.deleteMany({ where: { registerId: { in: ids } } });
    await db.cashOperation.deleteMany({ where: { cashShiftId: { in: shifts.map((s) => s.id) } } });
    await db.restaurantCashOperation.deleteMany({
      where: { cashShiftId: { in: shifts.map((s) => s.id) } },
    });
    await db.restaurantCashReconciliation.deleteMany({
      where: { locationId: { in: places.map((p) => p.locationId) } },
    });
    await db.cashShift.deleteMany({ where: { registerId: { in: ids } } });
    await db.cashRegister.deleteMany({ where: { id: { in: ids } } });
    await db.cashReconciliation.deleteMany({
      where: { property: { organizationId: org } },
    });
    await db.cashCategory.deleteMany({
      where: { property: { organizationId: org } },
    });
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge','on',true)`;
      await tx.auditLog.deleteMany({ where: { organizationId: org } });
    });
    await db.property.deleteMany({ where: { organizationId: org } });
    await db.location.deleteMany({ where: { id: { in: places.map((p) => p.locationId) } } });
    await db.business.deleteMany({ where: { organizationId: org } });
    await db.membership.deleteMany({ where: { organizationId: org } });
    await db.user.deleteMany({ where: { id: { in: [owner, cashier] } } });
    await db.organization.delete({ where: { id: org } });
    await db.$disconnect();
  });
  for (const vertical of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const)
    it(`${vertical}: открытие, расход, снимок закрытия и отдельная передача`, async () => {
      const place = places.find((p) => p.vertical === vertical)!;
      let view = await command(place, { action: 'open', counted: '0' });
      const shiftId = view.active!.id;
      expect(view.snapshot.balances.CASH).toBe('0');
      await expect(command(place, { action: 'open', counted: '0' })).rejects.toThrow('уже открыта');
      await command(place, {
        action: 'income',
        amount: '1000',
        method: 'CASH',
        category: 'Внесение',
        shiftId,
      });
      const expense = {
        key: randomUUID(),
        action: 'expense',
        amount: '200',
        method: 'CASH',
        category: 'Такси',
        note: 'мастер домой после 21:00',
        shiftId,
      };
      await command(place, expense);
      view = await command(place, expense);
      expect(view.snapshot.balances.CASH).toBe('80000');
      await expect(command(place, { ...expense, amount: '201' })).rejects.toThrow('ключ');
      await expect(
        command(place, {
          action: 'close',
          shiftId,
          counted: '800',
          retained: '800',
          fingerprint: 'stale',
        }),
      ).rejects.toThrow('изменились');
      await expect(
        command(place, {
          action: 'close',
          shiftId,
          counted: '750',
          retained: '100',
          fingerprint: view.snapshot.fingerprint,
        }),
      ).rejects.toThrow('расхождение');
      view = await command(place, {
        action: 'close',
        shiftId,
        counted: '750',
        retained: '100',
        note: 'Перепроверить 50',
        fingerprint: view.snapshot.fingerprint,
        recipientId: cashier,
      });
      expect(view.active).toBeNull();
      expect(view.snapshot.balances.CASH).toBe('80000');
      expect(view.history[0]!.closing).toMatchObject({
        difference: '-5000',
        plannedHandover: '65000',
      });
      const frozen = JSON.stringify(view.history[0]!.closing),
        handoverId = view.handovers[0]!.id;
      await expect(command(place, { action: 'acknowledge', handoverId })).rejects.toThrow(
        'недоступна',
      );
      const ack = { key: randomUUID(), action: 'acknowledge', handoverId };
      await command(place, ack, cashier);
      view = await command(place, ack, cashier);
      expect(view.snapshot.balances.CASH).toBe('15000');
      const legacyCash = await at(place, owner, async () => {
        if (place.vertical === 'HOSPITALITY') {
          const repository = new PrismaFinanceRepository({ db } as PrismaService);
          return cashBalances(await repository.cashBalanceSources())
            .balances.find((b) => b.method === 'CASH')!
            .balanceMinor.toString();
        }
        const restaurant = new RestaurantService({ db } as PrismaService, null, null as never);
        return (await restaurant.cash()).balances.find((b) => b.method === 'CASH')!.balanceMinor;
      });
      expect(legacyCash).toBe('15000');
      expect(JSON.stringify(view.history[0]!.closing)).toBe(frozen);
      await expect(command(place, { action: 'open', counted: '150' }, cashier)).rejects.toThrow(
        'права кассира',
      );
      await at(place, owner, () => service.cashiers({ userIds: [cashier] }));
      view = await command(place, { action: 'open', counted: '150' }, cashier);
      expect(view.active?.responsible_user_id).toBe(cashier);
      await expect(
        command(
          place,
          {
            action: 'expense',
            shiftId: view.active!.id,
            amount: '1',
            method: 'CASH',
            category: 'Новая произвольная статья',
            note: 'проверка прав статьи',
          },
          cashier,
        ),
      ).rejects.toThrow('Новые статьи');
      await command(
        place,
        {
          action: 'close',
          shiftId: view.active!.id,
          counted: '150',
          retained: '150',
          fingerprint: view.snapshot.fingerprint,
        },
        cashier,
      );
    });
  it('не открывает чужую область и не доверяет роли без назначенных кассовых прав', async () => {
    const place = places[1]!;
    await expect(
      withSignedInUser(
        { userId: owner, organizationId: randomUUID(), role: 'OWNER', scope: 'LOCATION', ...place },
        () => service.state(),
      ),
    ).rejects.toThrow('недоступна');
    await at(place, owner, () => service.cashiers({ userIds: [] }));
    await expect(command(place, { action: 'open', counted: '150' }, cashier)).rejects.toThrow(
      'права кассира',
    );
  });
  it('не закрывает смену с передачей сотруднику без доступа к филиалу', async () => {
    const place = places[1]!,
      other = places[2]!;
    const assignment = await db.membershipScope.create({
      data: {
        organizationId: org,
        userId: cashier,
        role: 'STAFF',
        businessId: other.businessId,
        locationId: other.locationId,
      },
    });
    try {
      const view = await command(place, { action: 'open', counted: '150' });
      expect(view.members.some((member) => member.id === cashier)).toBe(false);
      await expect(
        command(place, {
          action: 'close',
          shiftId: view.active!.id,
          counted: '150',
          retained: '149',
          fingerprint: view.snapshot.fingerprint,
          recipientId: cashier,
        }),
      ).rejects.toThrow('Получатель недоступен в этом филиале');
      const after = await at(place, owner, () => service.state());
      expect(after.active?.id).toBe(view.active!.id);
      expect(after.handovers).toHaveLength(0);
    } finally {
      await db.membershipScope.delete({ where: { id: assignment.id } });
    }
  });
  it('салон не предлагает получателем сотрудника без права финансов', async () => {
    const place = places[1]!;
    const rollback = new Error('rollback synthetic position');
    await expect(
      db.$transaction(async (tx) => {
        const position = await tx.beautyPosition.create({
          data: { businessId: place.businessId, name: 'Тестовая должность без финансов' },
        });
        await tx.beautyPositionAssignment.create({
          data: {
            organizationId: org,
            userId: cashier,
            businessId: place.businessId,
            locationId: place.locationId,
            positionId: position.id,
          },
        });
        const isolatedService = new CashShiftsService({
          db: { $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) },
        } as unknown as PrismaService);
        const view = await at(place, owner, () => isolatedService.state());
        expect(view.members.some((m) => m.id === cashier)).toBe(false);
        await expect(at(place, cashier, () => isolatedService.state())).rejects.toThrow();
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });
  it('считает действующие оплаты и возвраты заказа в той же кассе без копирования', async () => {
    const place = places[2]!;
    const order = await db.restaurantOrder.create({
      data: {
        locationId: place.locationId,
        number: 1,
        total: 30000n,
        currency: 'KZT',
        status: 'SERVED',
      },
    });
    const payment = await db.restaurantPayment.create({
      data: {
        locationId: place.locationId,
        orderId: order.id,
        method: 'CASH',
        amount: 30000n,
        currency: 'KZT',
        idempotencyKey: randomUUID(),
      },
    });
    await db.restaurantOrder.update({ where: { id: order.id }, data: { status: 'CLOSED' } });
    const refund = await db.restaurantCashOperation.create({
      data: {
        locationId: place.locationId,
        orderId: order.id,
        kind: 'EXPENSE',
        method: 'CASH',
        amount: 10000n,
        currency: 'KZT',
      },
    });
    try {
      const view = await at(place, owner, () => service.state());
      expect(view.snapshot.balances.CASH).toBe('35000');
      expect(view.snapshot.received.CASH).toBe('30000');
      expect(view.snapshot.refunds.CASH).toBe('10000');
      expect(view.snapshot.expenses.CASH).toBe('20000');
      expect(
        await db.cashOperation.count({
          where: { cashShift: { register: { organizationId: org } } },
        }),
      ).toBe(2);
      expect(
        await db.restaurantCashOperation.count({ where: { locationId: place.locationId } }),
      ).toBe(3);
    } finally {
      await db.restaurantCashOperation.delete({ where: { id: refund.id } });
      await db.restaurantPayment.delete({ where: { id: payment.id } });
      await db.restaurantOrder.delete({ where: { id: order.id } });
    }
  });
  // владелец 27.10.2026: «пока смена не открыта нельзя вносить брони и т.д.» — сторож видит смену своей кассы
  it('сторож смены: администратор без открытой смены получает отказ, владелец нет; после открытия проходит', async () => {
    for (const place of places) {
      const where = place.vertical === 'HOSPITALITY'
        ? { propertyId: (await db.property.findFirstOrThrow({ where: { locationId: place.locationId } })).id, locationId: null }
        : { propertyId: null, locationId: place.locationId };
      const open = await db.cashShift.findFirst({ where: { register: { OR: [{ locationId: place.locationId }, { property: { locationId: place.locationId } }] }, closedAt: null } });
      if (open) continue; // другой тест оставил смену открытой: проверка без смены здесь невозможна
      await expect(at(place, cashier, () => assertShiftOpen(db as never, where))).rejects.toThrow(SHIFT_REQUIRED_MESSAGE);
      await expect(at(place, owner, () => assertShiftOpen(db as never, where))).resolves.toBeUndefined();
      // открыть на фактическом остатке кассы: предыдущие тесты могли оставить наличные
      const state = (await at(place, owner, () => service.state())) as { snapshot: { balances: Record<string, string> } };
      const cash = BigInt(state.snapshot.balances.CASH ?? '0');
      const text = `${cash / 100n}.${String(cash % 100n).padStart(2, '0')}`;
      const opened = await command(place, { action: 'open', counted: text });
      await expect(at(place, cashier, () => assertShiftOpen(db as never, where))).resolves.toBeUndefined();
      // закрыть, как было: следующие тесты открывают смену сами
      await command(place, {
        action: 'close', shiftId: opened.active!.id, counted: text, retained: text,
        fingerprint: opened.snapshot.fingerprint,
      });
      await expect(at(place, cashier, () => assertShiftOpen(db as never, where))).rejects.toThrow(SHIFT_REQUIRED_MESSAGE);
    }
  });

  // владелец 27.10.2026: частые статьи расходов кнопками; статья, уже использованная в этой кассе, доступна кассиру
  it('частые статьи расходов: сначала самые частые этой кассы, затем стандартные; использованную берёт кассир', async () => {
    const place = places.find((p) => p.vertical === 'BEAUTY')!;
    const money = (minor: bigint) => `${minor / 100n}.${String(minor % 100n).padStart(2, '0')}`;
    type View = { active: { id: string } | null; snapshot: { balances: Record<string, string>; fingerprint: string }; expenseCategories: string[] };
    let view = (await at(place, owner, () => service.state())) as View;
    // владелец открывает свою смену и вносит статью «Вода» трижды, «Такси» один раз (это история кассы)
    if (!view.active) view = (await command(place, { action: 'open', counted: money(BigInt(view.snapshot.balances.CASH ?? '0')) })) as never;
    let shiftId = view.active!.id;
    await command(place, { action: 'income', amount: '100', method: 'CASH', category: 'Внесение', shiftId });
    for (const category of ['Вода', 'Вода', 'Вода', 'Такси'])
      await command(place, { action: 'expense', amount: '1', method: 'CASH', category, note: 'частая статья', shiftId });
    view = (await at(place, owner, () => service.state())) as View;
    // окно закрытия (вариант B): расходы смены списком, по порядку внесения
    expect((view as unknown as { shiftExpenses: Array<{ category: string; amount: string }> }).shiftExpenses).toEqual([
      { category: 'Вода', method: 'CASH', amount: '100' },
      { category: 'Вода', method: 'CASH', amount: '100' },
      { category: 'Вода', method: 'CASH', amount: '100' },
      { category: 'Такси', method: 'CASH', amount: '100' },
    ]);
    const left = money(BigInt(view.snapshot.balances.CASH ?? '0'));
    await command(place, { action: 'close', shiftId, counted: left, retained: left, fingerprint: view.snapshot.fingerprint });
    // кассир видит частые статьи: «Вода» первой, стандартные тоже, без повторов
    await at(place, owner, () => service.cashiers({ userIds: [cashier] }));
    const seen = (await at(place, cashier, () => service.state())) as View;
    expect(seen.expenseCategories[0]).toBe('Вода');
    expect(seen.expenseCategories).toContain('Такси');
    expect(seen.expenseCategories).toContain('Закупка материалов');
    expect(new Set(seen.expenseCategories).size).toBe(seen.expenseCategories.length);
    // кассир берёт уже использованную в кассе статью; новую по-прежнему создаёт владелец
    view = (await command(place, { action: 'open', counted: left }, cashier)) as never;
    shiftId = view.active!.id;
    await expect(command(place, { action: 'expense', amount: '1', method: 'CASH', category: 'Вода', note: 'вода', shiftId }, cashier)).resolves.toBeTruthy();
    await expect(command(place, { action: 'expense', amount: '1', method: 'CASH', category: 'Совсем новая', note: 'новая', shiftId }, cashier)).rejects.toThrow('Новые статьи');
    view = (await at(place, cashier, () => service.state())) as View;
    const end = money(BigInt(view.snapshot.balances.CASH ?? '0'));
    await command(place, { action: 'close', shiftId, counted: end, retained: end, fingerprint: view.snapshot.fingerprint }, cashier);
    await at(place, owner, () => service.cashiers({ userIds: [] }));
  });

  it('параллельные открытия создают не более одной смены', async () => {
    const place = places[0]!;
    const results = await Promise.allSettled([
      command(place, { action: 'open', counted: '150' }),
      command(place, { action: 'open', counted: '150' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.cashShift.count({
        where: {
          registerId: (await at(place, owner, () => service.state())).registerId,
          closedAt: null,
        },
      }),
    ).toBe(1);
  });
  it('быстрый приход соблюдает настройки филиала, расход выводит прежний остаток OTHER', async () => {
    const place = places.find((p) => p.vertical === 'FOOD_SERVICE')!;
    let view = await at(place, owner, () => service.state());
    if (!view.active)
      view = await command(place, { action: 'open', counted: '0', note: 'Тест настроек' });
    const operation = {
      shiftId: view.active!.id,
      method: 'KASPI',
      amount: '1',
      category: 'Внесение',
    };
    await db.branchPaymentMethodSetting.create({
      data: { locationId: place.locationId, method: 'KASPI', enabled: false, sortOrder: 2 },
    });
    try {
      await expect(command(place, { ...operation, action: 'income' })).rejects.toThrow('выключен');
      await db.branchPaymentMethodSetting.create({
        data: { locationId: place.locationId, method: 'OTHER', enabled: true, sortOrder: 6 },
      });
      await command(place, { ...operation, action: 'income', method: 'OTHER' });
      await db.branchPaymentMethodSetting.update({
        where: { locationId_method: { locationId: place.locationId, method: 'OTHER' } },
        data: { enabled: false },
      });
      await expect(
        command(place, { ...operation, action: 'income', method: 'OTHER' }),
      ).rejects.toThrow('выключен');
      const after = await command(place, {
        ...operation,
        action: 'expense',
        method: 'OTHER',
        category: 'Прочее',
        note: 'прочий расход',
      });
      expect(after.snapshot.balances.OTHER).toBe('0');
    } finally {
      await db.branchPaymentMethodSetting.deleteMany({ where: { locationId: place.locationId } });
    }
  });
});
