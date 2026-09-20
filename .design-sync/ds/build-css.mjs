/**
 * Собирает один файл стилей для Claude Design из тех же CSS, что грузит стойка.
 *
 * Почему склейка, а не `@import`: конвертер ДОПИСЫВАЕТ cfg.cssEntry в конец `_ds_bundle.css`
 * (package-build.mjs), а `@import` в середине файла по спецификации CSS не работает.
 *
 * Порядок повторяет `apps/web/src/app/layout.tsx` — каскад стойки — и только потом идут стили
 * отдельных экранов. Ни `@import`, ни `url()` в этих файлах нет (проверено 20.09.2026), поэтому
 * склейка ничего не ломает.
 *
 * Запуск: node .design-sync/ds/build-css.mjs   (из корня репозитория, перед конвертером)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

// Порядок как в layout.tsx, затем стили экранов.
const FILES = [
  'apps/web/src/app/globals.css',
  'apps/web/src/app/workspace.css',
  'apps/web/src/app/today/desk.css',
  'apps/web/src/app/today/dashboard.css',
  'apps/web/src/app/management/hotel.css',
  'apps/web/src/app/tokens.css',
  'apps/web/src/app/premium.css',
  'apps/web/src/components/shell/sidebar.css',
  'apps/web/src/app/chessboard/board.css',
  'apps/web/src/app/directory.css',
  'apps/web/src/app/rooms/rooms.css',
  'apps/web/src/app/rates/rates.css',
  'apps/web/src/app/inventory/inventory.css',
  'apps/web/src/app/login/login.css',
];

const parts = FILES.map((rel) => {
  const css = readFileSync(resolve(ROOT, rel), 'utf8');
  return `/* ===== ${rel} ===== */\n${css.trim()}\n`;
});

const out = resolve(HERE, 'styles.generated.css');
writeFileSync(
  out,
  `/* Собрано .design-sync/ds/build-css.mjs из ${FILES.length} файлов стойки. Не править руками. */\n\n` +
    parts.join('\n'),
);
console.error(`» styles.generated.css: ${FILES.length} файлов, ${(parts.join('').length / 1024).toFixed(1)} КБ`);
