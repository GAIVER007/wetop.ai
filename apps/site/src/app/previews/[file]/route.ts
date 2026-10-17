import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDictionary } from '../../../i18n';
import type { SegmentSlug } from '../../../i18n/types';

/*
 * Рисунок первого экрана для типа бизнеса (17.10.2026): один шаблон `public/design-only/beauty.svg`, в нём
 * меняются только подпись дня и шесть названий услуг из словаря (`segments.previews`). Вёрстка рисунка одна,
 * копий файла нет. Статическая сборка пишет готовые `/previews/<тип>.svg`.
 */
export const dynamic = 'force-static';
export const dynamicParams = false;

const TEMPLATE = 'public/design-only/beauty.svg';
const SERVICE_TEXT = /(<text[^>]*>)(Стрижка|Окрашивание|Маникюр|Укладка)(<\/text>)/g;
const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function generateStaticParams(): Array<{ file: string }> {
  return Object.keys(getDictionary().segments.previews).map((slug) => ({ file: `${slug}.svg` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const slug = (await params).file.replace(/\.svg$/, '') as SegmentSlug;
  const preview = getDictionary().segments.previews[slug];
  if (!preview) return new Response('Not found', { status: 404 });
  let index = 0;
  const svg = readFileSync(join(process.cwd(), TEMPLATE), 'utf8')
    .replace('рабочий день салона', escape(preview.day))
    .replace(SERVICE_TEXT, (_match, open: string, _old: string, close: string) => {
      const name = preview.services[index++];
      return `${open}${escape(name ?? '')}${close}`;
    });
  // Шаблон изменился и блоков услуг стало не шесть: сборка падает, а не рисует пустые подписи
  if (index !== preview.services.length)
    throw new Error(`${TEMPLATE}: блоков услуг ${index}, подписей ${preview.services.length}`);
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
}
