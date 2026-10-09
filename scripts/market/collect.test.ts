import { describe, expect, it } from 'vitest';
import type { NightObservation } from '@pms/domain';
import { collect, type CollectorCompetitor } from './collect';

const NOW = new Date('2026-10-09T10:00:00Z');
const base: Omit<CollectorCompetitor, 'id' | 'name' | 'url' | 'unitsTotal'> = { timezone: 'Asia/Almaty' };

function setup(
  competitors: CollectorCompetitor[],
  page: (url: string) => { status: number; text: string },
  seen: (night: string) => NightObservation,
) {
  const writes: Array<{ id: string; entries: Array<{ date: string; percent: number }> }> = [];
  const pages: string[] = [];
  const sleeps: number[] = [];
  const deps = {
    api: {
      competitors: async () => competitors,
      write: async (id: string, entries: Array<{ date: string; percent: number }>) => {
        writes.push({ id, entries });
        return { saved: entries.length, kept: 0 };
      },
    },
    readPage: async (url: string) => {
      pages.push(url);
      return page(url);
    },
    extract: async (_text: string, ctx: { night: string }) => seen(ctx.night),
  };
  const run = (dryRun = false) =>
    collect(deps, { nights: 3, delayMs: 5000, dryRun, now: NOW, sleep: async (ms) => void sleeps.push(ms) });
  return { run, writes, pages, sleeps };
}

const altyn: CollectorCompetitor = {
  ...base,
  id: 'a',
  name: 'Отель Алтын',
  url: 'https://www.booking.com/hotel/kz/altyn.ru.html',
  unitsTotal: 40,
};

describe('ИИ-сборщик загрузки конкурентов', () => {
  it('открывает страницу на каждую ночь, оценивает загрузку и пишет снимок с паузой между страницами', async () => {
    const left: Record<string, NightObservation> = {
      '2026-10-09': { status: 'available', roomsLeft: 10 },
      '2026-10-10': { status: 'sold_out', roomsLeft: null },
      '2026-10-11': { status: 'available', roomsLeft: null },
    };
    const s = setup([altyn], () => ({ status: 200, text: 'страница' }), (n) => left[n]!);
    const [report] = await s.run();
    expect(s.pages.map((u) => new URL(u).searchParams.get('checkin'))).toEqual([
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
    // ночь без видимого остатка не пишется: оценки нет
    expect(s.writes).toEqual([
      { id: 'a', entries: [{ date: '2026-10-09', percent: 75 }, { date: '2026-10-10', percent: 100 }] },
    ]);
    expect(s.sleeps).toEqual([5000, 5000]);
    expect(report?.outcome).toBe('written');
  });

  it('страница закрыта проверкой площадки: не обходит, останавливается по соседу, уже оценённое пишет', async () => {
    const s = setup(
      [altyn],
      (url) => ({ status: new URL(url).searchParams.get('checkin') === '2026-10-10' ? 403 : 200, text: '' }),
      () => ({ status: 'available', roomsLeft: 4 }),
    );
    const [report] = await s.run();
    expect(s.pages).toHaveLength(2);
    expect(report?.outcome).toBe('blocked');
    expect(report?.reason).toContain('не обходим');
    expect(s.writes).toEqual([{ id: 'a', entries: [{ date: '2026-10-09', percent: 90 }] }]);
  });

  it('Booking.com отвечает автомату 202 и пустой страницей: это проверка площадки, модель не зовём', async () => {
    let asked = 0;
    const s = setup([altyn], () => ({ status: 202, text: 'Куда поедете?' }), () => {
      asked += 1;
      return { status: 'available', roomsLeft: 1 };
    });
    const [report] = await s.run();
    expect(report?.outcome).toBe('blocked');
    expect(asked).toBe(0);
    expect(s.writes).toEqual([]);
  });

  it('модель увидела проверку на странице с кодом 200: то же самое, дальше не идёт', async () => {
    const s = setup([altyn], () => ({ status: 200, text: '' }), () => ({ status: 'blocked', roomsLeft: null }));
    const [report] = await s.run();
    expect(s.pages).toHaveLength(1);
    expect(report?.outcome).toBe('blocked');
    expect(s.writes).toEqual([]);
  });

  it('без ссылки на площадку или без числа номеров страницу не открывает', async () => {
    const s = setup(
      [
        { ...altyn, id: 'b', url: 'https://altyn-hotel.kz/' },
        { ...altyn, id: 'c', url: null },
        { ...altyn, id: 'd', unitsTotal: null },
      ],
      () => ({ status: 200, text: '' }),
      () => ({ status: 'sold_out', roomsLeft: null }),
    );
    const reports = await s.run();
    expect(s.pages).toEqual([]);
    expect(reports.map((r) => r.outcome)).toEqual(['skipped', 'skipped', 'skipped']);
    expect(reports[2]?.reason).toContain('число номеров');
  });

  it('проверка без записи: читает и оценивает, в WETOP ничего не пишет', async () => {
    const s = setup([altyn], () => ({ status: 200, text: '' }), () => ({ status: 'sold_out', roomsLeft: null }));
    const [report] = await s.run(true);
    expect(s.pages).toHaveLength(3);
    expect(s.writes).toEqual([]);
    expect(report?.outcome).toBe('dry-run');
    expect(report?.nights.map((n) => n.bp)).toEqual([10000, 10000, 10000]);
  });
});

describe('ответ модели', () => {
  it('принимает только то, что прошло проверку; остаток бывает только у «продаётся»', async () => {
    const { parseObservation } = await import('./sources');
    expect(parseObservation('{"status":"available","roomsLeft":3,"evidence":"Only 3 rooms left"}')).toEqual({
      status: 'available',
      roomsLeft: 3,
    });
    expect(parseObservation('{"status":"sold_out","roomsLeft":5,"evidence":""}')).toEqual({
      status: 'sold_out',
      roomsLeft: null,
    });
    expect(parseObservation('{"status":"available","roomsLeft":-1}')).toEqual({ status: 'available', roomsLeft: null });
    expect(parseObservation('{"status":"maybe"}')).toEqual({ status: 'unknown', roomsLeft: null });
    expect(parseObservation('не JSON')).toEqual({ status: 'unknown', roomsLeft: null });
  });
});
