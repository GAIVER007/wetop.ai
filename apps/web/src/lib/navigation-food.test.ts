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
      '/floor-plan',
      '/table-reservations',
      '/customers',
      '/dining-areas',
      '/staff',
      '/journal',
      '/help',
      '/profile',
    ]);
    expect(phoneNavigationFor('FOOD_SERVICE').map((i) => i.href)).toEqual([
      '/floor-plan',
      '/table-reservations',
      '/customers',
      '/dining-areas',
    ]);
  });
  it('does not expose Food to existing verticals', () => {
    for (const v of ['BEAUTY', 'HOSPITALITY'] as const) {
      expect(menuSectionsFor(owner, v).flatMap((s) => s.items.map((i) => i.href))).not.toContain(
        '/floor-plan',
      );
    }
  });
  it('uses canonical landings and verified scope', () => {
    expect(landingForVertical('FOOD_SERVICE')).toBe('/floor-plan');
    expect(landingForVertical('BEAUTY')).toBe('/calendar');
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
    expect(routeVertical('/calendar')).toBe('BEAUTY');
    expect(routeVertical('/chessboard')).toBe('HOSPITALITY');
    expect(routeVertical('/customers')).toBeNull();
  });
});
