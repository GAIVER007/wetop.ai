import { CUSTOMER_CSV_MAX_ROWS } from '@pms/domain';

/**
 * Excel клиентов (решение владельца 20.10.2026) читается в браузере и дальше идёт тем же путём, что CSV:
 * первый лист превращается в CSV-текст для `readCustomerCsv`, сопоставление колонок, проверка строк и надёжный
 * импорт с отменой не меняются. Файл не уходит на сервер целиком, поэтому лимит тот же, что у CSV: 50 000 строк.
 * Формулы не вычисляются: берётся сохранённое в файле значение ячейки. Номера телефонов читаются без
 * экспоненты (`rawNumbers`), иначе 87000001001 мог стать 8.7E+10.
 */
export async function customerXlsxToCsv(bytes: ArrayBuffer): Promise<string> {
  const data = new Uint8Array(bytes);
  if (data.byteLength === 0) throw new Error('Файл пуст');
  if (data[0] !== 0x50 || data[1] !== 0x4b) {
    throw new Error('Файл не является Excel (XLSX). Сохраните его как XLSX или CSV.');
  }
  const XLSX = await import('xlsx');
  let book: import('xlsx').WorkBook;
  try {
    book = XLSX.read(data, {
      type: 'array',
      sheets: 0,
      dense: true,
      sheetRows: CUSTOMER_CSV_MAX_ROWS + 2,
      cellFormula: false,
      cellHTML: false,
      bookVBA: false,
    });
  } catch {
    throw new Error('Не удалось прочитать Excel. Сохраните файл заново как XLSX или CSV.');
  }
  const sheet = book.Sheets[book.SheetNames[0] ?? ''];
  const ref = sheet?.['!fullref'] ?? sheet?.['!ref'];
  if (!sheet || !ref) throw new Error('В Excel нет листа с клиентами');
  const range = XLSX.utils.decode_range(ref);
  const rows = range.e.r - range.s.r;
  if (rows > CUSTOMER_CSV_MAX_ROWS) {
    throw new Error(`За раз не больше ${CUSTOMER_CSV_MAX_ROWS} строк, в файле ${rows}. Разделите файл.`);
  }
  return XLSX.utils.sheet_to_csv(sheet, { FS: ';', RS: '\r\n', blankrows: false, rawNumbers: true });
}
