import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import {
  CLOSED_ACCESS,
  activeItem,
  activeNavigation,
  menuSectionsFor,
  navigationItems,
  routeRule,
} from './navigation';
import { decideScope } from './scope-resolve';

describe('сайт в меню — одно место (ADR-117)', () => {
  const sections = menuSectionsFor(CLOSED_ACCESS);
  const hrefs = sections.flatMap((section) => section.items.map((item) => item.href));

  // MKT2 (ADR-149): вход в сайт переехал из «Продаж» в группу «Маркетинг», адреса /website/* прежние
  it('«Маркетинг»: своя группа, первый пункт «Сайт и SEO» ведёт в хаб /marketing', () => {
    const marketing = sections.find((section) => section.id === 'marketing');
    expect(marketing?.label).toBe('Маркетинг');
    expect(marketing?.direct).toBeUndefined();
    expect(marketing?.items.map((item) => [item.href, item.label])).toEqual([
      ['/marketing', 'Сайт и SEO'],
    ]);
  });

  it('в «Продажах» сайта больше нет', () => {
    const sales = sections.find((section) => section.id === 'sales');
    expect(sales?.items.map((item) => item.href)).not.toContain('/website');
    expect(sales?.items.map((item) => item.label)).not.toContain('Сайт и онлайн-бронирование');
  });

  it('хаб и сайт открыты тем же правом, что и раньше сайт (settings), своего права нет', () => {
    expect(routeRule('/marketing')?.requires).toBe('settings');
    for (const path of ['/website', '/website/booking', '/website/analytics', '/website/settings'])
      expect(routeRule(path)?.requires).toBe('settings');
  });

  it('отдельных «Аналитики сайта» и «Настроек сайта» больше нет', () => {
    expect(hrefs.filter((href) => href.startsWith('/analytics'))).toEqual([]);
    expect(navigationItems.filter((item) => item.href.startsWith('/analytics'))).toEqual([]);
    expect(hrefs.filter((href) => href === '/marketing')).toHaveLength(1);
    // страница сайта осталась в реестре (права, заголовок), но пункта меню у неё нет: вход один, через хаб
    expect(hrefs).not.toContain('/website');
    expect(navigationItems.filter((item) => item.href === '/website')).toHaveLength(1);
  });

  it('«Интеграции» не обещают счётчик и модуль бронирования', () => {
    const connections = navigationItems.find((item) => item.href === '/connections');
    expect(connections?.description).not.toMatch(/счётчик|бронировани/i);
  });

  it('вкладки модуля подсвечивают один пункт меню: «Сайт и SEO» группы «Маркетинг»', () => {
    for (const path of ['/website', '/website/booking', '/website/analytics', '/website/settings']) {
      expect(activeNavigation(path)?.href).toBe('/website');
      expect(activeItem(path, 'HOSPITALITY', CLOSED_ACCESS)).toMatchObject({
        sectionId: 'marketing',
        href: '/marketing',
      });
    }
    expect(activeItem('/marketing', 'HOSPITALITY', CLOSED_ACCESS)?.href).toBe('/marketing');
    // соседний адрес с тем же началом к сайту не относится
    expect(activeItem('/websites', 'HOSPITALITY', CLOSED_ACCESS)?.href).not.toBe('/marketing');
  });
});

describe('старые адреса ведут в модуль', () => {
  it('временная переадресация: /analytics → аналитика, /analytics/setup → настройки', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: '/analytics', destination: '/website/analytics', permanent: false },
        { source: '/analytics/setup', destination: '/website/settings', permanent: false },
      ]),
    );
  });
});

// SCOPE-HARDENING (PR #256) поверх MKT2: хаб и сайт не заводят своего выбора филиала, возврат после выбора общий
describe('хаб «Маркетинг» и выбор филиала', () => {
  const branch = (vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE') => ({
    vertical,
    locationId: 'loc-1',
    location: { businessId: 'biz-1' },
  });

  it('один гостиничный филиал: после выбора человек возвращается на /marketing и /website/*', () => {
    for (const next of ['/marketing', '/website', '/website/settings'])
      expect(decideScope([branch('HOSPITALITY')], next)).toMatchObject({ kind: 'select', target: next });
  });

  it('салон и ресторан на гостиничный хаб не возвращаются; филиалов несколько: выбор, нет: настройка', () => {
    for (const vertical of ['BEAUTY', 'FOOD_SERVICE'] as const)
      expect(decideScope([branch(vertical)], '/marketing').target).not.toBe('/marketing');
    expect(decideScope([branch('HOSPITALITY'), branch('HOSPITALITY')], '/marketing')).toEqual({
      kind: 'choose',
      target: '/branches',
    });
    expect(decideScope([], '/marketing')).toEqual({ kind: 'empty', target: '/onboarding' });
  });
});
