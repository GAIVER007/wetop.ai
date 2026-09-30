import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Владелец 30.09.2026: название поставщика менеджера каналов не показывается нигде — ни в стойке,
 * ни на главной, ни в ответах API и бота. В коде имя остаётся в идентификаторах, путях и комментариях;
 * сторож ищет его только в тексте, который видит человек: после снятия комментариев отдельное слово.
 */
const ROOT = join(__dirname, '..', '..');
const VENDOR = /\bChannex\b/;

const SCOPES: { dir: string; ext: RegExp; python?: boolean }[] = [
  { dir: 'apps/web/src', ext: /\.tsx?$/ },
  { dir: 'apps/site/src', ext: /\.tsx?$/ },
  { dir: 'apps/api/src', ext: /\.ts$/ },
  { dir: 'apps/ai-seller/src', ext: /\.py$/, python: true },
];

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, ext, out);
    else if (ext.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

function stripTs(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
    .join('\n');
}

function stripPy(src: string): string {
  return src
    .replace(/^\s*("""|''')[\s\S]*?\1/gm, '')
    .split('\n')
    .map((line) => line.replace(/#.*$/, ''))
    .join('\n');
}

/** Логи сервера читает не человек за стойкой, а тот, кто разбирает сбой: там имя поставщика нужно. */
const isServerLog = (line: string) => /\b(this\.log|log|logger)\.(log|warn|error|debug)\(/.test(line);

export function vendorLines(): string[] {
  const hits: string[] = [];
  for (const scope of SCOPES) {
    for (const file of walk(join(ROOT, scope.dir), scope.ext)) {
      const text = (scope.python ? stripPy : stripTs)(readFileSync(file, 'utf8'));
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        if (!VENDOR.test(line)) return;
        const around = lines.slice(Math.max(0, i - 2), i + 1).join('\n');
        if (isServerLog(around)) return;
        hits.push(`${relative(ROOT, file)}: ${line.trim()}`);
      });
    }
  }
  return hits;
}

describe('название поставщика менеджера каналов не видно пользователю', () => {
  it('нет слова «Channex» в текстах стойки, главной, API и бота', () => {
    expect(vendorLines()).toEqual([]);
  });
});
