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
      '/today',
      '/floor-plan',
      '/table-reservations',
      '/customers',
      '/dining-areas',
      '/team',
      '/management/analytics',
      '/journal',
      '/help',
      '/profile',
    ]);
    expect(phoneNavigationFor('FOOD_SERVICE').map((i) => i.href)).toEqual([
      '/today',
      '/floor-plan',
      '/table-reservations',
      '/customers',
    ]);
    const labels = menuSectionsFor(owner, 'FOOD_SERVICE').flatMap((s) => s.items);
    expect(labels.find((i) => i.href === '/today')?.label).toBe('Сегодня');
    expect(labels.find((i) => i.href === '/table-reservations')?.label).toBe('Бронирования');
  });
  it('does not expose Food to existing verticals', () => {
    for (const v of ['BEAUTY', 'HOSPITALITY'] as const) {
      expect(menuSectionsFor(owner, v).flatMap((s) => s.items.map((i) => i.href))).not.toContain(
        '/floor-plan',
      );
      if (v === 'HOSPITALITY') {
        // первая вкладка гостиницы — группа «Финансы» (ADR-157): первый пункт «Оплаты и касса»
        expect(menuSectionsFor(owner, v)[0]!.label).toBe('Финансы');
        expect(menuSectionsFor(owner, v)[0]!.items[0]).toMatchObject({
          href: '/finance',
          label: 'Оплаты и касса',
        });
      }
    }
  });
  it('uses canonical landings and verified scope', () => {
    // MV8: рабочий экран дня салона и ресторана; гостиница стартует с единых «Финансов» (09.10.2026)
    expect(landingForVertical('FOOD_SERVICE')).toBe('/today');
    expect(landingForVertical('BEAUTY')).toBe('/today');
    expect(landingForVertical('HOSPITALITY')).toBe('/finance');
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
    expect(routeVertical('/calendar')).toBe('BEAUTY');
    expect(routeVertical('/chessboard')).toBe('HOSPITALITY');
    expect(routeVertical('/customers')).toBeNull();
    expect(routeVertical('/today')).toBeNull();
  });
});
