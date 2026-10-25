import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { kk, shell } from './kk';
import { AREAS } from './kk-parts';

/**
 * KK2 (план `plans/desk-kk-2026-10-23.md`): экран переходит на казахский только целиком. В файлах каждой области
 * русский текст живёт лишь внутри `t('…')` и `msg('…')`, и у каждой такой фразы есть перевод; иначе казахский экран
 * показал бы смесь двух языков. Строка, где русский нужен по делу (сверка с ответом API, пример ввода), помечается
 * `kk-allow: <причина>` в комментарии той же строки.
 */
const SRC = join(__dirname, '..');
const CYRILLIC = /[А-Яа-яЁё]/;
const PHRASE = /\b(?:t|msg)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*?)\1/gs;

function filesOf(path: string): string[] {
  const full = join(SRC, path);
  if (!statSync(full).isDirectory()) return [full];
  return readdirSync(full).flatMap((name) => filesOf(join(path, name)));
}

const screenFile = (file: string) => /\.(tsx?)$/.test(file) && !/\.(test|spec)\.tsx?$/.test(file);

/** Комментарии вон, переносы строк остаются: номер строки в ответе сторожа совпадает с файлом */
function stripComments(source: string): string {
  const blank = (text: string) => text.replace(/[^\n]/g, ' ');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, (_all, before: string) => before);
}

function scan(file: string) {
  const raw = readFileSync(file, 'utf8');
  const allowed = new Set(raw.split('\n').flatMap((line, i) => (line.includes('kk-allow:') ? [i] : [])));
  const phrases: string[] = [];
  const code = stripComments(raw).replace(PHRASE, (all, _quote: string, text: string) => {
    if (_quote === '`' && text.includes('${')) return all;
    phrases.push(text.replace(/\\(['"`\\])/g, '$1'));
    return all.replace(/[^\n]/g, ' ');
  });
  const leftovers = code
    .split('\n')
    .flatMap((line, i) => (CYRILLIC.test(line) && !allowed.has(i) ? [`${relative(SRC, file)}:${i + 1}: ${line.trim()}`] : []));
  return { phrases, leftovers };
}

describe('KK2: экраны на казахском целиком', () => {
  for (const [area, part] of Object.entries(AREAS))
    it(`${area}: русский текст только в t(…) и msg(…), у каждой фразы есть перевод`, () => {
      const files = part.paths.flatMap(filesOf).filter(screenFile);
      expect(files.length, 'пути области указывают на файлы').toBeGreaterThan(0);
      const found = files.map(scan);
      // Найден русский текст мимо перевода: оберните его в t('…') (в разметке) или msg('…') (в справочнике) и
      // допишите перевод в apps/web/src/i18n/kk-parts/<область>.ts
      const leftovers = found.flatMap((f) => f.leftovers);
      if (leftovers.length) expect.fail(`русский мимо t(…)/msg(…), ${leftovers.length}:\n${leftovers.join('\n')}`);
      const missing = [...new Set(found.flatMap((f) => f.phrases))].filter((phrase) => !kk[phrase]);
      if (missing.length) expect.fail(`нет перевода, ${missing.length}:\n${missing.join('\n')}`);
    });

  it('одна русская фраза переводится везде одинаково: части словаря не спорят друг с другом', () => {
    const seen = new Map<string, string>(Object.entries(shell));
    const conflicts: string[] = [];
    for (const [area, part] of Object.entries(AREAS))
      for (const [ru, value] of Object.entries(part.phrases)) {
        const before = seen.get(ru);
        if (before !== undefined && before !== value) conflicts.push(`${area}: «${ru}» = «${value}», раньше «${before}»`);
        seen.set(ru, value);
      }
    expect(conflicts).toEqual([]);
  });
});
