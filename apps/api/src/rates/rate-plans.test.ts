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
};
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
  const store = plans.map((p) => ({ ...p }));
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
      },
      {
        code: 'rate-flex',
        name: 'Гибкий',
        currency: 'KZT',
        active: true,
        cancellationPenalty: 'NONE',
        categories: [],
        upcomingReservations: 0,
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
