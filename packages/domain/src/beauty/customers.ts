import { splitRecords, delimiterOf } from '../marketing/expense-import';
import { normalizePhone } from '../web-booking/request';

export const BEAUTY_CUSTOMER_IMPORT_MAX_ROWS = 500;

export class BeautyCustomerImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BeautyCustomerImportError';
  }
}

export interface BeautyCustomerInput {
  firstName: string;
  lastName: string | null;
  fullName: string;
  phone: string;
}

export interface ImportedBeautyCustomer {
  line: number;
  name: string;
  phone: string;
}

const cleanName = (raw: unknown, label: string, max: number): string => {
  const value = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (!value) throw new BeautyCustomerImportError(`${label}: обязательное поле`);
  if (value.length > max) throw new BeautyCustomerImportError(`${label}: не больше ${max} символов`);
  return value;
};

export function normalizeBeautyCustomerPhone(raw: unknown): string {
  const phone = normalizePhone(raw);
  if (!phone) throw new BeautyCustomerImportError('Телефон: укажите от 10 до 15 цифр');
  return phone;
}

export function parseBeautyCustomerInput(raw: unknown): BeautyCustomerInput {
  if (!raw || typeof raw !== 'object') throw new BeautyCustomerImportError('Заполните данные клиента');
  const input = raw as Record<string, unknown>;
  const phone = normalizeBeautyCustomerPhone(input.phone);
  if (typeof input.name === 'string') {
    const fullName = cleanName(input.name, 'Имя', 100);
    return { firstName: fullName, lastName: null, fullName, phone };
  }
  const firstName = cleanName(input.firstName, 'Имя', 100);
  const lastName = typeof input.lastName === 'string' && input.lastName.trim()
    ? cleanName(input.lastName, 'Фамилия', 100)
    : null;
  return {
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    phone,
  };
}

export function parseBeautyCustomersCsv(text: string): ImportedBeautyCustomer[] {
  if (typeof text !== 'string') throw new BeautyCustomerImportError('Выберите CSV-файл');
  const body = text.replace(/^\uFEFF/, '');
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  const records = splitRecords(body, delimiterOf(firstLine));
  const [header = [], ...rest] = records;
  const names = header.map((cell) => cell.trim().toLowerCase());
  const nameAt = names.indexOf('имя');
  const phoneAt = names.indexOf('телефон');
  if (nameAt < 0) throw new BeautyCustomerImportError('В файле нет колонки «Имя»');
  if (phoneAt < 0) throw new BeautyCustomerImportError('В файле нет колонки «Телефон»');
  const lines = rest
    .map((cells, index) => ({ cells, line: index + 2 }))
    .filter(({ cells }) => cells.some((cell) => cell.trim() !== ''));
  if (lines.length === 0) throw new BeautyCustomerImportError('В файле нет ни одного клиента');
  if (lines.length > BEAUTY_CUSTOMER_IMPORT_MAX_ROWS) {
    throw new BeautyCustomerImportError(
      `За раз не больше ${BEAUTY_CUSTOMER_IMPORT_MAX_ROWS} строк, в файле ${lines.length}`,
    );
  }
  const rows: ImportedBeautyCustomer[] = [];
  const errors: string[] = [];
  for (const { cells, line } of lines) {
    try {
      const parsed = parseBeautyCustomerInput({
        name: cells[nameAt] ?? '',
        phone: cells[phoneAt] ?? '',
      });
      rows.push({ line, name: parsed.fullName, phone: parsed.phone });
    } catch (error) {
      if (!(error instanceof BeautyCustomerImportError)) throw error;
      errors.push(`Строка ${line}: ${error.message}`);
    }
  }
  if (errors.length > 0) {
    const shown = errors.slice(0, 10);
    if (errors.length > 10) shown.push(`и ещё ${errors.length - 10} строк с ошибками`);
    throw new BeautyCustomerImportError(`Файл не загружен, ничего не записано:\n${shown.join('\n')}`);
  }
  return rows;
}
