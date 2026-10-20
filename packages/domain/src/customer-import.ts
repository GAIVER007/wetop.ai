import { customerPhoneKey } from './customers';

export const CUSTOMER_CSV_MAX_ROWS = 50_000;
export const CUSTOMER_CSV_MAX_BYTES = 10 * 1024 * 1024;
export type CustomerCsvMapping = Record<'firstName' | 'lastName' | 'phone', number | null>;
export interface CustomerCsvFile {
  headers: string[];
  records: { cells: string[]; line: number }[];
  mapping: CustomerCsvMapping;
}
export type CustomerCsvStatus = 'ready' | 'warning' | 'duplicate' | 'skipped';
export interface CustomerCsvRow {
  line: number; firstName: string; lastName: string; phone: string;
  phoneNormalized: string | null; status: CustomerCsvStatus; reason: string; duplicateOf?: number;
}

/** Строгий CSV: не исправляем повреждённые кавычки и не теряем исходные номера строк. */
function recordsOf(text: string, delimiter: string): CustomerCsvFile['records'] {
  const records: CustomerCsvFile['records'] = [];
  let cells: string[] = [], field = '', quoted = false, closed = false, line = 1, start = 1;
  const pushField = () => { cells.push(field); field = ''; closed = false;
    if (cells.length > 100) throw new Error('В CSV не больше 100 колонок'); };
  const pushRecord = () => {
    pushField(); records.push({ cells, line: start }); cells = [];
    if (records.length > CUSTOMER_CSV_MAX_ROWS + 1) throw new Error('В CSV не больше 50 000 строк');
  };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') { quoted = false; closed = true; }
      else { field += c; if (c === '\n' || c === '\r' && text[i + 1] !== '\n') line += 1; }
    } else if (c === delimiter) pushField();
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      pushRecord(); line += 1; start = line;
    } else if (c === '"' && !field && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new Error(`Строка ${start}: проверьте кавычки CSV`);
      field += c;
    }
  }
  if (quoted) throw new Error(`Строка ${start}: не закрыты кавычки CSV`);
  if (field || cells.length || closed) pushRecord();
  return records;
}

export function readCustomerCsv(text: string): CustomerCsvFile {
  if (new TextEncoder().encode(text).length > CUSTOMER_CSV_MAX_BYTES) throw new Error('Файл больше 10 МБ');
  const body = text.replace(/^\uFEFF/, '');
  if (!body.trim()) throw new Error('Файл пуст');
  // Разделитель выбираем по первому логическому заголовку, игнорируя символы в кавычках.
  let quoted = false; const counts = new Map([[';', 0], [',', 0], ['\t', 0]]);
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i]!;
    if (c === '"') { if (quoted && body[i + 1] === '"') i += 1; else quoted = !quoted; }
    if (!quoted && (c === '\n' || c === '\r')) break;
    if (!quoted && counts.has(c)) counts.set(c, counts.get(c)! + 1);
  }
  const delimiter = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
  const [header, ...records] = recordsOf(body, delimiter);
  const headers = header!.cells.map((s) => s.trim());
  if (!headers.some(Boolean)) throw new Error('В CSV нет заголовков колонок');
  if (!records.length) throw new Error('В CSV нет строк клиентов');
  const aliases = { firstName: ['имя', 'first name', 'firstname', 'name'], lastName: ['фамилия', 'last name', 'lastname'], phone: ['телефон', 'phone', 'номер телефона', 'мобильный'] };
  const mapping: CustomerCsvMapping = { firstName: null, lastName: null, phone: null };
  for (const key of Object.keys(aliases) as (keyof CustomerCsvMapping)[]) {
    const matches = headers.flatMap((name, i) => aliases[key].includes(name.toLowerCase()) ? [i] : []);
    if (matches.length === 1) mapping[key] = matches[0]!;
  }
  return { headers, records, mapping };
}

export function previewCustomerCsv(file: CustomerCsvFile, mapping: CustomerCsvMapping) {
  const selected = Object.values(mapping).filter((v) => v !== null);
  if (selected.some((v) => !Number.isInteger(v) || v < 0 || v >= file.headers.length)) throw new Error('Проверьте номера колонок');
  if (new Set(selected).size !== selected.length) throw new Error('Колонку нельзя выбрать дважды');
  if (mapping.firstName === null && mapping.phone === null) throw new Error('Выберите колонку имени или телефона');
  const seen = new Map<string, number>();
  const counts: Record<CustomerCsvStatus, number> = { ready: 0, warning: 0, duplicate: 0, skipped: 0 };
  const rows = file.records.map(({ cells, line }): CustomerCsvRow => {
    const get = (key: keyof CustomerCsvMapping) => mapping[key] === null ? '' : (cells[mapping[key]!] ?? '').trim();
    const row: CustomerCsvRow = { line, firstName: get('firstName'), lastName: get('lastName'), phone: get('phone'), phoneNormalized: null, status: 'ready', reason: 'Готова к переносу' };
    row.phoneNormalized = customerPhoneKey(row.phone);
    if (cells.length > file.headers.length) { row.status = 'skipped'; row.reason = 'Число ячеек не совпадает с заголовком'; }
    else if (!row.firstName && !row.phone) { row.status = 'skipped'; row.reason = 'Нет имени и телефона'; }
    else if (row.firstName.length > 100 || row.lastName.length > 100 || row.phone.length > 32) { row.status = 'skipped'; row.reason = 'Слишком длинное имя, фамилия или телефон'; }
    else if (row.phone && !row.phoneNormalized) { row.status = 'skipped'; row.reason = 'Проверьте телефон'; }
    else if (row.phoneNormalized && seen.has(row.phoneNormalized)) { row.status = 'duplicate'; row.duplicateOf = seen.get(row.phoneNormalized)!; row.reason = `Повтор номера из строки ${row.duplicateOf}`; }
    else {
      if (row.phoneNormalized) seen.set(row.phoneNormalized, line);
      if (!row.firstName || !row.phone) { row.status = 'warning'; row.reason = !row.firstName ? 'Имя не указано: при импорте будет «Клиент»' : 'Нет телефона: онлайн-запись недоступна'; }
    }
    counts[row.status] += 1;
    return row;
  });
  return { rows, counts };
}
