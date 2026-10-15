import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Сторож адреса подставного API в наборе UI.
 *
 * Дерево делят несколько сессий, и стенд на 4311 бывает занят соседним прогоном: `playwright.alt.config.ts`
 * поднимает свой и передаёт адрес спекам через `UI_FIXTURE_API`. Спек, у которого адрес зашит константой,
 * в этом случае сбрасывает и настраивает ЧУЖУЮ фикстуру, а страницу читает со своей. Виден он не как внятный
 * отказ, а как «элемент не найден» на шаге, который зависит от `__test/control`: 03.10.2026 так падал
 * `ai-seller.spec` на «Коде для сайта» (`sellerHosts: []` уехал соседу), а до него страдали прогоны
 * техподдержки, отчётов и календаря. Дефект портовый и невидим, когда стенд случайно стоит на 4311.
 *
 * Поэтому адрес у спеков один: `FIXTURE_API` из `tests/ui/fixtures.ts`. Умолчание 4311 живёт там и в
 * `playwright.config.ts` (он этот стенд и поднимает), спеки его не повторяют.
 */
const UI = resolve(import.meta.dirname, '../ui');
/** Любой зашитый адрес стенда: хост и порт подставного API, в кавычках или шаблонной строке */
const HARDCODED = /(?:127\.0\.0\.1|localhost):(?:4311|4312|4318)/;

function specsWithHardcodedAddress(): string[] {
  return readdirSync(UI)
    .filter((f) => f.endsWith('.spec.ts'))
    .filter((f) => HARDCODED.test(readFileSync(resolve(UI, f), 'utf8')));
}

describe('адрес подставного API в наборе UI', () => {
  it('ни один спек не зашивает адрес стенда: он приходит из FIXTURE_API', () => {
    expect(specsWithHardcodedAddress()).toEqual([]);
  });

  it('FIXTURE_API берёт адрес из UI_FIXTURE_API, а 4311 оставляет умолчанием', () => {
    const src = readFileSync(resolve(UI, 'fixtures.ts'), 'utf8');
    expect(src).toMatch(/export const FIXTURE_API =/);
    expect(src).toMatch(/process\.env\[['"]UI_FIXTURE_API['"]\]/);
    expect(src).toMatch(/127\.0\.0\.1:4311/);
  });
});
