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
import { decideScope } from './scope-resolve';

describe('сайт в меню — одно место (ADR-117)', () => {
  const sections = menuSectionsFor(CLOSED_ACCESS);
  const hrefs = sections.flatMap((section) => section.items.map((item) => item.href));

  // MKT2 (ADR-149): вход в сайт переехал из «Продаж» в группу «Маркетинг», адреса /website/* прежние
  it('«Продвижение» (ADR-184): своя группа, первый пункт «Обзор» ведёт в хаб /marketing', () => {
    const marketing = sections.find((section) => section.id === 'marketing');
    expect(marketing?.label).toBe('Продвижение');
    expect(marketing?.direct).toBeUndefined();
    expect(marketing?.items.map((item) => [item.href, item.label])).toEqual([
      // верхнее меню 17.10.2026: «Маркетинг» и «Продажи» одним разделом
      ['/marketing', 'Обзор'],
      ['/marketing/ads', 'ИИ-таргетолог'],
      ['/marketing/content', 'Контент'],
      ['/ai-agents', 'ИИ-продавец'],
      ['/market', 'Анализ конкурентов'],
      ['/sales', 'Обзор продаж'],
      // МКТ-В1 (ADR-MKT-B1): учёт бюджета и расходов маркетинга
      ['/marketing/budget', 'Бюджет'],
      // «Аналитика маркетинга» (10.10.2026): эффективность источников
      ['/marketing/analytics', 'Аналитика маркетинга'],
    ]);
  });

  it('отдельных «Продаж» нет, и сайт пунктом меню не стоит', () => {
    expect(sections.find((section) => section.id === 'sales')).toBeUndefined();
    const items = sections.flatMap((section) => section.items);
    expect(items.map((item) => item.href)).not.toContain('/website');
    expect(items.map((item) => item.label)).not.toContain('Сайт и онлайн-бронирование');
  });

  it('хаб и сайт открыты правом раздела «Маркетинг» (ADR-MKT-B7: `marketing` вместо прежнего `settings`)', () => {
    expect(routeRule('/marketing')?.requires).toBe('marketing');
    for (const path of ['/website', '/website/booking', '/website/analytics', '/website/settings'])
      expect(routeRule(path)?.requires).toBe('marketing');
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

  it('вкладки модуля подсвечивают один пункт меню: «Обзор» группы «Продвижение»', () => {
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
