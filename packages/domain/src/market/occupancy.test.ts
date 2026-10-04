import { describe, expect, it } from 'vitest';
import {
  MarketInputError,
  buildMarketBoard,
  buildNightHistory,
  demandLevel,
  formatOccupancy,
  marketDates,
  parseCompetitorInput,
  parseOccupancyPercent,
  type MarketReading,
} from './occupancy';

/** ADR-142, DATA_MODEL §23: загрузка конкурентов, «вы и рынок» по ночам */
describe('parseOccupancyPercent', () => {
  it('процент в базисные пункты: целый, с запятой и точкой, знак процента', () => {
    expect(parseOccupancyPercent('85')).toBe(8500);
    expect(parseOccupancyPercent('85,5')).toBe(8550);
    expect(parseOccupancyPercent(' 92.25 % ')).toBe(9225);
    expect(parseOccupancyPercent(0)).toBe(0);
    expect(parseOccupancyPercent('100')).toBe(10000);
  });
  it('пусто: значения нет', () => {
    expect(parseOccupancyPercent('')).toBeNull();
    expect(parseOccupancyPercent(null)).toBeNull();
    expect(parseOccupancyPercent(undefined)).toBeNull();
  });
  it('мимо 0…100, больше двух знаков после запятой и не число: отказ словами', () => {
    expect(() => parseOccupancyPercent('101')).toThrow(MarketInputError);
    expect(() => parseOccupancyPercent('-1')).toThrow('от 0 до 100');
    expect(() => parseOccupancyPercent('85,555')).toThrow(MarketInputError);
    expect(() => parseOccupancyPercent('много')).toThrow(MarketInputError);
  });
});

describe('formatOccupancy и demandLevel', () => {
  it('без лишних нулей, запятая', () => {
    expect(formatOccupancy(8500)).toBe('85 %');
    expect(formatOccupancy(8550)).toBe('85,5 %');
    expect(formatOccupancy(9225)).toBe('92,25 %');
  });
  it('уровни спроса по порогам Q-258', () => {
    expect(demandLevel(8500)).toBe('high');
    expect(demandLevel(8499)).toBe('mid');
    expect(demandLevel(5000)).toBe('low');
    expect(demandLevel(null)).toBeNull();
  });
});

describe('parseCompetitorInput', () => {
  it('название обязательно при создании, поля чистятся', () => {
    expect(
      parseCompetitorInput({ name: '  Отель Соседний ', distanceM: '350', unitsTotal: 40 }, 'create'),
    ).toEqual({ name: 'Отель Соседний', distanceM: 350, unitsTotal: 40 });
    expect(() => parseCompetitorInput({}, 'create')).toThrow('Название');
  });
  it('пустые необязательные поля при правке снимаются (null)', () => {
    expect(parseCompetitorInput({ distanceM: '', url: '', note: '' }, 'update')).toEqual({
      distanceM: null,
      url: null,
      note: null,
    });
  });
  it('отрицательное расстояние, ноль номеров, адрес не http: отказ', () => {
    expect(() => parseCompetitorInput({ name: 'A', distanceM: -5 }, 'create')).toThrow(
      MarketInputError,
    );
    expect(() => parseCompetitorInput({ name: 'A', unitsTotal: 0 }, 'create')).toThrow(
      MarketInputError,
    );
    expect(() => parseCompetitorInput({ name: 'A', url: 'javascript:alert(1)' }, 'create')).toThrow(
      'Ссылка',
    );
  });
});

describe('marketDates', () => {
  it('окно подряд, через границу месяца', () => {
    expect(marketDates('2026-10-30', 4)).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });
});

const dates = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'];
const competitors = [
  { id: 'a', name: 'Альфа', distanceM: 200, unitsTotal: 30, url: null },
  { id: 'b', name: 'Бета', distanceM: 900, unitsTotal: null, url: null },
  { id: 'c', name: 'Гамма', distanceM: null, unitsTotal: null, url: null },
];
const r = (
  competitorId: string,
  stayDate: string,
  observedOn: string,
  occupancyBp: number,
  source: 'MANUAL' | 'AI_AGENT' = 'MANUAL',
): MarketReading => ({ competitorId, stayDate, observedOn, occupancyBp, source });

const own = {
  // 10 мест: 6 занято, 1 блок → 60 %; 2 → 20 %; 9 → 90 %; 3 → 30 %
  '2026-10-04': { occupied: 6, free: 3, blocked: 1 },
  '2026-10-05': { occupied: 2, free: 8, blocked: 0 },
  '2026-10-06': { occupied: 9, free: 1, blocked: 0 },
  '2026-10-07': { occupied: 3, free: 7, blocked: 0 },
};

const readings: MarketReading[] = [
  // Альфа: снимок 02.10 и свежий 03.10 на 04.10 (изменение +10 п.п.)
  r('a', '2026-10-04', '2026-10-02', 8000),
  r('a', '2026-10-04', '2026-10-03', 9000, 'AI_AGENT'),
  r('a', '2026-10-05', '2026-10-02', 4000),
  r('a', '2026-10-06', '2026-10-03', 9000),
  r('a', '2026-10-07', '2026-10-03', 3000),
  // Бета: только 04.10 и 05.10
  r('b', '2026-10-04', '2026-10-03', 10000),
  r('b', '2026-10-05', '2026-10-03', 5000),
  r('b', '2026-10-06', '2026-10-03', 8000),
  r('b', '2026-10-07', '2026-10-03', 4000),
  // снимок «из будущего» относительно даты снимка не видно
  r('b', '2026-10-04', '2026-10-05', 1000),
];

describe('buildMarketBoard', () => {
  const board = buildMarketBoard({
    dates,
    asOf: '2026-10-03',
    compareDays: 1,
    own,
    competitors,
    readings,
  });

  it('своя загрузка из календаря: занято от занято + свободно + блок', () => {
    expect(board.own.map((x) => x.bp)).toEqual([6000, 2000, 9000, 3000]);
  });

  it('клетка конкурента: последний снимок не позже даты снимка и изменение к сравнению', () => {
    const a = board.competitors.find((c) => c.id === 'a')!;
    expect(a.cells[0]).toEqual({ date: '2026-10-04', bp: 9000, deltaBp: 1000, source: 'AI_AGENT' });
    // 05.10 последний снимок 02.10, то есть не новее даты сравнения: изменения не знаем
    expect(a.cells[1]).toEqual({ date: '2026-10-05', bp: 4000, deltaBp: null, source: 'MANUAL' });
    expect(a.sources).toEqual(['AI_AGENT', 'MANUAL']);
    expect(a.lastObservedOn).toBe('2026-10-03');
    const b = board.competitors.find((c) => c.id === 'b')!;
    expect(b.cells[0]!.bp).toBe(10000);
    expect(board.competitors.find((c) => c.id === 'c')!.cells.every((x) => x.bp === null)).toBe(
      true,
    );
  });

  it('конкуренты по расстоянию, без расстояния последними', () => {
    expect(board.competitors.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('средняя по рынку: простое среднее по конкурентам с данными; разница с вами', () => {
    expect(board.market).toEqual([
      { date: '2026-10-04', bp: 9500, count: 2 },
      { date: '2026-10-05', bp: 4500, count: 2 },
      { date: '2026-10-06', bp: 8500, count: 2 },
      { date: '2026-10-07', bp: 3500, count: 2 },
    ]);
    expect(board.gap.map((g) => g.bp)).toEqual([-3500, -2500, 500, -500]);
  });

  it('итог окна: рынок средним по дням, вы от суммы клеток, дни высокого спроса', () => {
    expect(board.summary).toEqual({
      marketBp: 6500,
      ownBp: 5000,
      gapBp: -1500,
      highDemandNights: 2,
      competitors: 3,
      competitorsWithData: 2,
    });
  });

  it('подсказки: высокий спрос с отставанием, высокий спрос, слабый спрос, нет данных', () => {
    expect(board.insights.map((i) => [i.kind, i.from, i.to])).toEqual([
      ['high-behind', '2026-10-04', '2026-10-04'],
      ['high', '2026-10-06', '2026-10-06'],
      ['low', '2026-10-05', '2026-10-05'],
      ['low', '2026-10-07', '2026-10-07'],
      ['missing', '2026-10-04', '2026-10-07'],
    ]);
    expect(board.insights[0]).toMatchObject({ nights: 1, marketBp: 9500, ownBp: 6000 });
    expect(board.insights.at(-1)!.competitors).toEqual(['Гамма']);
  });

  it('ночи одного правила подряд склеиваются в отрезок, подсказок не больше пяти', () => {
    const b2 = buildMarketBoard({
      dates,
      asOf: '2026-10-03',
      compareDays: 0,
      own: Object.fromEntries(dates.map((d) => [d, { occupied: 1, free: 9, blocked: 0 }])),
      competitors: [competitors[0]!],
      readings: dates.map((d) => r('a', d, '2026-10-03', 9500)),
    });
    expect(b2.insights).toHaveLength(1);
    expect(b2.insights[0]).toMatchObject({
      kind: 'high-behind',
      from: '2026-10-04',
      to: '2026-10-07',
      nights: 4,
    });
    expect(b2.competitors[0]!.cells[0]!.deltaBp).toBeNull();
  });

  it('пустой календарь (нет мест) и рынок без данных: прочерки, без деления на ноль', () => {
    const b3 = buildMarketBoard({
      dates: ['2026-10-04'],
      asOf: '2026-10-03',
      compareDays: 7,
      own: {},
      competitors: [],
      readings: [],
    });
    expect(b3.own[0]!.bp).toBeNull();
    expect(b3.market[0]).toEqual({ date: '2026-10-04', bp: null, count: 0 });
    expect(b3.summary).toMatchObject({ marketBp: null, ownBp: null, gapBp: null });
    expect(b3.insights).toEqual([]);
  });
});

describe('buildNightHistory', () => {
  const comps = [
    { id: 'a', name: 'Альфа', distanceM: 100, unitsTotal: null, url: null },
    { id: 'b', name: 'Бета', distanceM: 300, unitsTotal: null, url: null },
  ];
  const night = (competitorId: string, observedOn: string, occupancyBp: number): MarketReading => ({
    competitorId,
    stayDate: '2026-10-10',
    observedOn,
    occupancyBp,
    source: 'MANUAL',
  });

  it('по дням снимка: значение переносится до нового снимка, отмечено, был ли снимок в этот день; темп рынка', () => {
    const h = buildNightHistory({
      stayDate: '2026-10-10',
      competitors: comps,
      readings: [
        night('a', '2026-10-01', 5000),
        night('b', '2026-10-03', 6000),
        night('a', '2026-10-05', 8000),
        night('b', '2026-10-05', 9000),
        // чужая ночь в выборку не попадает
        { ...night('a', '2026-10-05', 100), stayDate: '2026-10-11' },
      ],
    });
    expect(h.days.map((d) => d.observedOn)).toEqual(['2026-10-01', '2026-10-03', '2026-10-05']);
    expect(h.days[1]!.values).toEqual([
      { competitorId: 'a', bp: 5000, observed: false },
      { competitorId: 'b', bp: 6000, observed: true },
    ]);
    expect(h.days.map((d) => [d.marketBp, d.count])).toEqual([
      [5000, 1],
      [5500, 2],
      [8500, 2],
    ]);
    // темп: от первого дня, когда рынок известен, до последнего
    expect(h.pickupBp).toBe(3500);
  });

  it('нет снимков: пустая история, темп неизвестен; дней не больше предела, свежие остаются', () => {
    expect(buildNightHistory({ stayDate: '2026-10-10', competitors: comps, readings: [] })).toMatchObject({
      days: [],
      pickupBp: null,
    });
    const many = Array.from({ length: 40 }, (_, i) =>
      night('a', `2026-08-${String((i % 31) + 1).padStart(2, '0')}`, i * 10),
    ).concat(Array.from({ length: 9 }, (_, i) => night('a', `2026-09-0${i + 1}`, 1000)));
    const h = buildNightHistory({ stayDate: '2026-10-10', competitors: comps, readings: many, maxDays: 5 });
    expect(h.days).toHaveLength(5);
    expect(h.days.at(-1)!.observedOn).toBe('2026-09-09');
  });
});
