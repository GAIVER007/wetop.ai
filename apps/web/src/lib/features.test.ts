import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_VERTICALS, featureVerticals } from './features';
import { CLOSED_ACCESS, menuSectionsFor } from './navigation';
import type { WebVertical } from './vertical-landing';

/**
 * Реестр функций (план перехода к одной платформе, У1): направления страницы знает одна таблица `features.ts`, и её
 * читают охрана страниц (`requireFeature`), меню и поиск. Сторож сверяет каждую страницу с реестром: страница, которая
 * охраняет себя иначе, чем говорит реестр, это расхождение, а не «особый случай».
 */
const APP = resolve(import.meta.dirname, '../app');
/** Публичные экраны и вход: вне рабочего пространства, направления у них нет */
const PUBLIC = /^\/(login|register|invite|rate|specialists|create|status|design-system)(\/|$)|^\/$/;

function pages(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory() && !name.startsWith('@')) out.push(...pages(full));
  }
  if (readdirSync(dir).includes('page.tsx')) out.push(dir);
  return out;
}
const routeOf = (dir: string) => `/${relative(APP, dir)}`.replace(/\/$/, '') || '/';
const sorted = (v: readonly string[]) => [...v].sort();

/** Направления, которые страница пускает на самом деле, по её исходнику */
function pageVerticals(source: string): readonly string[] {
  const feature = /requireFeature\(\s*'([^']+)'/.exec(source);
  if (feature) return featureVerticals(feature[1]!);
  const literal = /requireVertical\(\s*\[([^\]]*)\]/.exec(source);
  if (literal) return [...literal[1]!.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]!);
  const shell = /restaurantShell\(([^)]*)\)/.exec(source);
  if (shell) return shell[1]!.includes('BEAUTY') ? ['FOOD_SERVICE', 'BEAUTY'] : ['FOOD_SERVICE'];
  if (/loadFood\(|<FoodScreen/.test(source)) return ['FOOD_SERVICE'];
  return ALL_VERTICALS;
}

describe('реестр функций', () => {
  for (const dir of pages(APP)) {
    const route = routeOf(dir);
    if (PUBLIC.test(route)) continue;
    it(`${route}: страница пускает те направления, что в реестре`, () => {
      const source = readFileSync(join(dir, 'page.tsx'), 'utf8');
      const own = route.replace(/\/\[.*$/, '') || route;
      // `requireFeature` называет свой раздел, а не чужой: иначе реестр и страница разойдутся молча
      const feature = /requireFeature\(\s*'([^']+)'/.exec(source)?.[1];
      if (feature) expect(feature).toBe(own);
      expect(sorted(pageVerticals(source))).toEqual(sorted(featureVerticals(route)));
    });
  }

  it('меню каждого направления строится только из его функций', () => {
    const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const, platform: true };
    for (const v of ALL_VERTICALS) {
      const foreign = menuSectionsFor(owner, v as WebVertical)
        .flatMap((s) => s.items)
        .filter((i) => !featureVerticals(i.href).includes(v))
        .map((i) => i.href);
      expect(foreign).toEqual([]);
    }
  });

  it('самый длинный адрес решает: медиатека сайта у всех, публикация у гостиницы', () => {
    expect(sorted(featureVerticals('/marketing/site/assets'))).toEqual(sorted(ALL_VERTICALS));
    expect(featureVerticals('/marketing/site')).toEqual(['HOSPITALITY']);
    expect(featureVerticals('/marketing/sites')).toEqual(ALL_VERTICALS);
  });
});

it('customer detail has its own vertical boundary while the customer list remains shared', () => {
  expect(featureVerticals('/customers')).toEqual(['BEAUTY','FOOD_SERVICE']);
  expect(featureVerticals('/customers/11111111-1111-4111-8111-111111111111')).toEqual(['BEAUTY']);
});

it('kitchen and consumables stock opens for hotel and salon, the restaurant has /stock', () => {
  expect(featureVerticals('/bar/consumables')).toEqual(['HOSPITALITY', 'BEAUTY']);
});

it('зарплата у всех направлений, график персонала гостиницы свой (кабинет горничной 22.10.2026)', () => {
  expect(featureVerticals('/payroll')).toEqual(ALL_VERTICALS);
  expect(featureVerticals('/staff-schedule')).toEqual(['HOSPITALITY']);
});
