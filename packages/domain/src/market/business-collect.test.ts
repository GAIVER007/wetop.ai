import { describe, expect, it } from 'vitest';
import { MarketInputError } from './occupancy';
import { dikidiCompanyId, dikidiDaySlots, parseCollectedDays, restoplaceAddress, restoplaceFreeTables } from './business-collect';

describe('сборщик соседей салона и ресторана (§60, срез 3)', () => {
  it('номер компании Dikidi из ссылки соседа, чужие и пустые ссылки: null', () => {
    expect(dikidiCompanyId('https://dikidi.net/ru/record/2091353?p=0.pi')).toBe('2091353');
    expect(dikidiCompanyId('https://dikidi.net/2091353')).toBe('2091353');
    expect(dikidiCompanyId('https://dikidi.net/ru/profile/korkemai_salon_2091353')).toBe('2091353');
    expect(dikidiCompanyId('https://dikidi.ru/ru/catalog?company=771')).toBe('771');
    expect(dikidiCompanyId('https://dikidi.net/ru/catalog/almaty')).toBeNull();
    expect(dikidiCompanyId('https://n1.yclients.com/company/2091353')).toBeNull();
    expect(dikidiCompanyId('https://evil.example/dikidi.net/ru/record/2091353')).toBeNull();
    expect(dikidiCompanyId('не ссылка')).toBeNull();
    expect(dikidiCompanyId(null)).toBeNull();
  });

  it('окна дня: одно время у двух мастеров одно окно, дня нет в dates_true: 0, непонятный ответ: null', () => {
    const data = {
      dates_true: ['2026-10-25', '2026-10-26'],
      times: {
        '1': ['2026-10-25 07:00:00', '2026-10-25 08:00:00', '2026-10-26 09:00:00'],
        '2': ['2026-10-25 08:00:00', '2026-10-25 15:00:00'],
      },
    };
    expect(dikidiDaySlots(data, '2026-10-25')).toBe(3);
    expect(dikidiDaySlots(data, '2026-10-27')).toBe(0);
    expect(dikidiDaySlots({ dates_true: ['2026-10-25'], times: [] }, '2026-10-25')).toBe(0);
    expect(dikidiDaySlots({ times: {} }, '2026-10-25')).toBeNull();
    expect(dikidiDaySlots({ dates_true: ['2026-10-25'], times: 'x' }, '2026-10-25')).toBeNull();
    expect(dikidiDaySlots({ dates_true: ['2026-10-25'], times: { a: 'x' } }, '2026-10-25')).toBeNull();
    expect(dikidiDaySlots(null, '2026-10-25')).toBeNull();
  });

  it('запись сборщика: уровень из окон тем же порогом, дни от сегодня на 14 дней, без повторов и дробей', () => {
    expect(parseCollectedDays([{ day: '2026-10-23', freeSlots: 0 }, { day: '2026-10-24', freeSlots: 3 }, { day: '2026-11-05', freeSlots: 9 }], '2026-10-23')).toEqual([
      { day: '2026-10-23', level: 'SOLD_OUT', freeSlots: 0 },
      { day: '2026-10-24', level: 'FEW_LEFT', freeSlots: 3 },
      { day: '2026-11-05', level: 'AVAILABLE', freeSlots: 9 },
    ]);
    for (const bad of [
      [],
      [{ day: '2026-10-22', freeSlots: 1 }],
      [{ day: '2026-11-06', freeSlots: 1 }],
      [{ day: '2026-10-24', freeSlots: 1 }, { day: '2026-10-24', freeSlots: 2 }],
      [{ day: '2026-10-24', freeSlots: 1.5 }],
      [{ day: '2026-10-24', freeSlots: -1 }],
      [{ day: '2026-10-24' }],
      [{ day: '24.10.2026', freeSlots: 1 }],
      Array.from({ length: 15 }, (_, i) => ({ day: `2026-10-${String(23 + (i % 8)).padStart(2, '0')}`, freeSlots: 1 })),
    ])
      expect(() => parseCollectedDays(bad, '2026-10-23')).toThrow(MarketInputError);
  });

  it('Restoplace: адрес из ссылки или страницы виджета, чужие хосты null', () => {
    const hash = 'e542ee65a7ec768858ad';
    expect(restoplaceAddress(`https://bar.restoplace.ws/?address=${hash}&nostep=1`)).toBe(hash);
    expect(restoplaceAddress('https://bar.restoplace.ws/', `<body class='x' data-hash='${hash}' data-page='index'>`)).toBe(hash);
    expect(restoplaceAddress('https://bar.restoplace.ws/')).toBeNull();
    expect(restoplaceAddress(`https://evil.example/?address=${hash}`)).toBeNull();
    expect(restoplaceAddress(null)).toBeNull();
  });

  it('Restoplace: свободные столы = онлайн-столы без брони этого дня; непонятный ответ null', () => {
    const items = [
      { id: '1', type: 'table', reserve: '1' },
      { id: '2', type: 'table', reserve: '1' },
      { id: '3', type: 'table', reserve: '1' },
      { id: '4', type: 'table', reserve: '0' },
      { id: '5', type: 'decor', reserve: '1' },
    ];
    const tables_reserve = {
      '1_table': { n: [{ time_from: '2026-10-24 19:00:00' }] },
      '2_table': { n: [{ time_from: '2026-10-25 19:00:00' }] },
      '4_table': { n: [{ time_from: '2026-10-24 19:00:00' }] },
    };
    expect(restoplaceFreeTables({ items, tables_reserve }, '2026-10-24')).toBe(2);
    expect(restoplaceFreeTables({ items, tables_reserve: [] }, '2026-10-24')).toBe(3);
    expect(restoplaceFreeTables({ items: [], tables_reserve }, '2026-10-24')).toBeNull();
    expect(restoplaceFreeTables({ tables_reserve }, '2026-10-24')).toBeNull();
    expect(restoplaceFreeTables({ items, tables_reserve: { '1_table': { n: 'x' } } }, '2026-10-24')).toBeNull();
  });
});
