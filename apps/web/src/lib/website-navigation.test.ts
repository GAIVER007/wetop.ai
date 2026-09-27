import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import { CLOSED_ACCESS, activeNavigation, navigationItems, sidebarSectionsFor } from './navigation';

describe('сайт в меню — одно место (ADR-107)', () => {
  const sections = sidebarSectionsFor(CLOSED_ACCESS);
  const hrefs = sections.flatMap((section) => section.items.map((item) => item.href));

  it('«Сайт и онлайн-бронирование» — в «Продажах»', () => {
    const sales = sections.find((section) => section.id === 'sales');
    expect(sales?.items.find((item) => item.href === '/website')?.label).toBe(
      'Сайт и онлайн-бронирование',
    );
  });

  it('отдельных «Аналитики сайта» и «Настроек сайта» больше нет', () => {
    expect(hrefs.filter((href) => href.startsWith('/analytics'))).toEqual([]);
    expect(navigationItems.filter((item) => item.href.startsWith('/analytics'))).toEqual([]);
    expect(hrefs.filter((href) => href === '/website')).toHaveLength(1);
  });

  it('«Интеграции» не обещают счётчик и модуль бронирования', () => {
    const connections = navigationItems.find((item) => item.href === '/connections');
    expect(connections?.description).not.toMatch(/счётчик|бронировани/i);
  });

  it('вкладки модуля подсвечивают один пункт меню', () => {
    for (const path of ['/website', '/website/booking', '/website/analytics', '/website/settings'])
      expect(activeNavigation(path)?.href).toBe('/website');
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
