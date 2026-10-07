/**
 * MV8.5 DS0b: сравнение вычисленных стилей «до» и «после» (их снимает `tests/ui/ds0b-capture.spec.ts`).
 *
 * Запуск: `npx tsx scripts/design/ds0b-style-diff.ts $DS0B_STYLES_DIR/before $DS0B_STYLES_DIR/after`
 * Печатает по маршрутам число элементов с расхождением и сами расхождения, сгруппированные по классу
 * элемента и свойству, чтобы одна правка примитива читалась одной строкой, а не сотней.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Dump = Record<string, Record<string, string>>;

export function diffDumps(before: Dump, after: Dump) {
  const changes: { path: string; cls: string; prop: string; from: string; to: string }[] = [];
  const missing: string[] = [];
  for (const [path, row] of Object.entries(before)) {
    const next = after[path];
    if (!next) {
      missing.push(path);
      continue;
    }
    for (const [prop, value] of Object.entries(row)) {
      if (prop === 'class') continue;
      // цвет рамки нулевой толщины не виден: такое расхождение не считается
      const side = /^border-(top|bottom|left|right)-color$/.exec(prop)?.[1];
      const width = `border-${side}-width`;
      if (side && row[width] === '0px' && next[width] === '0px') continue;
      if (next[prop] !== value)
        changes.push({ path, cls: row['class'] ?? '', prop, from: value, to: next[prop] ?? '' });
    }
  }
  const added = Object.keys(after).filter((p) => !(p in before));
  return { changes, missing, added };
}

function main(beforeDir: string, afterDir: string, limit = 12) {
  const dir = (d: string) => d;
  let total = 0;
  for (const file of readdirSync(dir(beforeDir)).sort()) {
    const afterFile = join(dir(afterDir), file);
    if (!existsSync(afterFile)) {
      console.log(`${file}: нет снимка «после»`);
      continue;
    }
    const before = JSON.parse(readFileSync(join(dir(beforeDir), file), 'utf8')) as Dump;
    const after = JSON.parse(readFileSync(afterFile, 'utf8')) as Dump;
    const { changes, missing, added } = diffDumps(before, after);
    const elements = new Set(changes.map((c) => c.path)).size;
    total += elements;
    console.log(
      `${file}: элементов ${Object.keys(before).length}, с расхождением ${elements}, ` +
        `пропало ${missing.length}, появилось ${added.length}`,
    );
    const groups = new Map<string, number>();
    for (const c of changes) {
      const key = `  [${c.cls.split(/\s+/).slice(0, 3).join(' ')}] ${c.prop}: ${c.from} → ${c.to}`;
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    [...groups.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .forEach(([k, n]) => console.log(`${k}  ×${n}`));
  }
  console.log(`итого элементов с расхождением: ${total}`);
}

if (process.argv[2] && process.argv[3])
  main(process.argv[2], process.argv[3], Number(process.argv[4] ?? 12));
