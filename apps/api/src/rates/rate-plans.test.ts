import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RatePlansService } from './rate-plans';
import { withSignedInUser } from '../auth/request-context';
import { forgetPropertyRef } from '../database/property-ref';
import type { PrismaService } from '../database/prisma.provider';

/**
 * «Тарифные планы» (SET4, `plans/property-settings-set4-2026-09-29.md`; решения владельца 29.09): правило отмены —
 * свойство тарифа, его меняют владелец и управляющий (право `rates` на контроллере), и оно действует для всех броней
 * тарифа — штраф берётся из тарифа в момент отмены. Поэтому список отдаёт, сколько будущих броней правка заденет,
 * а правка пишет это число в журнал. Кодов тарифа стойка не показывает, но адресует ими правку.
 */
type Plan = {
  id: string;
  code: string;
  name: string;
  currency: string;
  active: boolean;
  cancellationPenalty: 'NONE' | 'FIRST_NIGHT' | 'FULL_STAY';
  types: Array<{ accommodationType: { name: string } }>;
  parentRatePlanId?: string | null;
  discountPercent?: number | null;
  /** Что держит тариф (WET-04): сопоставления каналов, сайт, действующие производные */
  _count?: { channelMappings: number; trackedSites: number; derived: number };
};
const free = { channelMappings: 0, trackedSites: 0, derived: 0 };
const base: Plan = {
  id: 'plan-base',
  code: 'rate-base',
  name: 'Базовый',
  currency: 'KZT',
  active: true,
  cancellationPenalty: 'FIRST_NIGHT',
  types: [{ accommodationType: { name: 'Двухместный' } }, { accommodationType: { name: 'Койка' } }],
};
const flex: Plan = {
  ...base,
  id: 'plan-flex',
  code: 'rate-flex',
  name: 'Гибкий',
  cancellationPenalty: 'NONE',
  types: [],
};

function setup(plans: Plan[] = [base, flex], upcoming: Record<string, number> = {}) {
  const store = plans.map((p) => ({ _count: { ...free }, ...p }));
  const db = {
    property: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'prop-a',
        name: 'Хостел А',
        organizationId: 'org-a',
        timezone: 'Asia/Almaty',
      }),
    },
    ratePlan: {
      findMany: vi.fn().mockImplementation(async () => store),
      findFirst: vi
        .fn()
        .mockImplementation(
          async ({ where }: { where: { propertyId: string; code: string } }) =>
            store.find((p) => where.propertyId === 'prop-a' && p.code === where.code) ?? null,
        ),
      update: vi
        .fn()
        .mockImplementation(
          async ({ where, data }: { where: { id: string }; data: Partial<Plan> }) => {
            const row = store.find((p) => p.id === where.id)!;
            Object.assign(row, data);
            return row;
          },
        ),
    },
    $queryRaw: vi
      .fn()
      .mockImplementation(async () =>
        Object.entries(upcoming).map(([id, count]) => ({ id, upcoming: count })),
      ),
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const service = new RatePlansService({
    db: { ...db, $transaction: async (fn: (t: typeof db) => Promise<unknown>) => fn(db) },
  } as unknown as PrismaService);
  return { service, db, store };
}
const asManager = <T>(fn: () => Promise<T>) =>
  withSignedInUser({ userId: 'u1', organizationId: 'org-a', role: 'MANAGER' }, fn);

describe('«Тарифные планы»: правило отмены', () => {
  beforeEach(() => forgetPropertyRef());

  it('список: правило, категории по названию и брони, которые правка заденет', async () => {
    const { service } = setup([base, flex], { 'plan-base': 3 });
    const list = await asManager(() => service.list());
    expect(list).toEqual([
      {
        code: 'rate-base',
        name: 'Базовый',
        currency: 'KZT',
        active: true,
        cancellationPenalty: 'FIRST_NIGHT',
        categories: ['Двухместный', 'Койка'],
        upcomingReservations: 3,
        derived: null,
        offBlockers: ['Броней впереди по тарифу: 3. Тариф выключается, когда по нему не остаётся будущих броней.'],
      },
      {
        code: 'rate-flex',
        name: 'Гибкий',
        currency: 'KZT',
        active: true,
        cancellationPenalty: 'NONE',
        categories: [],
        upcomingReservations: 0,
        derived: null,
        offBlockers: [],
      },
    ]);
  });

  it('правка: новое правило, журнал «было/стало» с числом затронутых броней', async () => {
    const { service, db } = setup([base, flex], { 'plan-base': 3 });
    const saved = await asManager(() =>
      service.updatePenalty('rate-base', { cancellationPenalty: 'FULL_STAY' }),
    );
    expect(saved).toMatchObject({
      code: 'rate-base',
      cancellationPenalty: 'FULL_STAY',
      upcomingReservations: 3,
    });
    expect(db.ratePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plan-base' },
        data: { cancellationPenalty: 'FULL_STAY' },
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        entityType: 'RatePlan',
        entityId: 'plan-base',
        action: 'rate_plan.cancellation_penalty.updated',
        before: { cancellationPenalty: 'FIRST_NIGHT' },
        after: { cancellationPenalty: 'FULL_STAY', upcomingReservations: 3 },
      }),
    });
  });

  it('то же правило — без записи и без журнала', async () => {
    const { service, db } = setup();
    const saved = await asManager(() =>
      service.updatePenalty('rate-flex', { cancellationPenalty: 'NONE' }),
    );
    expect(saved.cancellationPenalty).toBe('NONE');
    expect(db.ratePlan.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('неизвестное правило или лишнее поле — 400 словами, неизвестный тариф — 404', async () => {
    const { service, db } = setup();
    await expect(
      asManager(() => service.updatePenalty('rate-base', { cancellationPenalty: 'HALF' })),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Правило отмены: без штрафа, первая ночь или всё проживание',
    });
    await expect(
      asManager(() =>
        service.updatePenalty('rate-base', { cancellationPenalty: 'NONE', name: 'Новый' }),
      ),
    ).rejects.toMatchObject({ status: 400, message: 'Неизвестное поле: name' });
    await expect(
      asManager(() => service.updatePenalty('rate-nope', { cancellationPenalty: 'NONE' })),
    ).rejects.toMatchObject({ status: 404, message: 'Тариф не найден' });
    expect(db.ratePlan.update).not.toHaveBeenCalled();
  });
});

/**
 * WET-04 (ТЗ QA 01.10.2026): тариф выключается и включается через существующее поле `active` (DATA_MODEL без правок).
 * Выключенный тариф форма брони и предложения цен не читают, прежние брони хранят свой тариф и его правило.
 * Выключить нельзя, пока тариф держат сопоставление каналов, сайт, действующие производные тарифы или брони
 * впереди (умолчание ТЗ, Q-270); включить обратно можно всегда. `PATCH /rates/plans/:code` принимает либо
 * правило отмены, либо `active`, не оба сразу.
 */
describe('«Тарифные планы»: выключить и включить тариф', () => {
  beforeEach(() => forgetPropertyRef());

  it('тариф без помех выключается: запись, журнал «было/стало», в списке «не действует»', async () => {
    const { service, db, store } = setup();
    const saved = await asManager(() => service.update('rate-flex', { active: false }));
    expect(saved).toMatchObject({ code: 'rate-flex', active: false, offBlockers: [] });
    expect(store.find((p) => p.code === 'rate-flex')?.active).toBe(false);
    expect(db.ratePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'plan-flex' }, data: { active: false } }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        entityType: 'RatePlan',
        entityId: 'plan-flex',
        action: 'rate_plan.active.updated',
        before: { active: true },
        after: { active: false, upcomingReservations: 0 },
      }),
    });
  });

  it('помехи: каналы, сайт, производные и брони впереди — 409 со всеми причинами, без записи', async () => {
    const held: Plan = {
      ...base,
      id: 'plan-held',
      code: 'rate-held',
      name: 'Удерживаемый',
      _count: { channelMappings: 2, trackedSites: 1, derived: 1 },
    };
    const { service, db } = setup([held, flex], { 'plan-held': 4 });
    const list = await asManager(() => service.list());
    expect(list.find((p) => p.code === 'rate-held')?.offBlockers).toEqual([
      'Тариф сопоставлен с менеджером каналов: сначала снимите сопоставление в «Каналах продаж».',
      'По этому тарифу бронирует сайт: сначала выберите другой тариф во вкладке «Сайт → Бронирование».',
      'Действующих производных тарифов: 1. Сначала выключите их.',
      'Броней впереди по тарифу: 4. Тариф выключается, когда по нему не остаётся будущих броней.',
    ]);
    await expect(asManager(() => service.update('rate-held', { active: false }))).rejects.toMatchObject({
      status: 409,
      message:
        'Тариф сопоставлен с менеджером каналов: сначала снимите сопоставление в «Каналах продаж». ' +
        'По этому тарифу бронирует сайт: сначала выберите другой тариф во вкладке «Сайт → Бронирование». ' +
        'Действующих производных тарифов: 1. Сначала выключите их. ' +
        'Броней впереди по тарифу: 4. Тариф выключается, когда по нему не остаётся будущих броней.',
    });
    expect(db.ratePlan.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('включить обратно можно всегда; то же значение — без записи и журнала', async () => {
    const off: Plan = {
      ...base,
      id: 'plan-off',
      code: 'rate-off',
      name: 'Выключенный',
      active: false,
      _count: { channelMappings: 1, trackedSites: 0, derived: 0 },
    };
    const { service, db } = setup([off, flex], { 'plan-off': 2 });
    const saved = await asManager(() => service.update('rate-off', { active: true }));
    expect(saved).toMatchObject({ code: 'rate-off', active: true });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'rate_plan.active.updated',
        before: { active: false },
        after: { active: true, upcomingReservations: 2 },
      }),
    });
    db.ratePlan.update.mockClear();
    db.auditLog.create.mockClear();
    await asManager(() => service.update('rate-flex', { active: true }));
    expect(db.ratePlan.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('оба поля сразу, не булево, неизвестное поле — 400; неизвестный тариф — 404', async () => {
    const { service, db } = setup();
    await expect(
      asManager(() => service.update('rate-flex', { active: false, cancellationPenalty: 'NONE' })),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Правило отмены и статус тарифа меняются отдельными запросами',
    });
    await expect(asManager(() => service.update('rate-flex', { active: 'no' }))).rejects.toMatchObject({
      status: 400,
      message: 'active: да или нет',
    });
    await expect(asManager(() => service.update('rate-flex', { enabled: true }))).rejects.toMatchObject({
      status: 400,
      message: 'Неизвестное поле: enabled',
    });
    await expect(asManager(() => service.update('rate-nope', { active: false }))).rejects.toMatchObject({
      status: 404,
      message: 'Тариф не найден',
    });
    // правило отмены через тот же маршрут работает по-прежнему
    const saved = await asManager(() => service.update('rate-flex', { cancellationPenalty: 'FULL_STAY' }));
    expect(saved.cancellationPenalty).toBe('FULL_STAY');
    expect(db.ratePlan.update).toHaveBeenCalledTimes(1);
  });

  it('производный тариф от выключенного родителя не создаётся', async () => {
    const off: Plan = { ...base, id: 'plan-off', code: 'rate-off', name: 'Выключенный', active: false };
    const { service, db } = setup([off, flex]);
    await expect(
      asManager(() =>
        service.createDerived({ name: 'Скидка', parentCode: 'rate-off', discountPercent: 10 }),
      ),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Родительский тариф выключен: сначала включите его',
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
