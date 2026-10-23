import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS, menuSectionsFor, phoneNavigationFor } from './navigation';
import { landingForVertical, routeVertical } from './vertical-landing';
import { deskShellOf } from './desk-person';
const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const };
describe('Food workspace isolation', () => {
  it('exposes exactly accepted Food menu', () => {
    // верхнее меню по решению владельца 17.10.2026: та же строка разделов, что у салона и гостиницы,
    // со словами ресторана («Зал», «Гости», «Заказы»); «Моя работа» в меню под именем
    const sections = menuSectionsFor(owner, 'FOOD_SERVICE');
    expect(sections.map((s) => [s.label, s.items.map((i) => i.href)])).toEqual([
      ['Главная', ['/today']],
      // журнал ресторана это живой план зала; брони столов это «Записи» клиентов
      ['Журнал', ['/floor-plan']],
      ['Персонал', ['/employees', '/team', '/employees/shifts', '/payroll']],
      ['Клиенты', ['/customers', '/table-reservations']],
      ['Услуги', ['/menu', '/orders', '/waiter', '/kitchen', '/drinks', '/dining-areas']],
      // `/reports` ресторану перенаправляет на «Аналитику бизнеса» (аудит 17.10.2026, Д2)
      ['Статистика', ['/management/analytics']],
      ['Склад', ['/warehouse', '/bar', '/stock', '/bar/receipts', '/bar/products', '/bar/suppliers', '/bar/operations']],
      // `/finance` ресторану не свой экран: «Финансы» ресторана (аудит 17.10.2026, Д2)
      ['Финансы', ['/restaurant-finance', '/cashbox']],
      ['Настройки', ['/restaurant-settings', '/journal', '/settings']],
      ['Продвижение', ['/marketing', '/marketing/ads', '/marketing/content', '/marketing/voice', '/ai-agents', '/sales', '/marketing/budget', '/marketing/analytics']],
      ['Помощь', ['/help']],
    ]);
    expect(phoneNavigationFor('FOOD_SERVICE').map((i) => [i.href, i.label])).toEqual([
      ['/today', 'Главная'],
      ['/floor-plan', 'Журнал'],
      ['/customers', 'Клиенты'],
      ['/menu', 'Услуги'],
    ]);
    const labels = sections.flatMap((s) => s.items);
    expect(labels.find((i) => i.href === '/menu')?.label).toBe('Меню');
    expect(labels.find((i) => i.href === '/stock')?.label).toBe('Склад кухни');
    expect(labels.find((i) => i.href === '/employees')?.label).toBe('Сотрудники');
    expect(labels.find((i) => i.href === '/employees/shifts')?.label).toBe('График работы');
    expect(labels.find((i) => i.href === '/cashbox')?.label).toBe('Касса');
    expect(labels.find((i) => i.href === '/table-reservations')?.label).toBe('Брони столов');
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
    expect(routeVertical('/waiter')).toBe('FOOD_SERVICE');
    expect(routeVertical('/stock')).toBe('FOOD_SERVICE');
    expect(routeVertical('/menu')).toBe('FOOD_SERVICE');
    // зарплата общая у ресторана и салона (§19.2)
    expect(routeVertical('/payroll')).toBeNull();
    // касса филиала общая у ресторана и салона (§48)
    expect(routeVertical('/cashbox')).toBeNull();
    // `/employees` общий у салона и ресторана (ADR-159): принадлежности нет, страницу делит requireVertical
    expect(routeVertical('/employees')).toBeNull();
    expect(routeVertical('/calendar')).toBe('BEAUTY');
    expect(routeVertical('/chessboard')).toBe('HOSPITALITY');
    expect(routeVertical('/customers')).toBeNull();
    // бар у всех направлений (ADR-178): страница сама зовёт requireVertical
    expect(routeVertical('/bar')).toBeNull();
    expect(routeVertical('/today')).toBeNull();
  });
});
