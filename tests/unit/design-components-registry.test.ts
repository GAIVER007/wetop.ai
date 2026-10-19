import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Новый компонент только после строки в DESIGN.md §8 (ADR-048), проверка кодом по разбору ментора 19.10.2026.
 * Компонент: файл `.tsx` в `apps/web/src/components/` кроме `ui.tsx` (его примитивы описаны в §8 по именам).
 * Строка в §8 есть, если раздел называет файл (`segmented.tsx`, `shell/search.tsx`); значки описаны в §7 (`icon.tsx`).
 */
const ROOT = resolve(import.meta.dirname, '../..');
const DIR = resolve(ROOT, 'apps/web/src/components');
const DESIGN = readFileSync(resolve(ROOT, 'DESIGN.md'), 'utf8');

/** Долг на 19.10.2026: файлы без строки в §8. Список только сокращается: дописали строку, уберите имя отсюда. */
const KNOWN_UNLISTED = new Set([
  'agentation-preview.tsx',
  'auth-shell.tsx',
  'beauty/appointment-history.tsx',
  'control-navigation.tsx',
  'date-range-popover.tsx',
  'dev-agentation.tsx',
  'employee-filter.tsx',
  'employee-portal/cabinet.tsx',
  'employee-portal/locations.tsx',
  'employee-portal/management.tsx',
  'employee-portal/media.tsx',
  'employee-portal/reviews.tsx',
  'employee-portal/screen.tsx',
  'employee-portal/service-prices.tsx',
  'employee-workspace/basic-form.tsx',
  'employee-workspace/workspace.tsx',
  'load-error.tsx',
  'quick-report-reference.tsx',
  'quick-report.tsx',
  'refresh-button.tsx',
  'section-cards.tsx',
  'shell/account-menu.tsx',
  'shell/branch-switcher.tsx',
  'shell/property-block.tsx',
  'shell/tab-nav.tsx',
  'shell/whats-new-link.tsx',
  'team-navigation.tsx',
  'theme-provider.tsx',
  'workspace-session-boundary.tsx',
]);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const section8 = DESIGN.slice(DESIGN.indexOf('\n## 7. '));
const listed = (file: string) => {
  const base = file.split('/').pop()!;
  return section8.includes(file) || new RegExp(`(^|[\\s\`/(])${base.replace('.', '\\.')}`).test(section8);
};

const components = walk(DIR)
  .map((p) => relative(DIR, p))
  .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx') && f !== 'ui.tsx')
  .sort();

describe('реестр компонентов DESIGN.md §8', () => {
  it('раздел §8 найден', () => {
    expect(section8.length).toBeGreaterThan(1000);
  });

  it('у каждого компонента есть строка в §8', () => {
    const missing = components.filter((f) => !listed(f) && !KNOWN_UNLISTED.has(f));
    expect(missing, 'новый компонент без строки в DESIGN.md §8: сначала строка, потом код').toEqual([]);
  });

  it('долг только сокращается', () => {
    const paid = [...KNOWN_UNLISTED].filter((f) => !components.includes(f) || listed(f));
    expect(paid, 'строка в §8 появилась или файла нет: уберите имя из KNOWN_UNLISTED').toEqual([]);
  });
});
