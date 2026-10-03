import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS, beautyMenuSections, menuSectionsFor, phoneNavigationFor } from './navigation';

const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const };
const hrefs = (vertical?: 'HOSPITALITY' | 'BEAUTY') =>
  menuSectionsFor(owner, vertical).flatMap((s) => s.items.map((i) => i.href));

/**
 * Меню по вертикали филиала (решение Q-254 от 03.10.2026, ADR-139, срез B2). У салона нет ни объекта, ни
 * броней, ни тарифов: гостиничные разделы ему не показываются, они не нашли бы объект.
 */
describe('меню салона', () => {
  it('у филиала салона нет гостиничных разделов', () => {
    const items = hrefs('BEAUTY');
    for (const href of ['/today', '/chessboard', '/reservations', '/inventory', '/rates', '/channels', '/hotel-settings', '/website', '/finance']) {
      expect(items, href).not.toContain(href);
    }
  });

  it('у филиала салона есть только то, что в нём работает', () => {
    // срез B3 добавил каталог: услуги и мастера
    expect(hrefs('BEAUTY')).toEqual([
      '/beauty',
      '/beauty/services',
      '/beauty/masters',
      '/team',
      '/journal',
    ]);
  });

  it('вертикаль не передана: меню гостиницы, как было до среза', () => {
    expect(hrefs()).toEqual(hrefs('HOSPITALITY'));
    expect(hrefs()).toContain('/chessboard');
    expect(hrefs()).not.toContain('/beauty');
  });

  it('нижняя панель телефона тоже идёт по вертикали', () => {
    expect(phoneNavigationFor('BEAUTY').map((i) => i.href)).toEqual([
      '/beauty',
      '/beauty/services',
      '/beauty/masters',
      '/team',
    ]);
    expect(phoneNavigationFor().map((i) => i.href)).toContain('/chessboard');
  });

  it('у каждого пункта салона есть право: закрытую страницу меню не обещает', () => {
    for (const section of beautyMenuSections) {
      for (const item of section.items) expect(item.requires, item.href).toBeTruthy();
    }
  });

  it('администратору смены платформа не видна, а своё рабочее место видно', () => {
    const staff = { ...CLOSED_ACCESS, role: 'STAFF' as const };
    const items = menuSectionsFor(staff, 'BEAUTY').flatMap((s) => s.items.map((i) => i.href));
    expect(items).toContain('/beauty');
    // каталог смена видит (чтение открыто `desk`), а править его не может: решает API по Q-253
    expect(items).toContain('/beauty/services');
    expect(items).not.toContain('/platform');
    expect(items).not.toContain('/journal');
  });
});
