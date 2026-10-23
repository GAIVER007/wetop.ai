import { describe, expect, it } from 'vitest';
import {
  ITEM_STATUSES,
  MENU_STATIONS,
  itemNext,
  orderStatusFromItems,
  parseItemStatusCommand,
  parseMenuCategoryInput,
  stationItems,
} from './restaurant';

/** Станции и статус строки заказа (DATA_MODEL §33.6, миграция 142) */
describe('строка заказа: станция и статус', () => {
  it('станции и статусы как в базе', () => {
    expect(MENU_STATIONS).toEqual(['KITCHEN', 'BAR']);
    expect(ITEM_STATUSES).toEqual(['NEW', 'COOKING', 'READY', 'SERVED']);
  });

  it('переходы строки: принять, готово (и сразу готово у бара), подано; назад нельзя', () => {
    expect(itemNext('NEW')).toEqual(['COOKING', 'READY']);
    expect(itemNext('COOKING')).toEqual(['READY']);
    expect(itemNext('READY')).toEqual(['SERVED']);
    expect(itemNext('SERVED')).toEqual([]);
  });

  it('статус заказа из строк: ничего не начато, в работе, всё готово, всё подано', () => {
    expect(orderStatusFromItems(['NEW', 'NEW'])).toBe('NEW');
    expect(orderStatusFromItems(['NEW', 'COOKING'])).toBe('COOKING');
    // бар отдал чай, кухня ещё не начала блюдо: заказ в работе, а не «Готово»
    expect(orderStatusFromItems(['READY', 'NEW'])).toBe('COOKING');
    expect(orderStatusFromItems(['READY', 'READY'])).toBe('READY');
    expect(orderStatusFromItems(['SERVED', 'READY'])).toBe('READY');
    expect(orderStatusFromItems(['SERVED', 'SERVED'])).toBe('SERVED');
    // поданный напиток и новое блюдо: заказ снова в работе
    expect(orderStatusFromItems(['SERVED', 'NEW'])).toBe('COOKING');
  });

  it('пустой состав не даёт статуса', () => {
    expect(() => orderStatusFromItems([])).toThrow();
  });

  it('команда строки: статус из списка и отметка заказа', () => {
    expect(
      parseItemStatusCommand({ status: 'READY', expectedUpdatedAt: '2026-10-22T10:00:00.000Z' }),
    ).toEqual({ status: 'READY', expectedUpdatedAt: '2026-10-22T10:00:00.000Z' });
    expect(() => parseItemStatusCommand({ status: 'CLOSED', expectedUpdatedAt: 'x' })).toThrow();
    expect(() => parseItemStatusCommand({ status: 'READY' })).toThrow();
    expect(() => parseItemStatusCommand({ status: 'READY', expectedUpdatedAt: 'x', extra: 1 })).toThrow();
  });

  it('станция категории меню: KITCHEN или BAR', () => {
    expect(parseMenuCategoryInput({ name: 'Чай', station: 'BAR' })).toEqual({ name: 'Чай', station: 'BAR' });
    expect(parseMenuCategoryInput({ station: 'KITCHEN' }, true)).toEqual({ station: 'KITCHEN' });
    expect(() => parseMenuCategoryInput({ name: 'Чай', station: 'HALL' })).toThrow('Станция');
  });

  it('станция видит только свои строки, поданные ей не нужны', () => {
    const items = [
      { id: 'a', station: 'BAR' as const, status: 'NEW' as const },
      { id: 'b', station: 'KITCHEN' as const, status: 'COOKING' as const },
      { id: 'c', station: 'BAR' as const, status: 'SERVED' as const },
    ];
    expect(stationItems(items, 'BAR').map((i) => i.id)).toEqual(['a']);
    expect(stationItems(items, 'KITCHEN').map((i) => i.id)).toEqual(['b']);
  });
});
