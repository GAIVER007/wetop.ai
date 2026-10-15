/**
 * Опись мёртвого CSS стойки (MV8.5 DS0a). Только опись: ничего не удаляет, удаление по ней делает DS0b.
 *
 * Берёт классы из селекторов всех `.css` в `apps/web/src` и ищет имя класса целым словом в `.ts` и `.tsx`.
 * Класс без вхождений попадает в опись. Если имя похоже на собранное из шаблона (`` `tone-${x}` `` даёт
 * `tone-ok`), он помечается «возможно динамический» и требует ручной проверки.
 *
 *   npx tsx scripts/design/dead-css.ts            таблица Markdown в stdout
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const SRC = resolve(ROOT, 'apps/web/src');

/** Классы из селекторов (не из значений, строк и комментариев), по алфавиту без повторов */
export function classNames(css: string): string[] {
  const clean = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(['"])(?:\\.|(?!\1).)*\1/g, '""');
  const out = new Set<string>();
  // Селектор: текст перед `{`, кроме at-правил вроде `@media (...) {`
  for (const m of clean.matchAll(/([^{}]+)\{/g)) {
    const selector = m[1]!.trim();
    if (selector.startsWith('@')) continue;
    for (const c of selector.replace(/\[[^\]]*\]/g, '').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.add(c[1]!);
  }
  return [...out].sort();
}

export interface DeadClass {
  name: string;
  /** Есть шаблон с подстановкой, из которого могло собраться имя */
  dynamic: boolean;
}

/** Классы без вхождений целым словом в исходниках */
export function deadClasses(names: string[], sources: string[]): DeadClass[] {
  const text = sources.join('\n');
  const prefixes = [...text.matchAll(/([A-Za-z][\w-]*-)\$\{/g)].map((m) => m[1]!);
  const used = (name: string) => new RegExp(`(?<![\\w-])${name.replace(/[-]/g, '\\-')}(?![\\w-])`).test(text);
  return names
    .filter((name) => !used(name))
    .map((name) => ({ name, dynamic: prefixes.some((p) => name.startsWith(p)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(name)) out.push(p);
  }
  return out;
}

if (process.argv[1] && /dead-css\.(ts|js)$/.test(process.argv[1])) {
  const sources = walk(SRC, /\.tsx?$/).map((p) => readFileSync(p, 'utf8'));
  const rows: string[] = [];
  let total = 0;
  for (const file of walk(SRC, /\.css$/).sort()) {
    if (file.endsWith('tokens.css')) continue;
    const dead = deadClasses(classNames(readFileSync(file, 'utf8')), sources);
    total += dead.length;
    for (const d of dead) rows.push(`| \`${relative(ROOT, file)}\` | \`.${d.name}\` | ${d.dynamic ? 'возможно динамический' : 'нет вхождений'} |`);
  }
  console.log(`Классов без вхождений: ${total}\n\n| Файл | Класс | Пометка |\n|---|---|---|\n${rows.join('\n')}`);
}
