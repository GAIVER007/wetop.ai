import { describe, expect, it } from 'vitest';
import { freeWindowMasters, ownerAttention, ruCount } from './attention';

describe('ruCount', () => {
  it('склоняет по числу', () => {
    expect(ruCount(1, ['запись', 'записи', 'записей'])).toBe('1 запись');
    expect(ruCount(3, ['запись', 'записи', 'записей'])).toBe('3 записи');
    expect(ruCount(11, ['запись', 'записи', 'записей'])).toBe('11 записей');
    expect(ruCount(22, ['запись', 'записи', 'записей'])).toBe('22 записи');
  });
});

describe('freeWindowMasters', () => {
  const shift = (from: number, to: number) => ({ from, to });
  it('мастер без записей с оставшимся временем считается, без смены нет', () => {
    expect(
      freeWindowMasters(
        [
          { employeeId: 'a', shifts: [shift(600, 1200)] },
          { employeeId: 'b', shifts: [] },
        ],
        [],
        600,
      ),
    ).toBe(1);
  });
  it('окно меньше 2 часов не считается, время до «сейчас» не считается', () => {
    const masters = [{ employeeId: 'a', shifts: [shift(600, 1200)] }];
    // занято 11:00-19:00, свободно 10:00-11:00 (уже прошло) и 19:00-20:00 (1 ч)
    expect(freeWindowMasters(masters, [{ employeeId: 'a', from: 660, to: 1140 }], 700)).toBe(0);
    // занято 13:00-14:00, сейчас 10:00: свободно 10-13 (3 ч)
    expect(freeWindowMasters(masters, [{ employeeId: 'a', from: 780, to: 840 }], 600)).toBe(1);
    // смена кончилась
    expect(freeWindowMasters(masters, [], 1200)).toBe(0);
  });
  it('записи другого мастера не занимают окно', () => {
    expect(
      freeWindowMasters([{ employeeId: 'a', shifts: [shift(600, 840)] }], [{ employeeId: 'b', from: 600, to: 840 }], 600),
    ).toBe(1);
  });
});

describe('ownerAttention', () => {
  it('салон: сначала предупреждения, тексты простые, ссылки на рабочие экраны', () => {
    const items = ownerAttention({ vertical: 'BEAUTY', unpaidDone: 2, freeMasters: 3, lowStock: 1 });
    expect(items).toEqual([
      { id: 'unpaid-visits', tone: 'warn', count: 2, text: 'Не оплачено сегодня: 2 записи', href: '/calendar', action: 'Журнал' },
      { id: 'low-stock', tone: 'warn', count: 1, text: 'Заканчивается: 1 позиция', href: '/warehouse', action: 'Склад' },
      // свободные окна это подсказка (29.10.2026): после дел
      { id: 'free-windows', tone: 'ok', count: 3, text: 'Свободные окна: 3 мастера', href: '/calendar', action: 'Журнал' },
    ]);
  });
  it('нулевые и неизвестные сигналы не показываются; когда дел нет, одна спокойная строка', () => {
    expect(ownerAttention({ vertical: 'BEAUTY', unpaidDone: 0, freeMasters: null, lowStock: 0 })).toEqual([
      { id: 'all-clear', tone: 'ok', text: 'Срочных дел нет', href: '/today/operations', action: 'Открыть день' },
    ]);
  });
  it('ни один сигнал не прочитан: «Срочных дел нет» не обещаем', () => {
    expect(ownerAttention({ vertical: 'BEAUTY', unpaidDone: null, freeMasters: null, lowStock: null })).toEqual([]);
  });
  it('ресторан: открытые счета дольше 2 ч и склад', () => {
    expect(ownerAttention({ vertical: 'FOOD_SERVICE', staleOrders: 5, lowStock: 2 }).map((i) => [i.text, i.href])).toEqual([
      ['Открыты дольше 2 ч: 5 счетов', '/floor-plan'],
      ['Заканчивается: 2 позиции', '/warehouse'],
    ]);
    expect(ownerAttention({ vertical: 'FOOD_SERVICE', staleOrders: 1 })[0]!.text).toBe('Открыты дольше 2 ч: 1 счёт');
  });
  it('гостиница: заезды и уборка одной строкой, брони без предоплаты со ссылкой на отбор', () => {
    const items = ownerAttention({
      vertical: 'HOSPITALITY', today: '2026-10-21', arrivals: 4, dirtyRooms: 2, noPrepay: 3,
    });
    expect(items).toEqual([
      { id: 'arrivals', tone: 'warn', count: 4, text: '4 заезда, не убрано: 2 номера', href: '/inventory?housekeeping=DIRTY', action: 'Номера' },
      {
        id: 'no-prepayment', tone: 'warn', count: 3, text: '3 брони без предоплаты',
        href: '/reservations?from=2026-10-21&to=2026-10-28&date=arrival&payment=unpaid', action: 'Брони',
      },
    ]);
  });
  it('гостиница: заезды при убранных номерах это спокойная строка и стоит после предупреждений', () => {
    const items = ownerAttention({ vertical: 'HOSPITALITY', today: '2026-10-21', arrivals: 1, dirtyRooms: 0, noPrepay: 1 });
    expect(items.map((i) => [i.id, i.tone, i.text])).toEqual([
      ['no-prepayment', 'warn', '1 бронь без предоплаты'],
      ['arrivals', 'ok', '1 заезд сегодня, номера убраны'],
    ]);
    expect(items[1]!.href).toBe('/reservations?arrival=today');
  });
  it('гостиница: уборка без заездов', () => {
    expect(ownerAttention({ vertical: 'HOSPITALITY', today: '2026-10-21', arrivals: 0, dirtyRooms: 5 })[0]!.text).toBe('Не убрано: 5 номеров');
  });
  it('гостиница с койко-местами говорит «мест»', () => {
    expect(ownerAttention({ vertical: 'HOSPITALITY', today: '2026-10-21', arrivals: 0, dirtyRooms: 2, dirtyHasBeds: true })[0]!.text).toBe('Не убрано: 2 места');
  });
  it('не больше 4 строк и без длинного тире', () => {
    const items = ownerAttention({ vertical: 'HOSPITALITY', today: '2026-10-21', arrivals: 1, dirtyRooms: 1, noPrepay: 1, lowStock: 1, extra: [{ id: 'x', tone: 'warn', text: 'x', href: '/x', action: 'x' }, { id: 'y', tone: 'warn', text: 'y', href: '/y', action: 'y' }] });
    expect(items).toHaveLength(4);
    expect(JSON.stringify(items)).not.toContain('\u2014');
  });
  // владелец 29.10.2026: «что там должно точно четко важно полезно появляться в требует решения»
  it('салон: незакрытая смена первой, потом не отмеченные визиты, неоплата, неподтверждённые на завтра, склад; окна последними', () => {
    const items = ownerAttention({ vertical: 'BEAUTY', today: '2026-10-28', openShiftSince: '2026-10-27', lateUnmarked: 2, unpaidDone: 1, unconfirmedTomorrow: 3, lowStock: 1, freeMasters: 4 });
    expect(items.map((i) => [i.id, i.text, i.href])).toEqual([
      ['open-shift', 'Смена с 27.10 не закрыта', '/finance'],
      ['late-unmarked', 'Не отмечены «Пришла»: 2 записи', '/calendar'],
      ['unpaid-visits', 'Не оплачено сегодня: 1 запись', '/calendar'],
      ['unconfirmed-tomorrow', 'Подтвердить на завтра: 3 записи', '/calendar?date=2026-10-29'],
    ]);
  });
  it('свободные окна не вытесняют дела: это подсказка, она идёт после предупреждений', () => {
    const items = ownerAttention({ vertical: 'BEAUTY', today: '2026-10-28', freeMasters: 4, unconfirmedTomorrow: 1 });
    expect(items.map((i) => [i.id, i.tone])).toEqual([['unconfirmed-tomorrow', 'warn'], ['free-windows', 'ok']]);
  });
  it('ресторан и гостиница тоже видят незакрытую смену первой, со ссылкой на свои финансы', () => {
    expect(ownerAttention({ vertical: 'FOOD_SERVICE', openShiftSince: '2026-10-27', staleOrders: 1 }).map((i) => [i.id, i.href])).toEqual([['open-shift', '/restaurant-finance'], ['stale-orders', '/floor-plan']]);
    expect(ownerAttention({ vertical: 'HOSPITALITY', today: '2026-10-28', openShiftSince: '2026-10-26', arrivals: 0 })[0]).toMatchObject({ id: 'open-shift', text: 'Смена с 26.10 не закрыта', href: '/finance' });
  });
});
