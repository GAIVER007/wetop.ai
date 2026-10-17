import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { publishTarget } from './editor/vertical-status';

/**
 * Редактор сайта открыт салону и ресторану, значит, и всё, куда он ведёт (аудит платформы 17.10.2026, Д10): раньше
 * «Изображения» уводили их на «Главную», а «Опубликовать» туда же, потому что страницы принимали только гостиницу.
 */
const verticalsOf = (page: string) => {
  const source = readFileSync(resolve(import.meta.dirname, page), 'utf8');
  const call = /requireVertical\(\s*\[([^\]]*)\]/.exec(source);
  return call ? [...call[1]!.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]) : ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'];
};

describe('сайт салона и ресторана: медиатека и публикация', () => {
  it('медиатека принимает те же направления, что редактор', () => {
    expect(verticalsOf('assets/page.tsx')).toEqual(verticalsOf('editor/page.tsx'));
  });
  it('публикация: гостинице ссылка, салону и ресторану причина вместо перехода на «Главную»', () => {
    expect(publishTarget('HOSPITALITY')).toEqual({ href: '/marketing/site' });
    for (const v of ['BEAUTY', 'FOOD_SERVICE'] as const) {
      const t = publishTarget(v);
      expect(t).not.toHaveProperty('href');
      expect(t).toHaveProperty('reason');
    }
  });
});
