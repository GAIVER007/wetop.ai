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
      // состав и порядок — макет «WETOP для ресторанов» (ADR-159)
      '/today',
      '/orders',
      '/floor-plan',
      '/kitchen',
      '/table-reservations',
      '/customers',
      '/menu',
      '/employees',
      '/payroll',
      '/dining-areas',
      '/staff',
      '/management/analytics',
      '/journal',
      '/help',
      '/profile',
    ]);
    expect(phoneNavigationFor('FOOD_SERVICE').map((i) => i.href)).toEqual([
      '/today',
      '/orders',
      '/floor-plan',
      '/kitchen',
    ]);
    const labels = menuSectionsFor(owner, 'FOOD_SERVICE').flatMap((s) => s.items);
    expect(labels.find((i) => i.href === '/today')?.label).toBe('Главная');
    expect(labels.find((i) => i.href === '/orders')?.label).toBe('Заказы');
    expect(labels.find((i) => i.href === '/kitchen')?.label).toBe('Кухня');
    expect(labels.find((i) => i.href === '/menu')?.label).toBe('Меню');
    expect(labels.find((i) => i.href === '/employees')?.label).toBe('Сотрудники');
    expect(labels.find((i) => i.href === '/payroll')?.label).toBe('Зарплата');
    expect(labels.find((i) => i.href === '/table-reservations')?.label).toBe('Бронирования');
  });
  it('does not expose Food to existing verticals', () => {
    for (const v of ['BEAUTY', 'HOSPITALITY'] as const) {
      expect(menuSectionsFor(owner, v).flatMap((s) => s.items.map((i) => i.href))).not.toContain(
        '/floor-plan',
      );
      if (v === 'HOSPITALITY')
        expect(menuSectionsFor(owner, v)[0]!.items[0]).toMatchObject({ href: '/today', label: 'Главная' });
    }
  });
  it('uses canonical landings and verified scope', () => {
    // MV8: один рабочий экран дня на все направления
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
    expect(routeVertical('/menu')).toBe('FOOD_SERVICE');
    expect(routeVertical('/payroll')).toBe('FOOD_SERVICE');
    // `/employees` общий у салона и ресторана (ADR-159): принадлежности нет, страницу делит requireVertical
    expect(routeVertical('/employees')).toBeNull();
    expect(routeVertical('/calendar')).toBe('BEAUTY');
    expect(routeVertical('/chessboard')).toBe('HOSPITALITY');
    expect(routeVertical('/customers')).toBeNull();
    expect(routeVertical('/today')).toBeNull();
  });
});
