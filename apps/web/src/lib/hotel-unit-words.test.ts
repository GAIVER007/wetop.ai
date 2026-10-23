import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Аудит гостиницы 22.10.2026 P1-7, проверка живого сайта 23.10.2026: гость и администратор видят слово
 * «номер», а не «ячейка». Внутренние имена (unitCode, комментарии) не трогаем, только видимый текст.
 */
const ROOT = join(__dirname, '..', '..', '..', '..');
const FILES = [
  'apps/web/src/components/shell/tour-steps.ts',
  'apps/web/src/app/channels/events/[revisionId]/page.tsx',
  'apps/web/src/app/management/analytics/occupancy/occupancy.tsx',
  'apps/web/src/app/management/analytics/overview.tsx',
  'apps/web/src/app/finance/day-attention.tsx',
];

/** Строки кода без комментариев: `//`, `*`, `/*` в начале строки */
function visibleLines(source: string): string[] {
  return source.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line));
}

describe('видимый текст гостиницы без слова «ячейка»', () => {
  for (const file of FILES) {
    it(file, () => {
      const hits = visibleLines(readFileSync(join(ROOT, file), 'utf8')).filter((line) =>
        /ячейк|ячеек/i.test(line),
      );
      expect(hits).toEqual([]);
    });
  }
});
