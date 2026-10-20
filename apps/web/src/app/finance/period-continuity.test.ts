import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement } from 'react';
import type { BeautyDay } from '../../lib/api';

vi.mock('next/navigation', () => ({
  unstable_rethrow: vi.fn(),
  redirect: (href: string) => { throw new Error(`REDIRECT:${href}`); },
}));
vi.mock('../../lib/vertical-guard', () => ({ requireFeature: vi.fn() }));
vi.mock('../../lib/api', async (original) => {
  const actual = await original<typeof import('../../lib/api')>();
  return { ...actual, beautyApi: { ...actual.beautyApi, financeDay: vi.fn() } };
});
import { beautyApi } from '../../lib/api';
import { requireFeature } from '../../lib/vertical-guard';
import { BeautyFinanceScreen } from './beauty-finance';
import FinanceReportPage from './page';

const day = (date = '2026-10-18'): BeautyDay => ({
  date,
  location: { id: 'unit-location', name: 'Unit salon', timezone: 'Pacific/Kiritimati', currency: 'KZT' },
  columns: [], appointments: [], services: [], bounds: { fromMinutes: 0, toMinutes: 1440 },
});
const asProps = (element: ReactElement): Record<string, unknown> => element.props as Record<string, unknown>;
const mockDay = vi.mocked(beautyApi.financeDay);

beforeEach(() => {
  vi.clearAllMocks();
  mockDay.mockImplementation(async (date) => day(date));
  vi.mocked(requireFeature).mockResolvedValue({ context: { vertical: 'BEAUTY' } } as Awaited<ReturnType<typeof requireFeature>>);
});

describe('finance route keeps date context', () => {
  it('passes the raw date parameters to BEAUTY before hospitality queries', async () => {
    const params = { from: '2026-10-01', to: '2026-10-18' };
    const screen = await FinanceReportPage({ searchParams: Promise.resolve(params) });
    expect(asProps(screen).searchParams).toEqual(params);
    expect(mockDay).not.toHaveBeenCalled();
  });
  it('preserves dates in FOOD_SERVICE redirect without copying unrelated query values', async () => {
    vi.mocked(requireFeature).mockResolvedValue({ context: { vertical: 'FOOD_SERVICE' } } as Awaited<ReturnType<typeof requireFeature>>);
    await expect(FinanceReportPage({ searchParams: Promise.resolve({ from: '2026-10-01', to: '2026-10-18', secret: 'ignore' }) }))
      .rejects.toThrow('REDIRECT:/restaurant-finance?from=2026-10-01&to=2026-10-18');
  });
});

describe('BEAUTY finance uses requested days instead of hardcoded week', () => {
  it.each([
    ['today', '2026-10-18', '2026-10-18', 1],
    ['week', '2026-10-12', '2026-10-18', 7],
    ['month', '2026-10-01', '2026-10-18', 18],
    ['historical', '2026-09-29', '2026-10-01', 3],
  ])('%s fetches exactly the requested inclusive window', async (_key, from, to, count) => {
    await BeautyFinanceScreen({ searchParams: { from, to } });
    const dates = mockDay.mock.calls.map(([date]) => date ?? '2026-10-18');
    const selected = dates.filter((date) => date >= from && date <= to);
    expect(new Set(selected).size).toBe(count);
    expect(dates.filter((date) => date !== '2026-10-18')).toHaveLength(count - Number(to === '2026-10-18'));
  });
  it('does not silently fall back to seven days for a reversed window', async () => {
    const page = await BeautyFinanceScreen({ searchParams: { from: '2026-10-18', to: '2026-10-01' } });
    const child = asProps(page).children;
    expect(isValidElement(child) && asProps(child).testId).toBe('beauty-finance-error');
    expect(mockDay.mock.calls.length).toBeLessThanOrEqual(1);
  });
  it('does not turn a failed selected day into zero money', async () => {
    mockDay.mockImplementation(async (date) => {
      if (date === '2026-10-01') throw new Error('unit selected day unavailable');
      return day(date);
    });
    const page = await BeautyFinanceScreen({ searchParams: { from: '2026-10-01', to: '2026-10-02' } });
    const child = asProps(page).children;
    expect(isValidElement(child) && asProps(child).testId).toBe('beauty-finance-error');
  });
  it('keeps no-query week based on API local today, not machine UTC date', async () => {
    mockDay.mockImplementation(async (date) => day(date ?? '2026-03-01'));
    const page = await BeautyFinanceScreen();
    expect(mockDay.mock.calls.map(([date]) => date)).toContain('2026-02-23');
    expect(asProps(page).subtitle).toContain('23 февр.');
    expect(asProps(page).subtitle).toContain('1 мар.');
    expect(mockDay).toHaveBeenCalledTimes(7);
  });
  it.each([
    { from: '2026-02-30', to: '2026-03-01' },
    { from: '', to: '2026-10-18' },
    { from: '2026-09-01', to: '2026-10-18' },
    { from: '2026-10-01', to: '2026-13-01' },
  ])('rejects an invalid or over-31-day window without querying its days: %j', async (searchParams) => {
    const page = await BeautyFinanceScreen({ searchParams });
    const child = asProps(page).children;
    expect(isValidElement(child) && asProps(child).testId).toBe('beauty-finance-error');
    expect(mockDay.mock.calls.length).toBeLessThanOrEqual(1);
  });
  it('uses the first repeated date value consistently with other Next routes', async () => {
    await BeautyFinanceScreen({ searchParams: { from: ['2026-10-17', 'invalid'], to: ['2026-10-18', 'invalid'] } });
    expect(mockDay).toHaveBeenCalledTimes(2);
    expect(mockDay).toHaveBeenCalledWith('2026-10-17');
  });
  it('refuses to combine mismatched source location or currency', async () => {
    mockDay.mockImplementation(async (date) => {
      const result = day(date);
      if (date === '2026-10-17') result.location = { ...result.location, id: 'other-location', currency: 'USD' };
      return result;
    });
    const page = await BeautyFinanceScreen({ searchParams: { from: '2026-10-17', to: '2026-10-18' } });
    const child = asProps(page).children;
    expect(isValidElement(child) && asProps(child).testId).toBe('beauty-finance-error');
  });
  it('bounds concurrent day requests', async () => {
    let active = 0;
    let maximum = 0;
    mockDay.mockImplementation(async (date) => {
      active++; maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => setImmediate(resolve));
      active--;
      return day(date);
    });
    await BeautyFinanceScreen({ searchParams: { from: '2026-10-01', to: '2026-10-18' } });
    expect(maximum).toBeLessThanOrEqual(4);
  });
});
