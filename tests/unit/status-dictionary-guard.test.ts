import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { expect, it } from 'vitest';

/*
 * Слова статусов живут только в реестрах `apps/web/src/lib/status/*` (MV8.5 DS1a). Сторож ищет вне них
 * объект, где три и больше ключа одного домена получают русское слово: так выглядит локальный словарь.
 * Пояснение к действию («убрана, ждёт проверки») или глагол кнопки статусом не являются; такой объект
 * помечается строкой `status-hint: <причина>` не дальше трёх строк над ним, и сторож его пропускает.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const WEB = resolve(ROOT, 'apps/web/src');
const DOMAINS: Record<string, string[]> = {
  hospitality: ['TENTATIVE', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'],
  housekeeping: ['DIRTY', 'CLEAN', 'INSPECTED'],
  beauty: ['BOOKED', 'CONFIRMED', 'DONE', 'NO_SHOW', 'CANCELLED'],
  food: ['BOOKED', 'CONFIRMED', 'SEATED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
  payment: ['paid', 'partial', 'unpaid', 'due', 'refund', 'refunded'],
  source: ['DESK', 'PHONE', 'WHATSAPP', 'WALK_IN', 'INSTAGRAM', 'OTA', 'WEBSITE'],
};

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory())
      return f === 'status' && dir === join(WEB, 'lib') ? [] : sources(p);
    return /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });

/** объект `{ KEY: 'слово', … }` (без вложенных фигурных скобок) или список пар `[['KEY', 'слово'], …]` */
const BLOCKS = [
  { re: /\{([^{}]*)\}/g, pair: /(?:^|[\s,])['"]?([A-Za-z_]+)['"]?\s*:\s*['"`]([^'"`]*)['"`]/g },
  {
    re: /\[((?:\s*\[\s*['"][A-Za-z_]+['"]\s*,\s*['"`][^'"`]*['"`]\s*\]\s*,?)+)\s*\]/g,
    pair: /\[\s*['"]([A-Za-z_]+)['"]\s*,\s*['"`]([^'"`]*)['"`]/g,
  },
];

function localDictionaries(code: string): Array<{ line: number; domain: string }> {
  const found: Array<{ line: number; domain: string }> = [];
  for (const { re, pair } of BLOCKS)
    for (const m of code.matchAll(re)) {
      const keys = [...m[1]!.matchAll(pair)]
        .filter((k) => /[А-Яа-яЁё]/.test(k[2]!))
        .map((k) => k[1]!);
      const lines = code.slice(0, m.index).split('\n');
      if (lines.slice(-4).some((l) => /status-hint:\s*\S/.test(l))) continue;
      // домен с наибольшим совпадением: у салона, ресторана и гостиницы есть общие CONFIRMED и NO_SHOW
      const [domain, hits] = Object.entries(DOMAINS)
        .map(([d, values]) => [d, values.filter((v) => keys.includes(v)).length] as const)
        .sort((x, y) => y[1] - x[1])[0]!;
      if (hits >= 3) found.push({ line: lines.length, domain });
    }
  return found;
}

it('сторож видит локальный словарь и пропускает помеченное пояснение', () => {
  expect(
    localDictionaries("const X = { TENTATIVE: 'а', CONFIRMED: 'б', NO_SHOW: 'в' };"),
  ).toHaveLength(1);
  expect(
    localDictionaries(
      "// status-hint: итог действия\nconst X = { DIRTY: 'а, б', CLEAN: 'в', INSPECTED: 'г' };",
    ),
  ).toEqual([]);
  expect(
    localDictionaries("const X = { DIRTY: 'dirty', CLEAN: 'clean', INSPECTED: 'ok' };"),
  ).toEqual([]);
  expect(
    localDictionaries(
      "const L = [\n  ['TENTATIVE', 'а'],\n  ['CONFIRMED', 'б'],\n  ['CHECKED_IN', 'в'],\n];",
    ),
  ).toHaveLength(1);
});

it('вне lib/status нет своих словарей статусов', () => {
  const hits = sources(WEB).flatMap((f) =>
    localDictionaries(readFileSync(f, 'utf8')).map(
      (h) => `${relative(ROOT, f)}:${h.line} (${h.domain})`,
    ),
  );
  expect(hits).toEqual([]);
});
