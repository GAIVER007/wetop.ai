import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mutateStaff } from './restaurant-actions';

/**
 * Зарплата общая у ресторана и салона (ADR-SALON-PAYROLL-20261016): окно «Оплата» салона сохраняло условия через
 * mutateStaff, а та пускала только ресторан и отвечала «Выбран другой ресторан» (жалоба владельца 26.10.2026).
 */
const mocks = vi.hoisted(() => ({
  currentMe: vi.fn(),
  setPaySettings: vi.fn(),
  payout: vi.fn(),
  addPayAdjustment: vi.fn(),
  createEmployee: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('next/navigation', () => ({ unstable_rethrow() {} }));
vi.mock('../../lib/desk-shell', () => ({ currentMe: mocks.currentMe }));
vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  dishPhotoApi: {},
}));
vi.mock('../../lib/food-api', () => ({
  foodApi: {},
  restaurantApi: {
    setPaySettings: mocks.setPaySettings,
    payout: mocks.payout,
    addPayAdjustment: mocks.addPayAdjustment,
    createEmployee: mocks.createEmployee,
    updateEmployee: vi.fn(),
  },
}));

const key = 'synthetic-business:synthetic-location';
const as = (vertical: string, locationId = 'synthetic-location') =>
  mocks.currentMe.mockResolvedValue({
    context: { vertical, businessId: 'synthetic-business', locationId },
  });
const pay = {
  kind: 'pay-settings' as const,
  id: 'e1',
  body: { model: 'PERCENT' as const, fixedMinor: 0, percent: 30 },
};

describe('зарплата салона и ресторана: одно действие', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['BEAUTY', 'FOOD_SERVICE'])('%s: условия оплаты сохраняются', async (vertical) => {
    as(vertical);
    await expect(mutateStaff(key, pay)).resolves.toEqual({ error: null });
    expect(mocks.setPaySettings).toHaveBeenCalledWith('e1', pay.body);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/payroll');
  });

  it('салон: премия или удержание и выплата тоже проходят', async () => {
    as('BEAUTY');
    await expect(
      mutateStaff(key, {
        kind: 'adjustment',
        id: 'e1',
        body: { period: '2026-10', amountMinor: 1000, reason: 'Премия' },
      }),
    ).resolves.toEqual({ error: null });
    await expect(
      mutateStaff(key, {
        kind: 'payout',
        id: 'e1',
        body: { period: '2026-10', method: 'CASH', amount: 100, idempotencyKey: 'k1' },
      }),
    ).resolves.toEqual({ error: null });
    expect(mocks.addPayAdjustment).toHaveBeenCalledOnce();
    expect(mocks.payout).toHaveBeenCalledOnce();
  });

  it('салон, сменили филиал: ошибка про салон, не про ресторан, и ничего не сохранено', async () => {
    as('BEAUTY', 'other-location');
    const result = await mutateStaff(key, pay);
    expect(result.error).toBe('Выбран другой салон. Откройте форму заново.');
    expect(mocks.setPaySettings).not.toHaveBeenCalled();
  });

  it('гостиница через это действие не сохраняет: у неё свой экран начислений', async () => {
    as('HOSPITALITY');
    expect((await mutateStaff(key, pay)).error).toBeTruthy();
    expect(mocks.setPaySettings).not.toHaveBeenCalled();
  });

  it('карточка сотрудника ресторана по-прежнему только у ресторана', async () => {
    as('BEAUTY');
    expect(
      (await mutateStaff(key, { kind: 'create', body: { name: 'Синтетика' } })).error,
    ).toBeTruthy();
    expect(mocks.createEmployee).not.toHaveBeenCalled();
  });
});
