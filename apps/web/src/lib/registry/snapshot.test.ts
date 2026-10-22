import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MembershipRole } from '@pms/domain';
import {
  CLOSED_ACCESS,
  activeMenuRoute,
  menuSectionsFor,
  routeRule,
  type NavigationAccess,
} from '../navigation';
import { featureVerticals } from '../features';
import { routeVertical, type WebVertical } from '../vertical-landing';
import { branchDestination } from '../branch-destination';
import { CAPABILITIES } from './capabilities';

/**
 * CORE-03, снимок «до» (план C3a, первое действие): меню трёх направлений для всех ролей и таблица
 * маршрутов, снятые с сегодняшнего `navigation.ts` и спутников. Приёмка C3b и C3c — «до и после байт
 * в байт», и сравнивается ровно этот файл. Пересъёмка только осознанно:
 * `CORE03_SNAPSHOT_UPDATE=1 npx vitest run apps/web/src/lib/registry/snapshot.test.ts` — и в ревью
 * тогда видно, какое поведение изменилось.
 */

const VERTICALS: readonly WebVertical[] = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'];
const ROLES: readonly MembershipRole[] = ['OWNER', 'MANAGER', 'STAFF', 'EMPLOYEE'];

const ACCESS: Record<string, NavigationAccess> = Object.fromEntries([
  ...ROLES.map((role) => [role, { ...CLOSED_ACCESS, role }]),
  ['OWNER+platform', { ...CLOSED_ACCESS, role: 'OWNER', platform: true }],
  ['MANAGER+restricted', { ...CLOSED_ACCESS, role: 'MANAGER', restricted: true as const }],
]);

function menuSnapshot(): unknown {
  const byVertical: Record<string, unknown> = {};
  for (const vertical of VERTICALS) {
    const byAccess: Record<string, unknown> = {};
    for (const [name, access] of Object.entries(ACCESS))
      byAccess[name] = menuSectionsFor(access, vertical).map((section) => ({
        id: section.id,
        label: section.label,
        ...(section.direct ? { direct: true } : {}),
        items: section.items.map((item) => ({ href: item.href, label: item.label })),
      }));
    byVertical[vertical] = byAccess;
  }
  return byVertical;
}

function routeTable(): unknown {
  const routes = [...new Set(CAPABILITIES.flatMap((capability) => [...capability.routes]))].sort();
  return routes.map((route) => {
    const rule = routeRule(route);
    return {
      route,
      vertical: routeVertical(route),
      features: [...featureVerticals(route)],
      branch: branchDestination(route),
      active: activeMenuRoute(route) ?? null,
      rule: rule ? { href: rule.href, label: rule.label, requires: rule.requires ?? null } : null,
    };
  });
}

function check(name: string, current: unknown): void {
  const file = resolve(import.meta.dirname, name);
  const rendered = `${JSON.stringify(current, null, 2)}\n`;
  if (process.env.CORE03_SNAPSHOT_UPDATE === '1' || !existsSync(file)) writeFileSync(file, rendered);
  expect(readFileSync(file, 'utf-8'), `${name}: поведение разошлось со снимком «до»`).toBe(rendered);
}

describe('снимок «до» для приёмки C3b и C3c', () => {
  it('меню трёх направлений для всех ролей совпадает со снимком', () => {
    check('menu-before.json', menuSnapshot());
  });

  it('таблица «адрес × вертикаль × результат» совпадает со снимком', () => {
    check('route-table-before.json', routeTable());
  });
});
