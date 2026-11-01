import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

/*
 * Стекло «A» (владелец 01.11.2026) не меняет размеры шапки и страницы. Гейт main 5c1b83ce (run 41340538387) упал на
 * том, что «парящая» шапка получила отступ сверху (страница выросла на 8 px: «Все бизнесы», «Деньги», каналы
 * перестали помещаться в один экран) и рамку в 1 px (шапка 89 вместо 88), а подписи разделов на стеклянной
 * подложке тёмной темы цветом --muted не держали контраст 4,5:1 (axe, beauty positions).
 */
const css = readFileSync(
  resolve(import.meta.dirname, '../../apps/web/src/app/glass-a.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');
const body = (selector: string) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
};

it('шапка стекла «A» без внешнего отступа и рамки: высота шапки и страницы прежняя', () => {
  const header = body('.workspace > .workspace-header');
  expect(header).not.toMatch(/(^|[\s;{])margin(-top|-bottom|-block)?\s*:/);
  expect(header).not.toMatch(/(^|[\s;{])border(-top|-bottom|-width)?\s*:/);
  expect(css).not.toMatch(/--header-h:[^;]*var\(--space-2\)/);
});

it('подписи разделов на стеклянной подложке читаются: цвет --text-2, не --muted', () => {
  expect(body('.tabnav .tabnav__tab')).toMatch(/color:\s*var\(--text-2\)/);
});
