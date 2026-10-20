import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { previewCustomerCsv, readCustomerCsv } from '@pms/domain';
import { customerXlsxToCsv } from './xlsx-client';

const book = (rows: unknown[][]) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Клиенты');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return out;
};

describe('Excel клиентов идёт тем же путём, что CSV', () => {
  it('первый лист с заголовками даёт те же колонки и строки, что CSV', async () => {
    const csv = await customerXlsxToCsv(book([
      ['Имя', 'Фамилия', 'Телефон'],
      ['Тестовый', 'Первый', '+7 700 000 71 01'],
      ['Тестовый; с точкой', 'Второй', 87000007102],
    ]));
    const file = readCustomerCsv(csv);
    expect(file.headers).toEqual(['Имя', 'Фамилия', 'Телефон']);
    expect(file.mapping).toEqual({ firstName: 0, lastName: 1, phone: 2 });
    const checked = previewCustomerCsv(file, file.mapping);
    expect(checked.rows.map((row) => [row.firstName, row.lastName, row.phone, row.status])).toEqual([
      ['Тестовый', 'Первый', '+7 700 000 71 01', 'ready'],
      ['Тестовый; с точкой', 'Второй', '87000007102', 'ready'],
    ]);
  });
  it('длинный номер числом не превращается в экспоненту', async () => {
    const csv = await customerXlsxToCsv(book([['Имя', 'Телефон'], ['Тестовый', 77000007103]]));
    expect(csv).toContain('77000007103');
    expect(csv).not.toMatch(/E\+/i);
  });
  it('не Excel и пустой файл получают понятный отказ', async () => {
    await expect(customerXlsxToCsv(new TextEncoder().encode('synthetic').buffer as ArrayBuffer))
      .rejects.toThrow('не является Excel');
    await expect(customerXlsxToCsv(new ArrayBuffer(0))).rejects.toThrow('Файл пуст');
  });
});
