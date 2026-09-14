/**
 * Генерация из `design/tokens.json`:
 *   apps/web/src/app/tokens.css — переменные CSS с прежними именами;
 *   design/contrast.md — таблица контраста для обеих тем.
 *
 * Запуск: `npx tsx scripts/design/src/build-tokens.ts` (или `npm run design:build`).
 * `--check` — ничего не пишет, выходит с кодом 1, если файлы устарели.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastTable, renderContrastMd, renderTokensCss, type ResolverDocument } from './tokens';

export const ROOT = resolve(import.meta.dirname, '../../..');
export const TOKENS_JSON = resolve(ROOT, 'design/tokens.json');
export const TOKENS_CSS = resolve(ROOT, 'apps/web/src/app/tokens.css');
export const CONTRAST_MD = resolve(ROOT, 'design/contrast.md');

export function loadTokens(): ResolverDocument {
  return JSON.parse(readFileSync(TOKENS_JSON, 'utf8')) as ResolverDocument;
}

export function build(): { css: string; contrast: string } {
  const doc = loadTokens();
  return { css: renderTokensCss(doc), contrast: renderContrastMd(contrastTable(doc)) };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const { css, contrast } = build();
  const check = process.argv.includes('--check');
  const read = (p: string) => {
    try {
      return readFileSync(p, 'utf8');
    } catch {
      return '';
    }
  };
  const stale = [
    [TOKENS_CSS, css],
    [CONTRAST_MD, contrast],
  ].filter(([p, content]) => read(p!) !== content);
  if (check) {
    if (stale.length) {
      console.error(`Устарели: ${stale.map(([p]) => p).join(', ')} — запустите npm run design:build`);
      process.exit(1);
    }
    console.log('tokens.css и contrast.md совпадают с design/tokens.json');
  } else {
    writeFileSync(TOKENS_CSS, css);
    writeFileSync(CONTRAST_MD, contrast);
    console.log(`Записано: ${TOKENS_CSS}, ${CONTRAST_MD} (${stale.length ? 'изменились' : 'без изменений'})`);
  }
}
