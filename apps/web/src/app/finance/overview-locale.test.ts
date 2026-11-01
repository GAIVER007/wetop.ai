import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Английский интерфейс гостиницы (инструкция 01.11.2026): на главной «Низкая загрузка» и в «Последних операциях»
 * финансов дата выходила по-русски («1 нояб.»). Каждая дата экрана берёт язык человека: третий аргумент
 * `displayDate` обязателен.
 */
describe('finance overview: dates in the reader language', () => {
  it('every displayDate call passes the locale', () => {
    const src = readFileSync(resolve(import.meta.dirname, 'overview.tsx'), 'utf8');
    const calls = [...src.matchAll(/displayDate\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)].map((m) => m[1]!);
    expect(calls.length).toBeGreaterThan(0);
    const bare = calls.filter((args) => args.split(',').length < 3);
    expect(bare).toEqual([]);
  });
});
