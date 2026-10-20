import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS, menuSectionsFor } from './navigation';
import type { WebVertical } from './vertical-landing';

/**
 * Меню без дублей (аудит платформы 17.10.2026, Д2): пункт не перенаправляет на другой пункт того же меню
 * (у ресторана «Оплаты и касса» и «Все отчёты» вели на «Финансы») и две разные страницы не носят одну подпись
 * (два «Бара» у ресторана). Перенаправление по направлению ищется в тексте страницы:
 * `vertical === 'X') { … redirect(` до первого `return`.
 */
const APP = join(__dirname, '..', 'app');
const VERTICALS: WebVertical[] = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'];
const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const, platform: true };
const items = (v: WebVertical) => menuSectionsFor(owner, v).flatMap((s) => s.items);

function pageSource(href: string): string {
  const dir = join(APP, ...href.split('/').filter(Boolean));
  const direct = join(dir, 'page.tsx');
  if (existsSync(direct)) return readFileSync(direct, 'utf8');
  const optional = existsSync(dir) ? readdirSync(dir).find((d) => d.startsWith('[[...')) : undefined;
  if (optional) return readFileSync(join(dir, optional, 'page.tsx'), 'utf8');
  throw new Error(`нет страницы для ${href}`);
}

function redirectsFor(source: string): WebVertical[] {
  // ветка направления до первого `return`: в ней `redirect(` значит, что страница этому направлению не своя
  return [...source.matchAll(/vertical === '([A-Z_]+)'\)\s*\{(?:(?!return\b)[\s\S]){0,300}?redirect\(/g)].map(
    (m) => m[1] as WebVertical,
  );
}

describe('меню без дублей', () => {
  for (const vertical of VERTICALS) {
    it(`${vertical}: пункт меню не перенаправляет на другую страницу`, () => {
      const bounced = items(vertical)
        .map((i) => i.href)
        .filter((href) => redirectsFor(pageSource(href)).includes(vertical));
      expect(bounced).toEqual([]);
    });
    it(`${vertical}: подписи пунктов не повторяются`, () => {
      const labels = items(vertical).map((i) => i.label);
      expect(labels.filter((l, n) => labels.indexOf(l) !== n)).toEqual([]);
    });
  }
});
