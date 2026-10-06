import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import {
  CLOSED_ACCESS,
  activeMenuRoute,
  activeNavigation,
  menuSectionsFor,
  navigationItems,
  routeRule,
} from './navigation';

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
      expect(activeMenuRoute(path)).toBe('/marketing');
    }
    expect(activeMenuRoute('/marketing')).toBe('/marketing');
    // соседний адрес с тем же началом к сайту не относится
    expect(activeMenuRoute('/websites')).not.toBe('/marketing');
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
