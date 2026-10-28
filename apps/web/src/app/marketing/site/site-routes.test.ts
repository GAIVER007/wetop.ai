import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { featureVerticals, ALL_VERTICALS } from '../../../lib/features';
import { bookingModes, publishTarget } from './editor/vertical-status';

/**
 * Сайт салона и ресторана (аудит «Сайт и SEO» 28.10.2026). API строит и публикует сайт любого направления с
 * ADR-185/SITE-3, формы записи салона и брони стола работают (SITE-4/5). Запрет «Опубликовать» у салона и ресторана
 * (Д10, 17.10.2026) остался в вебе по ошибке: публикация открыта всем трём направлениям, гостиничный виджет брони
 * номеров и тариф брони только у гостиницы.
 */
const verticalsOf = (page: string) => {
  const source = readFileSync(resolve(import.meta.dirname, page), 'utf8');
  const call = /requireVertical\(\s*\[([^\]]*)\]/.exec(source);
  return call ? [...call[1]!.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]) : ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'];
};

describe('сайт всех направлений: медиатека и публикация', () => {
  it('медиатека принимает те же направления, что редактор', () => {
    expect(verticalsOf('assets/page.tsx')).toEqual(verticalsOf('editor/page.tsx'));
  });
  it('«Опубликовать» ведёт на страницу публикации у всех трёх направлений', () => {
    for (const v of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const)
      expect(publishTarget(v)).toEqual({ href: '/marketing/site' });
  });
  it('страница публикации открыта всем трём направлениям', () => {
    expect([...featureVerticals('/marketing/site')].sort()).toEqual([...ALL_VERTICALS].sort());
  });
  it('виджет брони номеров только у гостиницы', () => {
    expect(bookingModes('HOSPITALITY')).toContain('WETOP_WIDGET');
    expect(bookingModes('BEAUTY')).toEqual(['NONE']);
    expect(bookingModes('FOOD_SERVICE')).toEqual(['NONE']);
  });
});
