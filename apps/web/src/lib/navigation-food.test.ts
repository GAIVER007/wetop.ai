import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS, menuSectionsFor, phoneNavigationFor } from './navigation';
import { landingForVertical, routeVertical } from './vertical-landing';
import { deskShellOf } from './desk-person';
const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const };
describe('Food workspace isolation', () => {
  it('exposes exactly accepted Food menu', () => {
    expect(
      menuSectionsFor(owner, 'FOOD_SERVICE').flatMap((s) => s.items.map((i) => i.href)),
    ).toEqual([
      // группы по выбору владельца 11.10.2026: Зал, Заказы, Команда (подразделы видны в левой колонке)
      '/today',
      '/floor-plan',
      '/table-reservations',
      '/dining-areas',
      '/orders',
      '/kitchen',
      '/drinks',
      '/menu',
      '/stock',
      '/customers',
      '/restaurant-finance',
      '/cashbox',
      '/employees',
      '/payroll',
      '/staff',
      '/sales',
      '/marketing',
      '/management/analytics',
      '/restaurant-settings',
      '/journal',
      '/help',
      '/profile',
    ]);
    const sections = menuSectionsFor(owner, 'FOOD_SERVICE');
    expect(sections.map((s) => s.label)).toEqual([
      'Главная',
      'Зал',
      'Заказы',
      'Клиенты',
      'Финансы',
      'Команда',
      'Продажи',
      'Маркетинг',
      'Аналитика',
      'Настройки',
      'Журнал операций',
      'Помощь',
      'Профиль',
    ]);
    expect(sections.filter((s) => !s.direct).map((s) => s.items.length)).toEqual([3, 5, 2, 3]);
    expect(phoneNavigationFor('FOOD_SERVICE').map((i) => [i.href, i.label])).toEqual([
      ['/today', 'Главная'],
      ['/floor-plan', 'Зал'],
      ['/orders', 'Заказы'],
      ['/customers', 'Клиенты'],
    ]);
    const labels = sections.flatMap((s) => s.items);
    expect(labels.find((i) => i.href === '/orders')?.label).toBe('Заказы');
    expect(labels.find((i) => i.href === '/kitchen')?.label).toBe('Кухня');
    expect(labels.find((i) => i.href === '/menu')?.label).toBe('Меню');
    expect(labels.find((i) => i.href === '/stock')?.label).toBe('Склад');
    expect(labels.find((i) => i.href === '/employees')?.label).toBe('Сотрудники');
    expect(labels.find((i) => i.href === '/payroll')?.label).toBe('Зарплата');
    expect(labels.find((i) => i.href === '/cashbox')?.label).toBe('Касса');
    expect(labels.find((i) => i.href === '/table-reservations')?.label).toBe('Бронирования');
  });
  it('does not expose Food to existing verticals', () => {
    for (const v of ['BEAUTY', 'HOSPITALITY'] as const) {
      expect(menuSectionsFor(owner, v).flatMap((s) => s.items.map((i) => i.href))).not.toContain(
        '/floor-plan',
      );
      if (v === 'HOSPITALITY') {
        // «Главная» первой (ADR-180, 13.10.2026), затем «Календарь» (порядок #501)
        expect(menuSectionsFor(owner, v)[0]!.label).toBe('Главная');
        expect(menuSectionsFor(owner, v)[0]!.items[0]).toMatchObject({
          href: '/today',
          label: 'Главная',
        });
      }
    }
  });
  it('uses canonical landings and verified scope', () => {
    // MV8: рабочий экран дня салона и ресторана; гостиница стартует с единых «Финансов» (09.10.2026)
    expect(landingForVertical('FOOD_SERVICE')).toBe('/today');
    expect(landingForVertical('BEAUTY')).toBe('/today');
    expect(landingForVertical('HOSPITALITY')).toBe('/today');
    expect(
      deskShellOf({
        user: { email: 'synthetic@example.invalid', name: null },
        context: { vertical: 'FOOD_SERVICE' },
      }).vertical,
    ).toBe('FOOD_SERVICE');
  });
  it('identifies isolated routes before API access', () => {
    expect(routeVertical('/floor-plan')).toBe('FOOD_SERVICE');
    expect(routeVertical('/dining-areas')).toBe('FOOD_SERVICE');
    expect(routeVertical('/orders')).toBe('FOOD_SERVICE');
    expect(routeVertical('/kitchen')).toBe('FOOD_SERVICE');
    expect(routeVertical('/stock')).toBe('FOOD_SERVICE');
    expect(routeVertical('/menu')).toBe('FOOD_SERVICE');
    expect(routeVertical('/payroll')).toBe('FOOD_SERVICE');
    expect(routeVertical('/cashbox')).toBe('FOOD_SERVICE');
    // `/employees` общий у салона и ресторана (ADR-159): принадлежности нет, страницу делит requireVertical
    expect(routeVertical('/employees')).toBeNull();
    expect(routeVertical('/calendar')).toBe('BEAUTY');
    expect(routeVertical('/chessboard')).toBe('HOSPITALITY');
    expect(routeVertical('/customers')).toBeNull();
    expect(routeVertical('/today')).toBeNull();
  });
});
