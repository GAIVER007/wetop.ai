import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseExelyServices } from './parse-services';

const md = readFileSync(resolve(import.meta.dirname, '__fixtures__/spravochniki.md'), 'utf-8');

describe('parseExelyServices', () => {
  it('reads the services table: name, price in minor units, group', () => {
    expect(parseExelyServices(md)).toEqual([
      { name: 'Стирка (1 загрузка)', priceMinor: 50_000n, group: 'Прачечная' },
      { name: 'Вода 0,5', priceMinor: 70_000n, group: 'Минибар' },
    ]);
  });
  it('fails loudly without the table or with a non-numeric price', () => {
    expect(() => parseExelyServices('# nothing')).toThrow(/Услуги/);
    expect(() =>
      parseExelyServices(
        '## 8. Услуги\n\n| Услуга | Цена | Группа |\n|---|---|---|\n| Сауна | дорого | — |',
      ),
    ).toThrow(/Сауна/);
  });
});
