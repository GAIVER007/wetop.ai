import { describe, expect, it } from 'vitest';
import { ORGANIZATION_LEVEL_PERMISSIONS } from '@pms/domain';
import { CAPABILITIES, capabilityForRoute } from './capabilities';
import { navigationItems, routeRule } from '../navigation';
import { featureVerticals } from '../features';

/**
 * CORE-03, срез C3a: реестр возможностей равен сегодняшней правде байт в байт. Пока реестр никто не
 * читает, этот тест — единственное, что держит его согласованным с `navigation.ts` и `features.ts`;
 * в C3b–C3d они начнут строиться ИЗ реестра, и тест останется сторожем в обратную сторону.
 */

/** Адреса вне меню с собственным правом (`OFF_MENU_ROUTES` в `navigation.ts`) — тоже обязаны быть в реестре */
const OFF_MENU = ['/ai-seller/knowledge', '/ai-seller/connections', '/ai-seller/agents', '/whats-new'];

const allRegistryRoutes = CAPABILITIES.flatMap((capability) => [...capability.routes]);

describe('реестр возможностей (C3a)', () => {
  it('каждый адрес навигации есть в реестре ровно один раз', () => {
    const missing = [...new Set([...navigationItems.map((item) => item.href), ...OFF_MENU])].filter(
      (href) => !allRegistryRoutes.includes(href),
    );
    expect(missing, 'адреса меню и вне меню, которых нет в реестре').toEqual([]);
    const duplicates = allRegistryRoutes.filter((route, index) => allRegistryRoutes.indexOf(route) !== index);
    expect(duplicates, 'адрес не может принадлежать двум возможностям').toEqual([]);
  });

  it('у каждой записи есть право, направления и scopeLevel', () => {
    expect(CAPABILITIES.length).toBeGreaterThan(0);
    for (const capability of CAPABILITIES) {
      expect(capability.requires, capability.id).toBeTruthy();
      expect(capability.verticals.length, capability.id).toBeGreaterThan(0);
      expect(['ORGANIZATION', 'BUSINESS', 'LOCATION'], capability.id).toContain(capability.scopeLevel);
      expect(capability.routes.length, capability.id).toBeGreaterThan(0);
    }
  });

  it('право каждой записи совпадает с правом страницы по `routeRule`', () => {
    for (const capability of CAPABILITIES)
      for (const route of capability.routes)
        expect(routeRule(route)?.requires, `${capability.id} ${route}`).toBe(capability.requires);
  });

  it('направления каждой записи совпадают с реестром функций (`features.ts`)', () => {
    for (const capability of CAPABILITIES)
      for (const route of capability.routes)
        expect([...featureVerticals(route)].sort(), `${capability.id} ${route}`).toEqual(
          [...capability.verticals].sort(),
        );
  });

  it('организационное право даёт организационный уровень (ADR-183)', () => {
    for (const capability of CAPABILITIES)
      if (
        capability.requires === 'platform' ||
        ORGANIZATION_LEVEL_PERMISSIONS.includes(capability.requires)
      )
        expect(capability.scopeLevel, capability.id).toBe('ORGANIZATION');
  });

  it('решения ADR-183 и ADR-188 закреплены: гости — организация, каталоги бизнеса — бизнес', () => {
    expect(capabilityForRoute('/guests')?.scopeLevel).toBe('ORGANIZATION');
    for (const route of ['/services', '/beauty/services', '/beauty/masters', '/employees', '/menu'])
      expect(capabilityForRoute(route)?.scopeLevel, route).toBe('BUSINESS');
  });

  it('адрес решает самое длинное совпадение корня, как в `routeRule`', () => {
    expect(capabilityForRoute('/beauty/services/new')?.routes).toContain('/beauty/services');
    expect(capabilityForRoute('/beauty')?.routes).not.toContain('/beauty/services');
    expect(capabilityForRoute('/no-such-route')).toBeUndefined();
  });
});
