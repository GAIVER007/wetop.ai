import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as string[]);
const state = vi.hoisted(() => ({
  day: null as unknown,
  branch: null as unknown,
  pages: {} as Record<string, Array<{ items: unknown[]; nextCursor: string | null }>>,
}));

vi.mock('../../lib/api', () => ({
  beautyApi: new Proxy(
    {},
    {
      get: (_t, name: string) => async () => {
        calls.push(`beauty.${name}`);
        if (name !== 'day') throw new Error(`лишний запрос beauty.${name}`);
        return state.day;
      },
    },
  ),
}));
vi.mock('../../lib/workspace-context', () => ({
  selectedWorkspaceBranch: async () => state.branch,
}));
const page = (key: string, cursor?: string) => {
  calls.push(cursor ? `${key}@${cursor}` : key);
  const pages = state.pages[key] ?? [{ items: [], nextCursor: null }];
  return pages[cursor ? Number(cursor) : 0];
};
vi.mock('../../lib/food-api', () => ({
  foodApi: new Proxy(
    {},
    {
      get: (_t, name: string) =>
        name === 'reservations'
          ? async (date: string, cursor?: string) => page(`food.reservations:${date}`, cursor)
          : name === 'areas' || name === 'tables'
            ? async (cursor?: string) => page(`food.${name}`, cursor)
            : () => {
                throw new Error(`лишний запрос food.${name}`);
              },
    },
  ),
}));

const { loadBeautyToday, loadFoodToday } = await import('./vertical-load');

const reservation = (id: string, startsAt: string, endsAt: string, status = 'CONFIRMED') => ({
  id,
  locationId: 'l',
  customerId: 'c',
  servicePeriodId: 'p',
  startsAt,
  endsAt,
  partySize: 2,
  status,
  source: 'DESK',
  notes: null,
  updatedAt: '2026-10-07T00:00:00.000Z',
  customer: { id: 'c', firstName: 'Гость', lastName: null, phone: null, status: 'ACTIVE' },
  servicePeriod: { id: 'p', name: 'Ужин' },
  table: null,
  nextStatuses: [],
});

beforeEach(() => {
  calls.length = 0;
  state.pages = {};
});

describe('загрузка «Сегодня» салона', () => {
  it('один запрос дня журнала; мастера из столбцов, без справочника мастеров и клиентов', async () => {
    state.day = {
      location: { id: 'l', name: 'Салон', timezone: 'Asia/Almaty', currency: 'KZT' },
      date: '2026-10-08',
      columns: [
        {
          id: 'm',
          name: 'Анна',
          intervals: [],
          timeOff: false,
          timeOffReason: null,
          serviceIds: [],
        },
      ],
      appointments: [],
      services: [],
      bounds: { fromMinutes: 540, toMinutes: 1260 },
    };
    const loaded = await loadBeautyToday('2026-10-07T23:30:00.000Z');
    expect(calls).toEqual(['beauty.day']);
    expect(loaded.metrics.masters).toBe(1);
    // 23:30 UTC это 04:30 8 октября в Алматы: текущая минута по поясу филиала, а не по UTC
    expect(loaded.currentMinute).toBe(270);
  });
});

describe('загрузка «Сегодня» ресторана', () => {
  beforeEach(() => {
    state.branch = {
      name: 'Ресторан',
      timezone: 'Asia/Almaty',
      locationId: 'l',
      location: { businessId: 'b' },
    };
  });

  it('день и вчерашний день по поясу филиала; только залы, столы и брони', async () => {
    const loaded = await loadFoodToday('2026-10-07T20:30:00.000Z');
    expect(loaded.date).toBe('2026-10-08');
    expect(calls.sort()).toEqual([
      'food.areas',
      'food.reservations:2026-10-07',
      'food.reservations:2026-10-08',
      'food.tables',
    ]);
  });

  it('больше 100 броней: дочитывает все страницы, ничего не теряет', async () => {
    const many = Array.from({ length: 150 }, (_, n) =>
      reservation(`r${n}`, '2026-10-08T10:00:00.000Z', '2026-10-08T11:00:00.000Z'),
    );
    state.pages['food.reservations:2026-10-08'] = [
      { items: many.slice(0, 100), nextCursor: '1' },
      { items: many.slice(100), nextCursor: null },
    ];
    const loaded = await loadFoodToday('2026-10-08T05:00:00.000Z');
    expect(loaded.metrics.reservations).toBe(150);
    expect(calls).toContain('food.reservations:2026-10-08@1');
  });

  it('бронь вчерашнего дня через полночь сидит сейчас, но в брони дня не входит', async () => {
    state.pages['food.reservations:2026-10-07'] = [
      {
        items: [
          reservation('night', '2026-10-07T17:00:00.000Z', '2026-10-07T20:00:00.000Z', 'SEATED'),
        ],
        nextCursor: null,
      },
    ];
    const loaded = await loadFoodToday('2026-10-07T19:30:00.000Z');
    expect(loaded.metrics).toMatchObject({ seatedNow: 1, reservations: 0 });
  });

  it('филиал не выбран или недоступен: ошибка, а не чужие числа', async () => {
    state.branch = null;
    await expect(loadFoodToday('2026-10-07T10:00:00.000Z')).rejects.toThrow('Выбранный филиал');
    expect(calls).toEqual([]);
  });
});
