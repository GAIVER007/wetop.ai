import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Аналитика гостиницы в валюте объекта (решение владельца 20.10.2026, docs/decisions/2026-10-20-personnel-and-currency-next.md).
 * Суммы приходят в тиынах валюты объекта; подпись «₸» без валюты показывала тенге и объекту в USD.
 * Сторож по исходнику: каждая сумма форматируется с валютой, «₸» строкой не пишется.
 */
const FILES = ['overview.tsx', 'channels/channels.tsx'];

describe('аналитика гостиницы: суммы с валютой объекта', () => {
  it.each(FILES)('%s: нет wholeTenge без валюты и нет «₸» строкой', (file) => {
    const src = readFileSync(resolve(import.meta.dirname, file), 'utf8');
    const bare = [...src.matchAll(/wholeTenge\(([^()]*(?:\([^()]*\))?[^()]*)\)/g)]
      .map((m) => m[1]!)
      .filter((args) => !args.includes(','));
    expect(bare, 'wholeTenge без второго аргумента').toEqual([]);
    expect(src.includes('amount={wholeTenge}'), 'wholeTenge передан как функция без валюты').toBe(false);
    expect(src.match(/[`'"][^`'"]*₸/g) ?? [], '«₸» строкой').toEqual([]);
  });
});
