import 'server-only';
import { Buffer } from 'node:buffer';
import * as yauzl from 'yauzl';
import * as XLSX from 'xlsx';
import type { BeautyCustomerRow } from '../../lib/api';
import { formatMoney } from '../../lib/money';

const MAX_FILE_BYTES = 100 * 1024;
const MAX_ENTRIES = 100;
const MAX_ENTRY_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_DATA_ROWS = 500;

export class BeautyCustomerXlsxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BeautyCustomerXlsxError';
  }
}

const invalid = (message: string): BeautyCustomerXlsxError => new BeautyCustomerXlsxError(message);

async function validateXlsxContainer(bytes: Uint8Array): Promise<void> {
  if (bytes.byteLength === 0) throw invalid('Выберите XLSX-файл');
  if (bytes.byteLength > MAX_FILE_BYTES) throw invalid('Файл должен быть не больше 100 КБ');
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw invalid('Файл не является XLSX');

  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(
      Buffer.from(bytes),
      { lazyEntries: true, validateEntrySizes: true, decodeStrings: true },
      (openError, zip) => {
        if (openError || !zip) {
          reject(invalid('Файл не является корректным XLSX'));
          return;
        }
        let settled = false;
        let entries = 0;
        let declaredTotal = 0;
        let actualTotal = 0;
        let hasWorkbook = false;
        let contentTypes = '';
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          zip.close();
          if (error) reject(error);
          else resolve();
        };
        zip.on('error', () => finish(invalid('Файл не является корректным XLSX')));
        zip.on('end', () => {
          const regularXlsx = contentTypes.includes(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
          );
          const strictXlsx = contentTypes.includes('application/vnd.ms-excel.sheet.main+xml');
          if (!hasWorkbook || (!regularXlsx && !strictXlsx)) {
            finish(invalid('ZIP-файл не является XLSX-книгой'));
            return;
          }
          finish();
        });
        zip.on('entry', (entry) => {
          entries += 1;
          if (entries > MAX_ENTRIES) return finish(invalid('В XLSX слишком много файлов'));
          if ((entry.generalPurposeBitFlag & 0x1) !== 0) {
            return finish(invalid('Зашифрованные XLSX-файлы не поддерживаются'));
          }
          if (entry.fileName.includes('\\') || entry.fileName.split('/').includes('..')) {
            return finish(invalid('XLSX содержит недопустимый путь'));
          }
          if (entry.uncompressedSize > MAX_ENTRY_BYTES) {
            return finish(invalid('Один из файлов XLSX слишком большой'));
          }
          declaredTotal += entry.uncompressedSize;
          if (declaredTotal > MAX_TOTAL_BYTES) return finish(invalid('Распакованный XLSX слишком большой'));
          if (entry.fileName === 'xl/workbook.xml') hasWorkbook = true;

          zip.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) return finish(invalid('Не удалось прочитать XLSX'));
            let entryBytes = 0;
            const contentChunks: Buffer[] = [];
            stream.on('data', (chunk: Buffer) => {
              entryBytes += chunk.byteLength;
              actualTotal += chunk.byteLength;
              if (entry.fileName === '[Content_Types].xml') contentChunks.push(chunk);
              if (entryBytes > MAX_ENTRY_BYTES || actualTotal > MAX_TOTAL_BYTES) {
                stream.destroy(invalid('Распакованный XLSX слишком большой'));
              }
            });
            stream.on('error', () => finish(invalid('Не удалось безопасно прочитать XLSX')));
            stream.on('end', () => {
              if (entry.fileName === '[Content_Types].xml') {
                contentTypes = Buffer.concat(contentChunks).toString('utf8');
              }
              if (!settled) zip.readEntry();
            });
          });
        });
        zip.readEntry();
      },
    );
  });
}

const csvCell = (value: string) =>
  /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

function denseCells(sheet: XLSX.WorkSheet): XLSX.CellObject[] {
  const data = (sheet as XLSX.WorkSheet & { '!data'?: Array<Array<XLSX.CellObject | undefined>> })['!data'];
  const rows = data ?? (sheet as unknown as Array<Array<XLSX.CellObject | undefined>>);
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => (Array.isArray(row) ? row.filter(Boolean) : [])) as XLSX.CellObject[];
  }
  return Object.entries(sheet)
    .filter(([key]) => !key.startsWith('!'))
    .map(([, cell]) => cell as XLSX.CellObject);
}

export async function parseBeautyCustomersXlsx(bytes: Uint8Array): Promise<string> {
  await validateXlsxContainer(bytes);
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(bytes, {
      type: 'array',
      sheets: 0,
      dense: true,
      sheetRows: MAX_DATA_ROWS + 2,
      cellFormula: true,
      cellHTML: false,
      bookVBA: false,
    });
  } catch {
    throw invalid('Не удалось прочитать XLSX');
  }
  const sheetName = book.SheetNames[0];
  const sheet = sheetName ? book.Sheets[sheetName] : undefined;
  if (!sheet) throw invalid('В XLSX нет листа с клиентами');
  const fullRef = sheet['!fullref'] ?? sheet['!ref'];
  if (!fullRef) throw invalid('В XLSX нет данных');
  const range = XLSX.utils.decode_range(fullRef);
  const dataRows = range.e.r - range.s.r;
  const columns = range.e.c - range.s.c + 1;
  if (columns > 50) throw invalid(`В XLSX должно быть не больше 50 столбцов, в файле ${columns}`);
  if (dataRows > MAX_DATA_ROWS) {
    throw invalid(`За раз не больше ${MAX_DATA_ROWS} строк, в файле ${dataRows}`);
  }
  if (denseCells(sheet).some((cell) => typeof cell.f === 'string' && cell.f.length > 0)) {
    throw invalid('XLSX с формулами не поддерживается, замените формулы значениями');
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
  const header = rows[0]?.map((cell) => String(cell).trim().toLocaleLowerCase('ru')) ?? [];
  const nameAt = header.indexOf('имя');
  const phoneAt = header.indexOf('телефон');
  if (nameAt < 0) throw invalid('В файле нет колонки «Имя»');
  if (phoneAt < 0) throw invalid('В файле нет колонки «Телефон»');
  const body = rows.slice(1).map((row) => [String(row[nameAt] ?? '').trim(), String(row[phoneAt] ?? '').trim()]);
  return [['Имя', 'Телефон'], ...body]
    .map((row) => row.map(csvCell).join(';'))
    .join('\r\n');
}

export function exportBeautyCustomersXlsx(rows: BeautyCustomerRow[]): Uint8Array {
  const values = [
    ['Имя', 'Телефон', 'Последний визит', 'Всего визитов', 'Средний чек', 'Статус', 'VIP', 'День рождения'],
    ...rows.map((row) => [
      [row.firstName, row.lastName].filter(Boolean).join(' '),
      row.phone ?? '',
      row.lastVisitLocalDate ?? '',
      row.visits,
      row.avgCheckMinor ? formatMoney(row.avgCheckMinor, row.avgCheckCurrency ?? 'KZT') : '',
      row.status === 'ACTIVE' ? 'Активен' : 'В архиве',
      row.isVip ? 'Да' : 'Нет',
      row.birthDate ?? '',
    ]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(values, { cellDates: false });
  sheet['!cols'] = [
    { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 14 },
    { wch: 18 }, { wch: 14 }, { wch: 8 }, { wch: 16 },
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Клиенты');
  return new Uint8Array(XLSX.write(book, { bookType: 'xlsx', type: 'array', compression: true }));
}
