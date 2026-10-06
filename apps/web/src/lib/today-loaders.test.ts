import { describe, expect, it, vi } from 'vitest';
import { loadBeautyToday, loadFoodToday, verifiedTodayScope } from './today-loaders';
import type { BeautyDay } from './api';
import type { foodApi } from './food-api';
const now = new Date('2026-10-04T20:30:00Z');
const day = {
  date: '2026-10-05',
  location: { id: 'l', timezone: 'Asia/Dubai' },
  columns: [],
  appointments: [],
} as unknown as BeautyDay;
describe('MV8 verified scope', () => {
  it('rejects absent/auth fallback/invalid scope before domain calls', () => {
    for (const me of [
      null,
      {},
      { user: {} },
      { user: {}, context: { vertical: 'UNKNOWN', businessId: 'b', locationId: 'l' } },
      { user: {}, context: { vertical: 'BEAUTY', businessId: 'b' } },
    ])
      expect(() => verifiedTodayScope(me)).toThrow();
    expect(
      verifiedTodayScope({
        user: {},
        context: { vertical: 'BEAUTY', businessId: 'b', locationId: 'l' },
      }),
    ).toEqual({ vertical: 'BEAUTY', businessId: 'b', locationId: 'l' });
  });
});
describe('MV8 minimal loaders', () => {
  it('missing timezone never falls back to server timezone', async () => {
    await expect(
      loadBeautyToday(
        async () =>
          ({
            ...day,
            date: '2026-10-04',
            location: { ...day.location, timezone: undefined },
          }) as unknown as BeautyDay,
        'l',
        () => now,
      ),
    ).rejects.toThrow();
  });
  it('uses server Beauty day without query date, local minutes and location check', async () => {
    const read = vi.fn().mockResolvedValue(day);
    expect(await loadBeautyToday(read, 'l', () => now)).toMatchObject({
      minute: 30,
      day: { date: '2026-10-05' },
    });
    expect(read.mock.calls).toEqual([[]]);
    await expect(loadBeautyToday(read, 'foreign', () => now)).rejects.toThrow();
  });
  it('bounded reread on midnight, fails closed if still inconsistent', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ ...day, date: '2026-10-04' })
      .mockResolvedValue(day);
    expect(await loadBeautyToday(read, 'l', () => now)).toMatchObject({ minute: 30 });
    expect(read).toHaveBeenCalledTimes(2);
    await expect(
      loadBeautyToday(
        async () => ({ ...day, date: '2026-10-04' }),
        'l',
        () => now,
      ),
    ).rejects.toThrow();
  });
  it('does not turn invalid timezone/partial Beauty response into facts', async () => {
    await expect(
      loadBeautyToday(
        async () => ({ ...day, location: { ...day.location, timezone: 'Bad/Zone' } }),
        'l',
        () => now,
      ),
    ).rejects.toThrow();
    await expect(
      loadBeautyToday(
        async () => ({ ...day, appointments: null }) as unknown as BeautyDay,
        'l',
        () => now,
      ),
    ).rejects.toThrow();
  });
  it('rejects malformed Beauty rows and master labels instead of displaying zero facts', async () => {
    for (const invalid of [
      { ...day, appointments: [{}] },
      { ...day, columns: [{}] },
    ])
      await expect(
        loadBeautyToday(
          async () => invalid as BeautyDay,
          'l',
          () => now,
        ),
      ).rejects.toThrow();
  });
  it('fully paginates both local days and deduplicates IDs without catalogue reads', async () => {
    const dates: string[] = [];
    const ids = Array.from({ length: 101 }, (_, i) => ({ id: String(i) }));
    const api = {
      areas: vi.fn(async () => ({ items: [], nextCursor: null })),
      tables: vi.fn(async () => ({ items: [], nextCursor: null })),
      reservations: vi.fn(async (date: string, cursor?: string) => {
        dates.push(date);
        return {
          items: cursor ? ids.slice(100) : ids.slice(0, 100),
          nextCursor: cursor ? null : 'next',
        };
      }),
    };
    const data = await loadFoodToday(
      api as unknown as typeof foodApi,
      'Asia/Dubai',
      now,
      () => true,
    );
    expect(data.rows).toHaveLength(101);
    expect(dates).toEqual(expect.arrayContaining(['2026-10-05', '2026-10-04']));
    expect(api.reservations).toHaveBeenCalledTimes(4);
  });
  it('fails for broken pagination and any required source', async () => {
    const api = {
      areas: async () => ({ items: [], nextCursor: null }),
      tables: async () => {
        throw new Error('offline');
      },
      reservations: async () => ({ items: [], nextCursor: null }),
    };
    await expect(loadFoodToday(api as unknown as typeof foodApi, 'UTC', now)).rejects.toThrow(
      'offline',
    );
    const repeated = {
      ...api,
      tables: api.areas,
      reservations: async () => ({ items: [{ id: 'a' }], nextCursor: 'same' }),
    };
    await expect(
      loadFoodToday(repeated as unknown as typeof foodApi, 'UTC', now, () => true),
    ).rejects.toThrow('Повтор');
  });
});
