import { describe, expect, it } from 'vitest';
import { MarketInputError, parseCompetitorInput } from './occupancy';
import { buildPriceBoard, parsePriceInput, type PriceReading } from './rates';

describe('карточка конкурента: район, категория, настройки мониторинга', () => {
  it('новые поля разбираются, пустое необязательное при правке снимается', () => {
    const input = parseCompetitorInput(
      {
        name: ' Almaty Residence ',
        district: 'Медеу',
        category: 'Отель 4★',
        address: 'ул. Абая, 45',
        dataSource: 'Booking.com',
        monitoring: 'PRICE',
        refreshHours: '2',
        autoRefresh: true,
      },
      'create',
    );
    expect(input).toMatchObject({
      name: 'Almaty Residence',
      district: 'Медеу',
      category: 'Отель 4★',
      address: 'ул. Абая, 45',
      dataSource: 'Booking.com',
      monitoring: 'PRICE',
      refreshHours: 2,
      autoRefresh: true,
    });
    expect(parseCompetitorInput({ district: '  ', category: '' }, 'update')).toEqual({ district: null, category: null });
  });

  it('режим мониторинга и частота проверяются', () => {
    expect(() => parseCompetitorInput({ name: 'А', monitoring: 'ALL' }, 'create')).toThrow(MarketInputError);
    expect(() => parseCompetitorInput({ name: 'А', refreshHours: '0' }, 'create')).toThrow(MarketInputError);
    expect(() => parseCompetitorInput({ name: 'А', refreshHours: '169' }, 'create')).toThrow(MarketInputError);
    expect(() => parseCompetitorInput({ name: 'А', district: 'x'.repeat(81) }, 'create')).toThrow(MarketInputError);
    expect(() => parseCompetitorInput({ name: 'А', category: 'x'.repeat(61) }, 'create')).toThrow(MarketInputError);
    expect(parseCompetitorInput({ name: 'А' }, 'create').monitoring).toBeUndefined();
  });
});

describe('цена конкурента из ввода', () => {
  it('«42 000», «42000,50», «42000.5» это минорные единицы целым', () => {
    expect(parsePriceInput('42 000')).toBe(4_200_000n);
    expect(parsePriceInput('42000,50')).toBe(4_200_050n);
    expect(parsePriceInput('42000.5')).toBe(4_200_050n);
    expect(parsePriceInput(' 15000 ')).toBe(1_500_000n);
  });
  it('пусто это «цены нет»; ноль, минус, буквы и огромное отклоняются', () => {
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput(null)).toBeNull();
    for (const bad of ['0', '-5', 'много', '12,345', '1e9', '99999999999'])
      expect(() => parsePriceInput(bad)).toThrow(MarketInputError);
  });
});

const rate = (competitorId: string, stayDate: string, observedOn: string, major: number): PriceReading => ({
  competitorId,
  stayDate,
  observedOn,
  priceMinor: BigInt(major) * 100n,
  currency: 'KZT',
  source: 'MANUAL',
});

describe('ценовая доска: цены по ночам, среднее по рынку, изменение', () => {
  const dates = ['2026-10-09', '2026-10-10', '2026-10-11'];
  const readings: PriceReading[] = [
    rate('a', '2026-10-09', '2026-10-08', 40_000), // вчера
    rate('a', '2026-10-09', '2026-10-09', 42_000), // сегодня заменяет вчерашнее
    rate('a', '2026-10-10', '2026-10-09', 44_000),
    rate('b', '2026-10-09', '2026-10-09', 28_000),
  ];

  it('берёт последний снимок не позже даты и считает рынок по ночам', () => {
    const board = buildPriceBoard({ dates, asOf: '2026-10-09', compareDays: 1, competitors: [{ id: 'a' }, { id: 'b' }], readings });
    expect(board.currency).toBe('KZT');
    const a = board.competitors.find((c) => c.id === 'a')!;
    expect(a.cells.map((c) => c.priceMinor)).toEqual([4_200_000n, 4_400_000n, null]);
    expect(a.avgMinor).toBe(4_300_000n);
    expect(board.market[0]).toEqual({ date: '2026-10-09', avgMinor: 3_500_000n, minMinor: 2_800_000n, maxMinor: 4_200_000n, count: 2 });
    expect(board.market[1]).toMatchObject({ avgMinor: 4_400_000n, count: 1 });
    expect(board.market[2]).toEqual({ date: '2026-10-11', avgMinor: null, minMinor: null, maxMinor: null, count: 0 });
    expect(board.summary).toMatchObject({ marketAvgMinor: 3_950_000n, minMinor: 2_800_000n, maxMinor: 4_400_000n, competitorsWithData: 2 });
  });

  it('изменение к вчера: по ночам, где цена есть и вчера, и сегодня', () => {
    const board = buildPriceBoard({ dates, asOf: '2026-10-09', compareDays: 1, competitors: [{ id: 'a' }, { id: 'b' }], readings });
    // у «a» вчера на ночь 09.10 было 40 000, сегодня 42 000: +5 % (50 из тысячи)
    expect(board.competitors.find((c) => c.id === 'a')!.changePermille).toBe(50);
    // у «b» вчерашнего снимка нет: сравнения нет, это не ноль
    expect(board.competitors.find((c) => c.id === 'b')!.changePermille).toBeNull();
  });

  it('без сравнения изменения нет; без данных всё null, а не нули', () => {
    const plain = buildPriceBoard({ dates, asOf: '2026-10-09', compareDays: 0, competitors: [{ id: 'a' }], readings });
    expect(plain.competitors[0]!.changePermille).toBeNull();
    const empty = buildPriceBoard({ dates, asOf: '2026-10-09', compareDays: 1, competitors: [{ id: 'a' }], readings: [] });
    expect(empty.currency).toBeNull();
    expect(empty.summary).toEqual({ marketAvgMinor: null, minMinor: null, maxMinor: null, competitorsWithData: 0 });
    expect(empty.competitors[0]!.avgMinor).toBeNull();
  });

  it('снимок позже даты «на» в расчёт не входит', () => {
    const board = buildPriceBoard({
      dates,
      asOf: '2026-10-08',
      compareDays: 0,
      competitors: [{ id: 'a' }],
      readings: [rate('a', '2026-10-09', '2026-10-09', 99_000)],
    });
    expect(board.competitors[0]!.cells[0]!.priceMinor).toBeNull();
  });
});
