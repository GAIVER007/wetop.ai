import { describe, expect, it } from 'vitest';
import { SITE_SPEC_SECTIONS } from '@pms/domain';
import { ctx, exampleSpec } from '../test/fixtures';
import { SECTION_RENDERERS } from './sections';
import type { Section } from '../types';

/**
 * Каждый вариант каждой секции рисуется своим рендерером (кроме `pricing`, он скрыт до Q-276). Секция берётся из примера
 * и меняется только вариантом; картинки даются картой ассетов, как появятся с MKT8.
 */
const ASSET = 'https://assets.example.test/img.webp';

function sectionOf(type: string, variant: string): Section {
  const spec = exampleSpec();
  const found = spec.pages.flatMap((p) => p.sections).find((s) => s.type === type)!;
  return { ...structuredClone(found), variant };
}

const cases = Object.entries(SITE_SPEC_SECTIONS)
  .filter(([type]) => type !== 'pricing')
  .flatMap(([type, variants]) => variants.map((variant) => [type, variant] as const));

describe('каждый вариант рисуется', () => {
  it.each(cases)('%s %s', (type, variant) => {
    const s = sectionOf(type, variant);
    const assets: Record<string, string> = {};
    for (const id of JSON.stringify(s).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) ?? []) assets[id] = ASSET;
    const html = SECTION_RENDERERS[type]![variant]!(s, ctx({ assets }), { h1: false });
    expect(html.startsWith(`<section id="${s.id}"`)).toBe(true);
    expect(html).toContain(`<h2 id="${s.id}-title">`);
  });

  it('pricing не рисуется до Q-276: рендерер отказывает, а не выдумывает цену', () => {
    expect(() => SECTION_RENDERERS['pricing']!['FROM_PRICES']!(sectionOf('pricing', 'FROM_PRICES'), ctx(), { h1: false })).toThrow(/Q-276/);
  });

  it('картинка с картой ассетов: адрес из карты, ALT экранирован, ленивая загрузка', () => {
    const s = sectionOf('gallery', 'GRID');
    const images = s['images'] as Array<{ assetId: string; alt: { ru: string } }>;
    images[0]!.alt = { ru: 'Номер "люкс" & вид' };
    const assets = Object.fromEntries(images.map((i) => [i.assetId, ASSET]));
    const html = SECTION_RENDERERS['gallery']!['GRID']!(s, ctx({ assets }), { h1: false });
    expect(html).toContain(`<img src="${ASSET}" alt="Номер &quot;люкс&quot; &amp; вид" loading="lazy"`);
  });
});
