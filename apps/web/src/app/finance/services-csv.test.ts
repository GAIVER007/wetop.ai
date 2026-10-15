import { describe, expect, it } from 'vitest';
import { servicesCsv } from './services-csv';

const rows = [
  {
    code: 'LAUNDRY',
    name: 'Стирка (1 загрузка)',
    group: 'Прачечная',
    charges: 2,
    quantity: 3,
    amountMinor: '45000',
  },
  { code: null, name: null, group: null, charges: 1, quantity: 1, amountMinor: '5000' },
];

describe('servicesCsv', () => {
  it('шапка, BOM, CRLF и «;» — как у других выгрузок; «вручную» — словами, суммы с запятой', () => {
    const csv = servicesCsv(rows);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('﻿Услуга;Группа;Начислений;Штук;Сумма, ₸');
    expect(lines[1]).toBe('Стирка (1 загрузка);Прачечная;2;3;450,00');
    expect(lines[2]).toBe('Начислено вручную;;1;1;50,00');
  });

  it('поле с «;» берётся в кавычки', () => {
    const csv = servicesCsv([{ ...rows[0]!, name: 'А;Б' }]);
    expect(csv.split('\r\n')[1]!.startsWith('"А;Б"')).toBe(true);
  });
});
