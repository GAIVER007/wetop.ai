import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Сторож окон дат сквозных тестов.
 *
 * Спеки создают настоящие брони на настоящих койках общей dev-базы. Пока окна дат пересекались, прогон
 * в два воркера падал то на одном тесте, то на другом — два спека занимали одну койку на одну ночь, —
 * а поодиночке каждый был зелёным. Теперь у каждого спека свой отрезок будущих суток (`const BASE`),
 * и этот тест не даёт новому спеку молча заехать в чужой: он читает сами файлы и сверяет отрезки.
 *
 * Добавляете спек — задайте ему `BASE` за последним занятым днём и допишите строку в tests/README.md.
 */
const DIR = resolve(import.meta.dirname, '../e2e');

interface Window {
  spec: string;
  from: number;
  to: number;
}

/** Отрезок спека: BASE + минимальное и максимальное смещение из вызовов plus(n). */
function windows(): Window[] {
  const out: Window[] = [];
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.spec.ts'))) {
    const src = readFileSync(resolve(DIR, file), 'utf8');
    const base = /^const BASE = (\d+);/m.exec(src);
    if (!base) continue;
    const offsets = [...src.matchAll(/\bplus\((\d+)\)/g)].map((m) => Number(m[1]));
    if (!offsets.length) continue;
    const b = Number(base[1]);
    out.push({
      spec: file,
      from: b + Math.min(...offsets),
      to: b + Math.max(...offsets),
    });
  }
  return out.sort((a, b) => a.from - b.from);
}

describe('окна дат сквозных тестов', () => {
  it('у каждого спека, который создаёт брони, есть свой BASE', () => {
    const withBase = new Set(windows().map((w) => w.spec));
    const booking = readdirSync(DIR)
      .filter((f) => f.endsWith('.spec.ts'))
      .filter((f) => /\bplus\(\d+\)/.test(readFileSync(resolve(DIR, f), 'utf8')));
    expect([...booking].filter((f) => !withBase.has(f))).toEqual([]);
  });

  it('отрезки не пересекаются: два спека не займут одну койку на одну ночь', () => {
    const all = windows();
    const clashes = all
      .slice(1)
      .map((w, i) => ({ prev: all[i]!, w }))
      .filter(({ prev, w }) => w.from <= prev.to)
      .map(({ prev, w }) => `${prev.spec} ${prev.from}..${prev.to} и ${w.spec} ${w.from}..${w.to}`);
    expect(clashes).toEqual([]);
  });

  it('отрезки лежат в пределах календаря цен и глубины шахматки', () => {
    for (const w of windows()) {
      // цены заведены на год вперёд, MAX_CHESSBOARD_DAYS = 62
      expect(w.to, `${w.spec}: слишком далеко, шахматка такой диапазон не покажет`).toBeLessThan(62);
      expect(w.from, `${w.spec}: отрезок в прошлом`).toBeGreaterThanOrEqual(0);
    }
  });
});
