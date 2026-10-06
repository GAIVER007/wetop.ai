/**
 * Какие ночи уходят в канал после изменения брони (Channex, сертификация §13 «Update Logic»: «only send changes»).
 *
 * 02.10.2026 live-тест Channex «перенос брони на неделю» отправил 15.12, 22.12 и все ночи между ними — остаток
 * 16–21.12 не менялся, но ушёл (задача 5577ce76). Правило для стойки: только ночи, где у брони поменялось число
 * занятых мест категории — было → стало. Для ревизий канала: все ночи брони до и после, без промежутка.
 */
import { describe, expect, it } from 'vitest';
import {
  cardStays,
  changedNightRanges,
  envelopeOf,
  nightsOf,
  stayDelta,
  stayNightRanges,
  type StaySpan,
} from './ari-ranges';

const stay = (
  categoryCode: string,
  arrivalDate: string,
  departureDate: string,
  status = 'CONFIRMED',
): StaySpan => ({ categoryCode, arrivalDate, departureDate, status });

describe('changedNightRanges', () => {
  it('карточка завершённой брони передаёт очищенные назначения в расчёт изменений', () => {
    const item = {
      accommodationTypeCode: 'single',
      arrivalDate: '2026-10-04',
      departureDate: '2026-10-08',
      status: 'CHECKED_OUT',
      unitCode: null,
    };
    expect(
      changedNightRanges(
        [stay('single', '2026-10-04', '2026-10-08')],
        cardStays({ items: [item] }),
      ),
    ).toEqual([{ categoryCode: 'single', from: '2026-10-04', toExclusive: '2026-10-08' }]);
  });
  it('выезд в день заезда освобождает весь остаток срока без изменения плановых дат', () => {
    const before = stay('single', '2026-10-04', '2026-10-08', 'CHECKED_IN');
    const after = { ...before, status: 'CHECKED_OUT', allocationEndDates: [] };
    expect(changedNightRanges([before], [after])).toEqual([
      { categoryCode: 'single', from: '2026-10-04', toExclusive: '2026-10-08' },
    ]);
  });

  it('новая бронь — ровно её ночи', () => {
    expect(changedNightRanges([], [stay('single', '2026-12-15', '2026-12-17')])).toEqual([
      { categoryCode: 'single', from: '2026-12-15', toExclusive: '2026-12-17' },
    ]);
  });

  it('перенос на неделю — старая и новая ночь, промежуток между ними не уходит', () => {
    expect(
      changedNightRanges(
        [stay('single', '2026-12-15', '2026-12-16')],
        [stay('single', '2026-12-22', '2026-12-23')],
      ),
    ).toEqual([
      { categoryCode: 'single', from: '2026-12-15', toExclusive: '2026-12-16' },
      { categoryCode: 'single', from: '2026-12-22', toExclusive: '2026-12-23' },
    ]);
  });

  it('сдвиг на день — освободившаяся и занятая ночь; общая ночь остаток не меняет и не уходит', () => {
    expect(
      changedNightRanges(
        [stay('single', '2026-11-10', '2026-11-12')],
        [stay('single', '2026-11-11', '2026-11-13')],
      ),
    ).toEqual([
      { categoryCode: 'single', from: '2026-11-10', toExclusive: '2026-11-11' },
      { categoryCode: 'single', from: '2026-11-12', toExclusive: '2026-11-13' },
    ]);
  });

  it('продление на ночь — только добавленная ночь', () => {
    expect(
      changedNightRanges(
        [stay('single', '2026-09-15', '2026-09-18')],
        [stay('single', '2026-09-15', '2026-09-19')],
      ),
    ).toEqual([{ categoryCode: 'single', from: '2026-09-18', toExclusive: '2026-09-19' }]);
  });

  it('ранний выезд — освободившиеся ночи; выехавший держит только прожитые', () => {
    expect(
      changedNightRanges(
        [stay('single', '2026-09-15', '2026-09-18', 'CHECKED_IN')],
        [stay('single', '2026-09-15', '2026-09-16', 'CHECKED_OUT')],
      ),
    ).toEqual([{ categoryCode: 'single', from: '2026-09-16', toExclusive: '2026-09-18' }]);
  });

  it('отмена и незаезд — все ночи проживания: место вернулось в продажу', () => {
    const before = [stay('single', '2026-09-15', '2026-09-17')];
    for (const status of ['CANCELLED', 'NO_SHOW'])
      expect(
        changedNightRanges(before, [stay('single', '2026-09-15', '2026-09-17', status)]),
      ).toEqual([{ categoryCode: 'single', from: '2026-09-15', toExclusive: '2026-09-17' }]);
  });

  it('смена статуса без смены ночей и уже отменённое проживание остаток не меняют — дельты нет', () => {
    expect(
      changedNightRanges(
        [stay('single', '2026-09-15', '2026-09-17', 'CONFIRMED')],
        [stay('single', '2026-09-15', '2026-09-17', 'CHECKED_IN')],
      ),
    ).toEqual([]);
    expect(
      changedNightRanges(
        [stay('single', '2026-09-15', '2026-09-17', 'CANCELLED')],
        [stay('single', '2026-09-15', '2026-09-17', 'CANCELLED')],
      ),
    ).toEqual([]);
  });

  it('переселение в другую категорию — обе категории, по порядку кодов', () => {
    expect(
      changedNightRanges(
        [stay('single', '2026-09-15', '2026-09-17')],
        [stay('twin', '2026-09-15', '2026-09-17')],
      ),
    ).toEqual([
      { categoryCode: 'single', from: '2026-09-15', toExclusive: '2026-09-17' },
      { categoryCode: 'twin', from: '2026-09-15', toExclusive: '2026-09-17' },
    ]);
  });

  it('два места одной категории: уходит только ночь, где число мест поменялось', () => {
    expect(
      changedNightRanges(
        [stay('dorm', '2026-09-15', '2026-09-17'), stay('dorm', '2026-09-15', '2026-09-17')],
        [stay('dorm', '2026-09-15', '2026-09-17'), stay('dorm', '2026-09-15', '2026-09-18')],
      ),
    ).toEqual([{ categoryCode: 'dorm', from: '2026-09-17', toExclusive: '2026-09-18' }]);
  });

  it('соседние изменённые ночи склеиваются в один отрезок', () => {
    expect(
      changedNightRanges(
        [stay('single', '2026-09-15', '2026-09-16')],
        [stay('single', '2026-09-16', '2026-09-17')],
      ),
    ).toEqual([{ categoryCode: 'single', from: '2026-09-15', toExclusive: '2026-09-17' }]);
  });
});

describe('stayNightRanges (ревизии канала)', () => {
  it('все ночи брони в любом статусе: прежние, отменённые и новые; промежуток между ними не уходит', () => {
    expect(
      stayNightRanges([
        // стойка уже отменила — разница PMS пуста, а Channex по отмене вернёт место сам
        stay('single', '2026-12-15', '2026-12-16', 'CANCELLED'),
        stay('single', '2026-12-22', '2026-12-23'),
        // комната ревизии в другой категории
        stay('twin', '2026-12-22', '2026-12-23'),
      ]),
    ).toEqual([
      { categoryCode: 'single', from: '2026-12-15', toExclusive: '2026-12-16' },
      { categoryCode: 'single', from: '2026-12-22', toExclusive: '2026-12-23' },
      { categoryCode: 'twin', from: '2026-12-22', toExclusive: '2026-12-23' },
    ]);
  });

  it('пересекающиеся и соседние проживания — один отрезок; пустое проживание ночей не даёт', () => {
    expect(
      stayNightRanges([
        stay('single', '2026-11-10', '2026-11-12'),
        stay('single', '2026-11-11', '2026-11-13'),
        stay('single', '2026-11-13', '2026-11-14'),
        stay('twin', '2026-11-20', '2026-11-20'),
      ]),
    ).toEqual([{ categoryCode: 'single', from: '2026-11-10', toExclusive: '2026-11-14' }]);
  });
});

describe('envelopeOf', () => {
  it('категории и охват отрезков — для журнала и для старых получателей дельты', () => {
    expect(
      envelopeOf([
        { categoryCode: 'twin', from: '2026-12-22', toExclusive: '2026-12-23' },
        { categoryCode: 'single', from: '2026-12-15', toExclusive: '2026-12-16' },
        { categoryCode: 'single', from: '2026-12-22', toExclusive: '2026-12-23' },
      ]),
    ).toEqual({ categoryCodes: ['single', 'twin'], from: '2026-12-15', toExclusive: '2026-12-23' });
    expect(envelopeOf([])).toBeNull();
  });
});

describe('stayDelta по карточкам брони', () => {
  const card = (arrivalDate: string, departureDate: string, status = 'CONFIRMED') => ({
    items: [{ accommodationTypeCode: 'single', arrivalDate, departureDate, status }],
  });

  it('перенос — охват и отрезки одним изменением; новая бронь — с пустого «было»', () => {
    expect(
      stayDelta(
        cardStays(card('2026-12-15', '2026-12-16')),
        cardStays(card('2026-12-22', '2026-12-23')),
      ),
    ).toEqual({
      categoryCodes: ['single'],
      from: '2026-12-15',
      toExclusive: '2026-12-23',
      ranges: [
        { categoryCode: 'single', from: '2026-12-15', toExclusive: '2026-12-16' },
        { categoryCode: 'single', from: '2026-12-22', toExclusive: '2026-12-23' },
      ],
    });
    expect(stayDelta(cardStays(null), cardStays(card('2026-12-15', '2026-12-16')))).toMatchObject({
      ranges: [{ categoryCode: 'single', from: '2026-12-15', toExclusive: '2026-12-16' }],
    });
  });

  it('остаток не менялся (заезд) — null: в очередь ничего не встаёт', () => {
    expect(
      stayDelta(
        cardStays(card('2026-12-15', '2026-12-17')),
        cardStays(card('2026-12-15', '2026-12-17', 'CHECKED_IN')),
      ),
    ).toBeNull();
  });
});

describe('nightsOf', () => {
  it('ночи отрезка по порядку; пустой, обратный и неверный отрезок — без ночей', () => {
    expect(nightsOf('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
    ]);
    expect(nightsOf('2026-12-15', '2026-12-15')).toEqual([]);
    expect(nightsOf('2026-12-16', '2026-12-15')).toEqual([]);
    expect(nightsOf('2026-12-15', 'не дата')).toEqual([]);
  });
});
