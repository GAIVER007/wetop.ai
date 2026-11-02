import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import type { BeautyCustomerRow } from '../../lib/api';
import { exportBeautyCustomersXlsx, parseBeautyCustomersXlsx } from './xlsx';

vi.mock('server-only', () => ({}));

const workbook = (rows: unknown[][]) => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Клиенты');
  return new Uint8Array(XLSX.write(book, { bookType: 'xlsx', type: 'array' }));
};

const customer = (overrides: Partial<BeautyCustomerRow> = {}): BeautyCustomerRow => ({
  id: 'customer-test-1',
  firstName: 'Алия',
  lastName: 'Ким',
  phone: '+77000000001',
  status: 'ACTIVE',
  visits: 2,
  paidVisits: 2,
  noShows: 0,
  lastVisitAt: '2026-10-17T10:00:00.000Z',
  lastVisitLocalDate: '2026-10-17',
  avgCheckMinor: '125000',
  avgCheckCurrency: 'KZT',
  isVip: false,
  birthDate: null,
  birthdayInDays: null,
  ...overrides,
});

describe('D2: безопасный XLSX импорт и выгрузка клиентов', () => {
  it('преобразует первый лист XLSX в тот же CSV-контракт импорта', async () => {
    const csv = await parseBeautyCustomersXlsx(
      workbook([
        ['Имя', 'Телефон'],
        ['Алия Ким', '+77000000001'],
      ]),
    );
    expect(csv).toContain('Имя;Телефон');
    expect(csv).toContain('Алия Ким;+77000000001');
  });

  it('отклоняет формулы до передачи строк в импорт', async () => {
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Имя', 'Телефон'],
      ['Алия Ким', '+77000000001'],
    ]);
    sheet.A2 = { t: 'n', f: '1+1', v: 2 };
    XLSX.utils.book_append_sheet(book, sheet, 'Клиенты');
    const bytes = new Uint8Array(XLSX.write(book, { bookType: 'xlsx', type: 'array' }));
    await expect(parseBeautyCustomersXlsx(bytes)).rejects.toThrow(/формул/i);
  });

  it('отклоняет 501 строку данных, даже если парсер ограничивает чтение', async () => {
    const rows = [['Имя', 'Телефон']];
    for (let index = 0; index < 501; index += 1) rows.push([`Клиент ${index}`, `+7700000${String(index).padStart(4, '0')}`]);
    await expect(parseBeautyCustomersXlsx(workbook(rows))).rejects.toThrow(/500/i);
  });

  it('отклоняет разреженный лист шире 50 столбцов до преобразования в строки', async () => {
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([['Имя']]);
    sheet.XFD1 = { t: 's', v: 'Телефон' };
    sheet['!ref'] = 'A1:XFD2';
    XLSX.utils.book_append_sheet(book, sheet, 'Клиенты');
    const bytes = new Uint8Array(XLSX.write(book, { bookType: 'xlsx', type: 'array' }));
    await expect(parseBeautyCustomersXlsx(bytes)).rejects.toThrow(/50 столбцов/i);
  });

  it('отклоняет файл больше внешнего лимита до открытия ZIP', async () => {
    const bytes = new Uint8Array(100 * 1024 + 1);
    bytes.set([0x50, 0x4b]);
    await expect(parseBeautyCustomersXlsx(bytes)).rejects.toThrow(/100 КБ/i);
  });

  it('отклоняет XLSX с количеством ZIP-записей выше лимита', async () => {
    const book = XLSX.utils.book_new();
    for (let index = 0; index < 110; index += 1) {
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Имя', 'Телефон']]), `Лист ${index}`);
    }
    const bytes = new Uint8Array(XLSX.write(book, { bookType: 'xlsx', type: 'array', compression: true }));
    await expect(parseBeautyCustomersXlsx(bytes)).rejects.toThrow(/слишком много файлов/i);
  });

  it('отклоняет данные, которые не являются XLSX ZIP-контейнером', async () => {
    await expect(parseBeautyCustomersXlsx(new TextEncoder().encode('Имя;Телефон'))).rejects.toThrow(/XLSX/i);
  });

  it('создаёт настоящий XLSX и сохраняет телефон как текст с плюсом', () => {
    const bytes = exportBeautyCustomersXlsx([customer()]);
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
    const book = XLSX.read(bytes, { type: 'array', cellFormula: true });
    const sheet = book.Sheets[book.SheetNames[0]!];
    expect(sheet?.B2).toMatchObject({ t: 's', v: '+77000000001' });
  });
});
