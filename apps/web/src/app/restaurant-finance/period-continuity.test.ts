import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement } from 'react';
import { restaurantApi } from '../../lib/food-api';
import { restaurantShell } from '../food/restaurant-load';
import RestaurantFinancePage from './page';
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
vi.mock('../../lib/food-api', () => ({ restaurantApi: { cash: vi.fn() } }));
vi.mock('../food/restaurant-load', () => ({ restaurantShell: vi.fn() }));
const props = (e: ReactElement) => e.props as Record<string, unknown>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(restaurantShell).mockResolvedValue({ date: '2026-10-18', scopeKey: 'unit-scope', timezone: 'Pacific/Kiritimati' } as Awaited<ReturnType<typeof restaurantShell>>);
  vi.mocked(restaurantApi.cash).mockResolvedValue({} as Awaited<ReturnType<typeof restaurantApi.cash>>);
});
describe('restaurant finance date context', () => {
  it('preserves exact valid owner dates', async () => {
    await RestaurantFinancePage({ searchParams: Promise.resolve({ from: '2026-09-29', to: '2026-10-01' }) });
    expect(restaurantApi.cash).toHaveBeenCalledExactlyOnceWith({ from: '2026-09-29', to: '2026-10-01' });
  });
  it('uses the first repeated date like the other Next routes', async () => {
    await RestaurantFinancePage({ searchParams: Promise.resolve({ from: ['2026-10-03', 'invalid'], to: ['2026-10-09', 'invalid'] }) });
    expect(restaurantApi.cash).toHaveBeenCalledExactlyOnceWith({ from: '2026-10-03', to: '2026-10-09' });
  });
  it.each([
    { from: '2026-10-18', to: '2026-10-01' },
    { from: '2026-02-30', to: '2026-03-01' },
    { from: '2026-07-01', to: '2026-10-18' },
  ])('invalid dates are an error, not a silently changed period: %j', async (params) => {
    const page = await RestaurantFinancePage({ searchParams: Promise.resolve(params) });
    expect(restaurantApi.cash).not.toHaveBeenCalled();
    const child = props(page).children;
    expect(isValidElement(child) && props(child).testId).toBe('restaurant-finance-error');
  });
  it('keeps the existing no-query month-to-date based on the restaurant clock', async () => {
    await RestaurantFinancePage({ searchParams: Promise.resolve({}) });
    expect(restaurantApi.cash).toHaveBeenCalledExactlyOnceWith({ from: '2026-10-01', to: '2026-10-18' });
  });
});
