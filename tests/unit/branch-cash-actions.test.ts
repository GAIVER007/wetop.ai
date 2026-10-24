import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  me: vi.fn(),
  operation: vi.fn(),
  void: vi.fn(),
  reconcile: vi.fn(),
  menu: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: m.revalidate }));
vi.mock('next/navigation', () => ({ unstable_rethrow: () => {} }));
vi.mock('../../apps/web/src/lib/desk-shell', () => ({ currentMe: m.me }));
vi.mock('../../apps/web/src/lib/food-api', () => ({
  foodApi: {},
  restaurantApi: {
    cashOperation: m.operation,
    voidCashOperation: m.void,
    cashReconciliation: m.reconcile,
    createCategory: m.menu,
  },
}));
import { mutateCash, mutateMenu } from '../../apps/web/src/app/food/restaurant-actions';
const context = {
  businessId: 'synthetic-business',
  locationId: 'synthetic-location',
  vertical: 'BEAUTY',
};
const command = {
  kind: 'operation' as const,
  body: {
    kind: 'INCOME' as const,
    method: 'CASH' as const,
    amount: 100,
    idempotencyKey: 'test-same-key',
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  m.me.mockResolvedValue({
    user: {
      id: 'test-user',
      name: 'Test',
      email: 'test@example.invalid',
      role: 'OWNER',
      organization: { status: 'ACTIVE', trialEndsAt: null },
    },
    context,
  });
});
describe('branch cash server actions use verified capability context', () => {
  it.each(['BEAUTY', 'FOOD_SERVICE'])(
    'accepts shared branch cash for %s without rewriting the monetary command',
    async (vertical) => {
      m.me.mockResolvedValue({
        user: { role: 'OWNER', organization: { status: 'ACTIVE', trialEndsAt: null } },
        context: { ...context, vertical },
      });
      expect(await mutateCash('synthetic-business:synthetic-location', command)).toEqual({
        error: null,
      });
      expect(m.operation).toHaveBeenCalledExactlyOnceWith(command.body);
    },
  );
  it.each(['other-business:synthetic-location', 'synthetic-business:other-location'])(
    'rejects changed form context %s before API',
    async (key) => {
      expect((await mutateCash(key, command)).error).toBeTruthy();
      expect(m.operation).not.toHaveBeenCalled();
    },
  );
  // §62.3 (решение владельца 24.10.2026, K3): меню открыто салону и гостинице как «Меню бара»; ключ филиала проверяется
  it('opens the shared bar menu to beauty for its own branch only', async () => {
    expect(
      (
        await mutateMenu('synthetic-business:synthetic-location', {
          kind: 'category',
          body: { name: 'Synthetic' },
        })
      ).error,
    ).toBeNull();
    expect(m.menu).toHaveBeenCalledOnce();
    expect(m.revalidate).toHaveBeenCalledWith('/bar/menu');
    m.menu.mockClear();
    expect((await mutateMenu('synthetic-business:other-location', { kind: 'category', body: { name: 'Synthetic' } })).error).toMatch(/другой салон/);
    expect(m.menu).not.toHaveBeenCalled();
  });
  it('does not move hotel folio cash into the branch ledger', async () => {
    m.me.mockResolvedValue({
      user: { role: 'OWNER' },
      context: { ...context, vertical: 'HOSPITALITY' },
    });
    expect((await mutateCash('synthetic-business:synthetic-location', command)).error).toBeTruthy();
    expect(m.operation).not.toHaveBeenCalled();
  });
  it('fails closed for an unrecognized role', async () => {
    m.me.mockResolvedValue({ user: { role: 'UNKNOWN' }, context });
    expect((await mutateCash('synthetic-business:synthetic-location', command)).error).toBeTruthy();
    expect(m.operation).not.toHaveBeenCalled();
  });
  it('keeps API denial as failure, never a false success', async () => {
    m.me.mockResolvedValue({
      user: { role: 'OWNER' },
      context: { ...context, vertical: 'FOOD_SERVICE' },
    });
    m.operation.mockRejectedValue(new Error('Access denied'));
    expect(await mutateCash('synthetic-business:synthetic-location', command)).toMatchObject({
      error: 'Access denied',
    });
    expect(m.revalidate).not.toHaveBeenCalled();
  });
  it('rejects organization read-only state before monetary API', async () => {
    m.me.mockResolvedValue({
      user: { role: 'OWNER', organization: { status: 'READ_ONLY', trialEndsAt: null } },
      context: { ...context, vertical: 'FOOD_SERVICE' },
    });
    expect((await mutateCash('synthetic-business:synthetic-location', command)).error).toBeTruthy();
    expect(m.operation).not.toHaveBeenCalled();
  });
});

// В салоне с назначенными должностями право решает должность (request-context.ts:204), а не старая роль:
// STAFF с finance.refund делает возврат, а STAFF без finance.create не отправляет операцию в API.
describe('salon positions decide branch cash rights in ASSIGNED mode', () => {
  const staff = (permissions: Array<{ section: string; action: string; scope: string }>) => ({
    user: {
      id: 'test-user',
      name: 'Test',
      email: 'test@example.invalid',
      role: 'STAFF',
      organization: { status: 'ACTIVE', trialEndsAt: null },
    },
    beautyAccess: { mode: 'ASSIGNED', assigned: true, permissions },
    context,
  });
  it('lets STAFF with finance.refund void an operation', async () => {
    m.me.mockResolvedValue(staff([{ section: 'finance', action: 'refund', scope: 'BUSINESS' }]));
    expect(await mutateCash('synthetic-business:synthetic-location', { kind: 'void', id: 'op-1' })).toEqual({
      error: null,
    });
    expect(m.void).toHaveBeenCalledExactlyOnceWith('op-1');
  });
  it('blocks STAFF without finance.create before the API', async () => {
    m.me.mockResolvedValue(staff([{ section: 'finance', action: 'refund', scope: 'BUSINESS' }]));
    expect((await mutateCash('synthetic-business:synthetic-location', command)).error).toBeTruthy();
    expect(m.operation).not.toHaveBeenCalled();
  });
  it('lets STAFF with finance.update reconcile the register', async () => {
    m.me.mockResolvedValue(staff([{ section: 'finance', action: 'update', scope: 'BUSINESS' }]));
    expect(
      await mutateCash('synthetic-business:synthetic-location', {
        kind: 'reconcile',
        body: { method: 'CASH', counted: 100 },
      }),
    ).toEqual({ error: null });
    expect(m.reconcile).toHaveBeenCalledOnce();
  });
  it('keeps the legacy role rule in a restaurant: STAFF cannot void', async () => {
    m.me.mockResolvedValue({
      ...staff([{ section: 'finance', action: 'refund', scope: 'BUSINESS' }]),
      context: { ...context, vertical: 'FOOD_SERVICE' },
    });
    expect((await mutateCash('synthetic-business:synthetic-location', { kind: 'void', id: 'op-1' })).error).toBeTruthy();
    expect(m.void).not.toHaveBeenCalled();
  });
});
