import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS, menuSectionsFor } from './navigation';
import type { WebVertical } from './vertical-landing';

/**
 * Пункт меню направления ведёт на страницу, которая это направление принимает (аудит платформы 17.10.2026, Д1):
 * иначе `requireVertical` молча уводит человека на `/today`. Страница читается как текст: её
 * `requireVertical([...])` и есть список направлений; страница без проверки открыта всем.
 */
const APP = join(__dirname, '..', 'app');
const VERTICALS: WebVertical[] = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'];
const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const, platform: true };

function pageSource(href: string): string {
  const dir = join(APP, ...href.split('/').filter(Boolean));
  const direct = join(dir, 'page.tsx');
  if (existsSync(direct)) return readFileSync(direct, 'utf8');
  // необязательный сегмент `[[...section]]`
  const optional = existsSync(dir) ? readdirSync(dir).find((d) => d.startsWith('[[...')) : undefined;
  if (optional) return readFileSync(join(dir, optional, 'page.tsx'), 'utf8');
  throw new Error(`нет страницы для ${href}`);
}

/** Направления из `requireVertical([...])`; без литерала (константа) или без вызова страница открыта всем */
function pageVerticals(source: string): WebVertical[] {
  const call = /requireVertical\(\s*\[([^\]]*)\]/.exec(source);
  if (!call) return VERTICALS;
  return [...call[1]!.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1] as WebVertical);
}

describe('пункты меню не уводят на другую страницу', () => {
  for (const vertical of VERTICALS)
    it(`${vertical}: каждая страница меню принимает направление`, () => {
      const hrefs = menuSectionsFor(owner, vertical).flatMap((s) => s.items.map((i) => i.href));
      const rejected = hrefs.filter((href) => !pageVerticals(pageSource(href)).includes(vertical));
      expect(rejected).toEqual([]);
    });
});
