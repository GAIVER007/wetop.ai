/**
 * Сверка смены в ноль: двойная смена 06.10.2026 (plans/double-shift-2026-10-06.md; письмо ментора 03.10.2026:
 * «сверку в ноль делайте по трём спискам: брони, деньги, остатки по ночам; каждое расхождение записывайте в файл
 * с датой и временем»).
 *
 * Источники: таблица смены (второй учёт, его ведёт смена рядом с WETOP), сам WETOP и Channex. Здесь только разбор
 * и сравнение, без сети: чистые функции под тесты. Сбор данных: shift-check-sources.ts, запуск в контейнере API:
 * cli-shift-check.ts, обёртка для сервера: scripts/ops/shift-check.sh.
 *
 * У каждого расхождения есть номер (хеш его содержания). По номеру журнал помнит его между срезами: открытое
 * расхождение второй раз не дописывается, а сошедшееся называется в сводке, чтобы смена закрыла его с причиной.
 */
import { createHash } from 'node:crypto';
import { channex } from '@pms/integrations';

// ── Словарь таблицы ─────────────────────────────────────────────────────────────────────────────────────────

export type ShiftEvent =
  | 'new'
  | 'change'
  | 'cancel'
  | 'noShow'
  | 'checkIn'
  | 'checkOut'
  | 'move'
  | 'payment'
  | 'refund'
  | 'income'
  | 'expense';

/** Событие словом, как его пишет смена в колонке «событие» */
export const EVENT_WORD: Record<ShiftEvent, string> = {
  new: 'новая бронь',
  change: 'изменение',
  cancel: 'отмена',
  noShow: 'незаезд',
  checkIn: 'заезд',
  checkOut: 'выезд',
  move: 'переселение',
  payment: 'оплата',
  refund: 'возврат',
  income: 'поступление',
  expense: 'расход',
};

/** Написания, которые смена может использовать вместо слова из шаблона. Двусмысленных здесь нет намеренно */
const EVENT_ALIASES: Record<string, ShiftEvent> = {
  ...Object.fromEntries(Object.entries(EVENT_WORD).map(([k, v]) => [v, k as ShiftEvent])),
  новая: 'new',
  бронь: 'new',
  бронирование: 'new',
  'новое бронирование': 'new',
  'изменение дат': 'change',
  продление: 'change',
  сокращение: 'change',
  перенос: 'change',
  'отмена брони': 'cancel',
  'no show': 'noShow',
  'no-show': 'noShow',
  noshow: 'noShow',
  заселение: 'checkIn',
  'check-in': 'checkIn',
  выселение: 'checkOut',
  'check-out': 'checkOut',
  пересадка: 'move',
  доплата: 'payment',
  предоплата: 'payment',
  приход: 'income',
  выплата: 'expense',
};

export type PaymentMethod =
  | 'CASH'
  | 'CARD_TERMINAL'
  | 'KASPI'
  | 'HALYK'
  | 'BANK_TRANSFER_PERSON'
  | 'BANK_TRANSFER_LEGAL'
  | 'DEPOSIT'
  | 'CARD_GUARANTEE'
  | 'EXTERNAL';

/** Способы оплаты словами, как на экране «Финансы» стойки (apps/web/src/app/finance/labels.ts) */
export const METHOD_WORD: Record<PaymentMethod, string> = {
  CASH: 'Наличные',
  CARD_TERMINAL: 'Карта (терминал)',
  KASPI: 'Kaspi',
  HALYK: 'Halyk',
  BANK_TRANSFER_PERSON: 'Перевод от физлица',
  BANK_TRANSFER_LEGAL: 'Перевод от юрлица',
  DEPOSIT: 'Депозит',
  CARD_GUARANTEE: 'Гарантия картой',
  EXTERNAL: 'Внешний канал',
};

/**
 * «Перевод» и «безнал» без уточнения не угадываются: в WETOP это два разных способа (физлицо и юрлицо), и молчаливая
 * догадка дала бы ложное расхождение или, хуже, ложное совпадение. Такая строка уходит в ошибки таблицы.
 */
const METHOD_ALIASES: Record<string, PaymentMethod> = {
  ...Object.fromEntries(Object.entries(METHOD_WORD).map(([k, v]) => [norm(v), k as PaymentMethod])),
  нал: 'CASH',
  наличка: 'CASH',
  наличными: 'CASH',
  cash: 'CASH',
  карта: 'CARD_TERMINAL',
  картой: 'CARD_TERMINAL',
  терминал: 'CARD_TERMINAL',
  'карта терминал': 'CARD_TERMINAL',
  каспи: 'KASPI',
  'kaspi qr': 'KASPI',
  'каспи qr': 'KASPI',
  'kaspi перевод': 'KASPI',
  'каспи перевод': 'KASPI',
  халык: 'HALYK',
  'halyk bank': 'HALYK',
  'халык банк': 'HALYK',
  'перевод физлица': 'BANK_TRANSFER_PERSON',
  'перевод юрлица': 'BANK_TRANSFER_LEGAL',
  гарантия: 'CARD_GUARANTEE',
  'предоплата канала': 'EXTERNAL',
};

/** Статус брони WETOP словом (как в списке броней стойки, apps/web/src/lib/hotel-api.ts) */
export const STATUS_WORD: Record<string, string> = {
  TENTATIVE: 'не подтверждена',
  CONFIRMED: 'подтверждена',
  CHECKED_IN: 'проживает',
  CHECKED_OUT: 'выехал',
  CANCELLED: 'отменена',
  NO_SHOW: 'незаезд',
};

/** Каким статусом WETOP должно кончиться событие таблицы. События без статуса (изменение, переселение) не сверяются */
const STATUS_AFTER: Partial<Record<ShiftEvent, string[]>> = {
  new: ['TENTATIVE', 'CONFIRMED'],
  checkIn: ['CHECKED_IN'],
  checkOut: ['CHECKED_OUT'],
  cancel: ['CANCELLED'],
  noShow: ['NO_SHOW'],
};
/** Какое событие привело бронь в этот статус: тогда расхождение статуса уже объяснено недостающей строкой */
const EVENT_BEHIND_STATUS: Record<string, ShiftEvent> = {
  CHECKED_IN: 'checkIn',
  CHECKED_OUT: 'checkOut',
  CANCELLED: 'cancel',
  NO_SHOW: 'noShow',
};

const BOOKING_EVENTS: ReadonlySet<ShiftEvent> = new Set([
  'new',
  'change',
  'cancel',
  'noShow',
  'checkIn',
  'checkOut',
  'move',
]);
const MONEY_EVENTS: ReadonlySet<ShiftEvent> = new Set(['payment', 'refund', 'income', 'expense']);
/** События WETOP, которым обязана соответствовать строка таблицы. Переселение не входит: в журнале WETOP первое
 * назначение ячейки и переселение пишутся одним действием, требовать строку на каждое было бы шумом */
const REQUIRED_IN_TABLE: ReadonlySet<ShiftEvent> = new Set([
  'new',
  'change',
  'cancel',
  'noShow',
  'checkIn',
  'checkOut',
]);

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[()«»"']/g, ' ')
    .replace(/[\s\u00a0\u202f]+/g, ' ')
    .replace(/[.,:;!]+$/g, '')
    .trim();
}

/** Номер брони: без пробелов и в верхнем регистре (у WETOP `YYYYMMDD-XXXXXX`, у Channex `BDC-…`) */
export function bookingNumber(raw: string): string {
  return raw.replace(/[\s\u00a0\u202f]+/g, '').toUpperCase();
}

// ── Значения ячеек ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Сумма в тенге → тиыны. Пробелы, «₸», «тг» и знак не мешают; тиыны через запятую или точку, не больше двух знаков.
 * Разделитель тысяч распознаётся, когда за ним ровно три цифры («12,000», «1.500», «12 000,50»). Остальное: null.
 */
export function parseTenge(raw: string): bigint | null {
  let s = raw.replace(/[\s\u00a0\u202f]/g, '').replace(/₸|тенге|тг\.?|kzt/gi, '');
  if (!s) return null;
  const negative = /^[-−]/.test(s);
  s = s.replace(/^[-−+]/, '');
  let whole: string;
  let frac: string;
  const grouped = /^(\d{1,3})((?:([,.])\d{3})(?:\3\d{3})*)(?:([.,])(\d{1,2}))?$/.exec(s);
  if (grouped && grouped[4] !== grouped[3]) {
    whole = grouped[1]! + grouped[2]!.replace(/[,.]/g, '');
    frac = grouped[5] ?? '';
  } else {
    const simple = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(s);
    if (!simple) return null;
    whole = simple[1]!;
    frac = simple[2] ?? '';
  }
  const minor = BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0'));
  return negative ? -minor : minor;
}

/** Тиыны → «12 000 ₸» или «12 000,50 ₸» (тиыны только когда они есть, как formatMoney стойки) */
export function tenge(minor: bigint): string {
  const sign = minor < 0n ? '−' : '';
  const abs = minor < 0n ? -minor : minor;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const frac = abs % 100n;
  return `${sign}${whole}${frac ? `,${frac.toString().padStart(2, '0')}` : ''} ₸`;
}

const isRealDay = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** Дата ячейки → `YYYY-MM-DD`: «06.10.2026», «6.10.26», «06.10» (год смены), «2026-10-06», «06/10/2026» */
export function parseDay(raw: string, year: number): string | null {
  const s = raw.trim();
  let y: number;
  let m: number;
  let d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const ru = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{2}|\d{4}))?$/.exec(s);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (ru) {
    d = Number(ru[1]);
    m = Number(ru[2]);
    y = ru[3] === undefined ? year : ru[3].length === 2 ? 2000 + Number(ru[3]) : Number(ru[3]);
  } else return null;
  if (!isRealDay(y, m, d)) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Время ячейки → `HH:MM`: «9:05», «09.05», «09:05:30» */
export function parseTime(raw: string): string | null {
  const t = /^(\d{1,2})[:.](\d{2})(?::\d{2})?$/.exec(raw.trim());
  if (!t) return null;
  const h = Number(t[1]);
  const m = Number(t[2]);
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` → `ДД.ММ` для коротких ключей и `ДД.ММ.ГГГГ` для дат */
export const dm = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
export const dmy = (day: string) => `${dm(day)}.${day.slice(0, 4)}`;

// ── Разбор таблицы смены ────────────────────────────────────────────────────────────────────────────────────

export interface TableRow {
  /** Номер строки, как его видит смена в таблице: заголовок первая строка, данные со второй */
  line: number;
  time: string | null;
  event: ShiftEvent;
  booking: string | null;
  arrival: string | null;
  departure: string | null;
  /** Сумма без знака: возврат и расход задаются событием, а не минусом */
  amountMinor: bigint | null;
  method: PaymentMethod | null;
  channel: string | null;
}

export interface TableProblem {
  line: number;
  what: string;
}

type Column =
  'time' | 'event' | 'booking' | 'arrival' | 'departure' | 'amount' | 'method' | 'channel';

const HEADERS: Record<Column, string[]> = {
  time: ['время', 'час'],
  event: ['событие', 'что', 'действие', 'операция'],
  // «номер» без уточнения в гостинице значит комнату, поэтому не принимается
  booking: ['бронь', 'номер брони', '№ брони', 'бронь №'],
  arrival: ['заезд', 'дата заезда'],
  departure: ['выезд', 'дата выезда'],
  amount: ['сумма', 'сумма ₸', 'сумма, ₸', 'сумма тг', 'деньги'],
  method: ['способ', 'способ оплаты'],
  channel: ['канал', 'источник'],
};

/** Разделитель по строке заголовка: копия из Google Таблицы приходит с табуляцией, выгрузка CSV с «,» или «;» */
function delimiterOf(headerLine: string): string {
  const count = (c: string) => headerLine.split(c).length - 1;
  const candidates: Array<[string, number]> = [
    ['\t', count('\t')],
    [';', count(';')],
    [',', count(',')],
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0]![1] > 0 ? candidates[0]![0] : '\t';
}

/** Строки CSV/TSV с кавычками по RFC 4180: поле в кавычках может содержать разделитель и перевод строки */
export function splitRecords(text: string, delimiter: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      out.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    out.push(row);
  }
  return out;
}

/**
 * Таблица смены → строки и ошибки ввода. Колонки ищутся по заголовку (порядок любой, лишние колонки не мешают:
 * «кто», «гость», «комментарий»). Пустые строки пропускаются. Строка с ошибкой в сверку не идёт, а называется:
 * смена исправляет таблицу, иначе сверка в ноль невозможна.
 */
export function parseShiftTable(
  text: string,
  year: number,
): { rows: TableRow[]; problems: TableProblem[] } {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  const records = splitRecords(clean, delimiterOf(firstLine));
  const problems: TableProblem[] = [];
  const rows: TableRow[] = [];
  const headerIndex = records.findIndex((r) => r.some((c) => c.trim() !== ''));
  if (headerIndex < 0) return { rows, problems: [{ line: 1, what: 'таблица пустая' }] };
  const header = records[headerIndex]!.map(norm);
  const col: Partial<Record<Column, number>> = {};
  for (const [name, variants] of Object.entries(HEADERS) as Array<[Column, string[]]>) {
    const i = header.findIndex((h) => variants.map(norm).includes(h));
    if (i >= 0) col[name] = i;
  }
  for (const need of ['event', 'booking'] as const) {
    if (col[need] === undefined)
      problems.push({
        line: headerIndex + 1,
        what: `нет колонки «${HEADERS[need][0]}»: заголовок таблицы должен быть как в шаблоне templates/double-shift-table.csv`,
      });
  }
  if (problems.length) return { rows, problems };

  for (let r = headerIndex + 1; r < records.length; r += 1) {
    const cells = records[r]!;
    if (cells.every((c) => c.trim() === '')) continue;
    const line = r + 1;
    const cell = (c: Column) => (col[c] === undefined ? '' : (cells[col[c]!] ?? '').trim());
    const rowProblems: string[] = [];

    const eventRaw = cell('event');
    const event = EVENT_ALIASES[norm(eventRaw)];
    if (!event) {
      problems.push({
        line,
        what: eventRaw
          ? `не понял событие «${eventRaw}»: пишите одно из ${Object.values(EVENT_WORD).join(', ')}`
          : 'не указано событие',
      });
      continue;
    }

    const bookingRaw = cell('booking');
    const booking = bookingRaw ? bookingNumber(bookingRaw) : null;
    if (!booking && event !== 'income' && event !== 'expense')
      rowProblems.push(`у события «${EVENT_WORD[event]}» нет номера брони`);

    const timeRaw = cell('time');
    const time = timeRaw ? parseTime(timeRaw) : null;
    if (timeRaw && !time) rowProblems.push(`не понял время «${timeRaw}»`);

    const arrivalRaw = cell('arrival');
    const departureRaw = cell('departure');
    const arrival = arrivalRaw ? parseDay(arrivalRaw, year) : null;
    const departure = departureRaw ? parseDay(departureRaw, year) : null;
    if (arrivalRaw && !arrival) rowProblems.push(`не понял дату заезда «${arrivalRaw}»`);
    if (departureRaw && !departure) rowProblems.push(`не понял дату выезда «${departureRaw}»`);
    if (arrival && departure && departure <= arrival)
      rowProblems.push(`выезд ${dmy(departure)} не позже заезда ${dmy(arrival)}`);
    if ((event === 'new' || event === 'change') && !(arrivalRaw && departureRaw))
      rowProblems.push(`у события «${EVENT_WORD[event]}» нужны даты заезда и выезда`);

    let amountMinor: bigint | null = null;
    let method: PaymentMethod | null = null;
    if (MONEY_EVENTS.has(event)) {
      const amountRaw = cell('amount');
      const parsed = amountRaw ? parseTenge(amountRaw) : null;
      if (parsed === null || parsed === 0n)
        rowProblems.push(amountRaw ? `не понял сумму «${amountRaw}»` : 'нет суммы');
      else amountMinor = parsed < 0n ? -parsed : parsed;
      const methodRaw = cell('method');
      method = methodRaw ? (METHOD_ALIASES[norm(methodRaw)] ?? null) : null;
      if (!method)
        rowProblems.push(
          methodRaw
            ? `не понял способ «${methodRaw}»: пишите как в WETOP (${Object.values(METHOD_WORD).join(', ')})`
            : 'нет способа оплаты',
        );
    }
    if (rowProblems.length) {
      problems.push({ line, what: rowProblems.join('; ') });
      continue;
    }
    rows.push({
      line,
      time,
      event,
      booking,
      arrival,
      departure,
      amountMinor,
      method,
      channel: cell('channel') || null,
    });
  }
  return { rows, problems };
}

// ── Расхождения ─────────────────────────────────────────────────────────────────────────────────────────────

export type ListName = 'брони' | 'деньги' | 'остатки' | 'таблица';

export interface Discrepancy {
  list: ListName;
  /** Номер брони, способ оплаты или категория и ночь */
  key: string;
  /** Что в WETOP */
  wetop: string;
  /** С чем сверяли: таблица, Channex, пересчёт кассы, сам WETOP */
  source: string;
  /** Что в источнике */
  inSource: string;
  /** Что не так, словами */
  what: string;
}

const LIST_LETTER: Record<ListName, string> = {
  брони: 'Б',
  деньги: 'Д',
  остатки: 'О',
  таблица: 'Т',
};

/** Номер расхождения: одинаковое содержание даёт одинаковый номер на каждом срезе */
export function discrepancyId(d: Discrepancy): string {
  const hash = createHash('sha1')
    .update([d.list, d.key, d.wetop, d.source, d.inSource, d.what].join('\u001f'))
    .digest('hex')
    .slice(0, 6);
  return `${LIST_LETTER[d.list]}-${hash}`;
}

export function tableProblemsToDiscrepancies(problems: TableProblem[]): Discrepancy[] {
  return problems.map((p) => ({
    list: 'таблица',
    key: `строка ${p.line}`,
    wetop: '',
    source: 'таблица',
    inSource: `строка ${p.line}`,
    what: p.what,
  }));
}

// ── Брони ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface WetopBooking {
  number: string;
  status: string;
  arrival: string;
  departure: string;
  source: string;
  channel: string | null;
  externalId: string | null;
}

export interface WetopEvent {
  number: string;
  event: ShiftEvent;
  /** Время объекта, `YYYY-MM-DD HH:MM` */
  at: string;
}

/** Действия журнала WETOP (AuditLog), которые смена обязана видеть в таблице */
export const AUDIT_EVENTS: Record<string, ShiftEvent> = {
  'reservation.create': 'new',
  'channex.booking.new': 'new',
  'reservation.cancel': 'cancel',
  'channex.booking.cancelled': 'cancel',
  'reservation.noShow': 'noShow',
  'reservation.checkIn': 'checkIn',
  'reservation.checkOut': 'checkOut',
  'reservation.checkOut.withDebt': 'checkOut',
  'reservation.changeDates': 'change',
  'reservation.extend': 'change',
  'channex.booking.modified': 'change',
};

export interface BookingsInput {
  table: TableRow[];
  /** Брони WETOP по номеру: всё, что нашлось по номерам таблицы и событий */
  bookings: ReadonlyMap<string, WetopBooking>;
  /** Номер из таблицы → номер WETOP, когда в таблице записан номер брони в канале */
  aliases: ReadonlyMap<string, string>;
  /** События WETOP за окно смены */
  events: WetopEvent[];
}

const lineList = (rows: TableRow[]) =>
  rows.length === 1 ? `строка ${rows[0]!.line}` : `строки ${rows.map((r) => r.line).join(', ')}`;

/**
 * Брони в обе стороны.
 *  1. Каждое событие WETOP за смену (новая бронь, изменение дат, отмена, незаезд, заезд, выезд) есть в таблице.
 *  2. Каждая бронь таблицы есть в WETOP, и её статус и даты такие, какими их оставила последняя строка таблицы.
 * Расхождение статуса или дат, которое уже объяснено недостающей строкой из п. 1, второй раз не называется: у
 * одной причины одна строка в журнале.
 */
export function reconcileBookings(input: BookingsInput): Discrepancy[] {
  const out: Discrepancy[] = [];
  const resolve = (n: string) => input.aliases.get(n) ?? n;

  const tableByBooking = new Map<string, TableRow[]>();
  const tableHas = new Set<string>();
  for (const r of input.table) {
    if (!r.booking || !BOOKING_EVENTS.has(r.event)) continue;
    const number = resolve(r.booking);
    if (!tableByBooking.has(number)) tableByBooking.set(number, []);
    tableByBooking.get(number)!.push(r);
    tableHas.add(`${number}|${r.event}`);
  }

  const missing = new Set<string>();
  const events = [...input.events].sort((a, b) => a.at.localeCompare(b.at));
  for (const e of events) {
    if (!REQUIRED_IN_TABLE.has(e.event)) continue;
    const k = `${e.number}|${e.event}`;
    if (tableHas.has(k) || missing.has(k)) continue;
    missing.add(k);
    out.push({
      list: 'брони',
      key: e.number,
      wetop: `${EVENT_WORD[e.event]} ${e.at.slice(11, 16)}`,
      source: 'таблица',
      inSource: `нет строки «${EVENT_WORD[e.event]}»`,
      what: 'событие есть в WETOP, в таблице его нет',
    });
  }

  for (const [number, rows] of tableByBooking) {
    const booking = input.bookings.get(number);
    const shown = rows[0]!.booking!;
    if (!booking) {
      out.push({
        list: 'брони',
        key: shown,
        wetop: 'брони нет',
        source: 'таблица',
        inSource: `${[...new Set(rows.map((r) => EVENT_WORD[r.event]))].join(', ')} (${lineList(rows)})`,
        what: 'бронь есть в таблице, в WETOP брони с таким номером нет',
      });
      continue;
    }
    const statusRow = [...rows].reverse().find((r) => STATUS_AFTER[r.event]);
    if (statusRow && !STATUS_AFTER[statusRow.event]!.includes(booking.status)) {
      const behind = EVENT_BEHIND_STATUS[booking.status];
      if (!(behind && missing.has(`${number}|${behind}`)))
        out.push({
          list: 'брони',
          key: number,
          wetop: STATUS_WORD[booking.status] ?? booking.status,
          source: 'таблица',
          inSource: `${EVENT_WORD[statusRow.event]} (строка ${statusRow.line})`,
          what: 'статус брони разный',
        });
    }
    const datesRow = [...rows].reverse().find((r) => r.arrival && r.departure);
    if (
      datesRow &&
      (datesRow.arrival !== booking.arrival || datesRow.departure !== booking.departure) &&
      !missing.has(`${number}|change`)
    )
      out.push({
        list: 'брони',
        key: number,
        wetop: `${dmy(booking.arrival)}–${dmy(booking.departure)}`,
        source: 'таблица',
        inSource: `${dmy(datesRow.arrival!)}–${dmy(datesRow.departure!)} (строка ${datesRow.line})`,
        what: 'даты проживания разные',
      });
  }
  return out;
}

// ── Брони канала: приём ревизий из Channex ─────────────────────────────────────────────────────────────────

/**
 * Ревизия брони в журнале приёма WETOP (`GET /channels/channex/events`). Время уже по часам объекта.
 * Типы ревизий: `booking_new`, `booking_modified`, `booking_cancelled`.
 */
export interface IntakeEvent {
  revisionId: string;
  type: string;
  status: 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
  /** Момент приёма (ISO) и он же по часам объекта `YYYY-MM-DD HH:MM` */
  receivedAt: string;
  receivedLocal: string;
  lastError: string | null;
  uniqueId: string | null;
  otaName: string | null;
  /** Бронь WETOP, связанная с ревизией (externalId = unique_id); null, если брони нет */
  reservationNumber: string | null;
}

/** Ревизия в ленте Channex (`GET /booking_revisions/feed`): Channex считает, что WETOP её ещё не подтвердил */
export interface FeedRevision {
  id: string;
  uniqueId: string;
  status: string;
  insertedAt: string;
  insertedLocal: string;
}

/** Сколько ревизия может ждать подтверждения или обработки, прежде чем это расхождение, а не задержка */
export const INTAKE_STUCK_MS = 10 * 60_000;

/**
 * Брони каналов по правилу самого Channex (best-practices-guide.md, «Get Bookings»): подтверждённая ревизия и есть
 * бронь, сохранённая в PMS, а постоянно выкачивать все брони объекта «на всякий случай» нельзя. Поэтому сверка
 * смотрит не список броней Channex, а приём:
 *  1. в ленте Channex нет ревизий, которые ждут подтверждения дольше INTAKE_STUCK_MS (WETOP их не принял);
 *  2. в журнале приёма WETOP за смену нет упавших и застрявших ревизий, и у каждой обработанной есть бронь
 *     (отмена брони, которой в WETOP нет, значит, раньше не дошла сама бронь);
 *  3. бронь канала, который уже идёт через Channex, не заведена в WETOP за смену руками: канал может прислать её
 *     второй раз, это риск двойной продажи.
 */
export function reconcileChannelIntake(input: {
  /** Ревизии журнала приёма за окно смены */
  events: IntakeEvent[];
  feed: FeedRevision[];
  createdInShift: WetopBooking[];
  /** Каналы, брони которых уже приходили через Channex (имя как в ota_name) */
  channelsViaChannex: string[];
  /** Номера броней WETOP, связанных с ревизиями Channex */
  linkedNumbers: string[];
  now: Date;
}): Discrepancy[] {
  const out: Discrepancy[] = [];
  const age = (iso: string) => input.now.getTime() - Date.parse(iso);
  for (const r of input.feed) {
    if (age(r.insertedAt) <= INTAKE_STUCK_MS) continue;
    out.push({
      list: 'брони',
      key: r.uniqueId,
      wetop: 'ревизия не принята',
      source: 'Channex',
      inSource: `ревизия ${r.status} ждёт подтверждения с ${r.insertedLocal.slice(11, 16)}`,
      what: 'Channex держит ревизию неподтверждённой дольше 10 минут: WETOP её не принял',
    });
  }
  for (const e of input.events) {
    if (!e.type.startsWith('booking_')) continue;
    const key = e.uniqueId ?? e.revisionId;
    const theirs = `${e.type}, ${e.receivedLocal.slice(11, 16)}`;
    if (e.status === 'FAILED')
      out.push({
        list: 'брони',
        key,
        wetop: `ошибка: ${(e.lastError ?? 'не записана').slice(0, 160)}`,
        source: 'Channex',
        inSource: theirs,
        what: 'ревизия из канала не обработана',
      });
    else if (e.status !== 'PROCESSED' && age(e.receivedAt) > INTAKE_STUCK_MS)
      out.push({
        list: 'брони',
        key,
        wetop: `статус ${e.status}`,
        source: 'Channex',
        inSource: theirs,
        what: 'ревизия застряла в обработке дольше 10 минут',
      });
    else if (e.status === 'PROCESSED' && !e.reservationNumber)
      out.push({
        list: 'брони',
        key,
        wetop: 'брони нет',
        source: 'Channex',
        inSource: theirs,
        what:
          e.type === 'booking_cancelled'
            ? 'пришла отмена брони, которой в WETOP нет: раньше не дошла сама бронь'
            : 'ревизия обработана, а брони в WETOP нет',
      });
  }
  const viaChannex = new Set(
    input.channelsViaChannex.map((n) => channex.otaChannelKey(n)).filter(Boolean),
  );
  const linked = new Set(input.linkedNumbers);
  for (const b of input.createdInShift) {
    if (b.source !== 'OTA' || !b.channel || b.status === 'CANCELLED' || linked.has(b.number))
      continue;
    if (!viaChannex.has(channex.otaChannelKey(b.channel))) continue;
    out.push({
      list: 'брони',
      key: b.number,
      wetop: `${b.channel}, ${dmy(b.arrival)}–${dmy(b.departure)}, заведена за смену`,
      source: 'Channex',
      inSource: 'ревизии нет',
      what: 'бронь канала заведена в WETOP руками, а канал идёт через Channex: проверьте, не придёт ли она второй раз',
    });
  }
  return out;
}

// ── Деньги ──────────────────────────────────────────────────────────────────────────────────────────────────

export type OperationKind = 'PAYMENT' | 'REFUND' | 'INCOME' | 'EXPENSE' | 'TRANSFER';

export interface WetopOperation {
  kind: OperationKind;
  status: 'COMPLETED' | 'VOIDED';
  method: string;
  amountMinor: bigint;
  number: string | null;
  /** Время объекта, `YYYY-MM-DD HH:MM` */
  localAt: string;
}

const KIND_OF_EVENT: Partial<Record<ShiftEvent, OperationKind>> = {
  payment: 'PAYMENT',
  refund: 'REFUND',
  income: 'INCOME',
  expense: 'EXPENSE',
};
const EVENT_OF_KIND: Record<OperationKind, ShiftEvent | null> = {
  PAYMENT: 'payment',
  REFUND: 'refund',
  INCOME: 'income',
  EXPENSE: 'expense',
  TRANSFER: null,
};

const methodWord = (m: string) => METHOD_WORD[m as PaymentMethod] ?? m;

export interface MoneyTotals {
  /** Сумма по виду и способу: `PAYMENT|CASH` → тиыны */
  table: Map<string, bigint>;
  wetop: Map<string, bigint>;
  /** Предоплаты каналов, которые WETOP записал сам по броне из Channex: в сверку с таблицей не входят */
  channelPrepaid: bigint;
  voided: number;
  transfers: number;
}

interface MoneyItem {
  kind: OperationKind;
  number: string;
  method: string;
  amount: bigint;
  label: string;
}

/**
 * Деньги: каждая оплата, возврат, поступление и расход таблицы есть в WETOP с той же суммой и тем же способом, и
 * наоборот. Аннулированные операции WETOP не считаются: их как не было. Переводы кассы между способами в таблицу
 * не пишутся. Предоплату канала («Внешний канал») WETOP записывает сам при приёме брони из Channex: такая операция
 * без строки в таблице расхождением не считается, а строка таблицы с ней сверяется как обычно.
 */
export function reconcileMoney(
  table: TableRow[],
  operations: WetopOperation[],
  aliases: ReadonlyMap<string, string> = new Map(),
): { discrepancies: Discrepancy[]; totals: MoneyTotals } {
  const totals: MoneyTotals = {
    table: new Map(),
    wetop: new Map(),
    channelPrepaid: 0n,
    voided: 0,
    transfers: 0,
  };
  const add = (m: Map<string, bigint>, k: string, v: bigint) => m.set(k, (m.get(k) ?? 0n) + v);
  const ours: MoneyItem[] = [];
  const theirs: MoneyItem[] = [];
  for (const r of table) {
    const kind = KIND_OF_EVENT[r.event];
    if (!kind || r.amountMinor === null || !r.method) continue;
    const number =
      kind === 'PAYMENT' || kind === 'REFUND'
        ? r.booking
          ? (aliases.get(r.booking) ?? r.booking)
          : ''
        : '';
    theirs.push({
      kind,
      number,
      method: r.method,
      amount: r.amountMinor,
      label: `${tenge(r.amountMinor)}, ${methodWord(r.method)} (строка ${r.line})`,
    });
    add(totals.table, `${kind}|${r.method}`, r.amountMinor);
  }
  for (const o of operations) {
    if (o.status !== 'COMPLETED') {
      totals.voided += 1;
      continue;
    }
    if (o.kind === 'TRANSFER') {
      totals.transfers += 1;
      continue;
    }
    const amount = o.amountMinor < 0n ? -o.amountMinor : o.amountMinor;
    const number = o.kind === 'PAYMENT' || o.kind === 'REFUND' ? (o.number ?? '') : '';
    ours.push({
      kind: o.kind,
      number,
      method: o.method,
      amount,
      label: `${tenge(amount)}, ${methodWord(o.method)}, ${o.localAt.slice(11, 16)}`,
    });
    add(totals.wetop, `${o.kind}|${o.method}`, amount);
  }

  const used = new Set<MoneyItem>();
  const pairs: Array<[MoneyItem, MoneyItem]> = [];
  const take = (t: MoneyItem, ok: (w: MoneyItem) => boolean) => {
    const w = ours.find((x) => !used.has(x) && x.kind === t.kind && x.number === t.number && ok(x));
    if (w) used.add(w);
    return w;
  };
  const left: MoneyItem[] = [];
  for (const t of theirs) {
    const w = take(t, (x) => x.method === t.method && x.amount === t.amount);
    if (w) pairs.push([t, w]);
    else left.push(t);
  }
  const out: Discrepancy[] = [];
  const keyOf = (i: MoneyItem) =>
    i.number
      ? `${i.number} ${EVENT_WORD[EVENT_OF_KIND[i.kind]!]}`
      : `${EVENT_WORD[EVENT_OF_KIND[i.kind]!]} ${methodWord(i.method)}`;
  const unmatched: MoneyItem[] = [];
  for (const t of left) {
    const sameAmount = take(t, (x) => x.amount === t.amount);
    const w = sameAmount ?? take(t, (x) => x.method === t.method) ?? take(t, () => true);
    if (!w) {
      unmatched.push(t);
      continue;
    }
    out.push({
      list: 'деньги',
      key: keyOf(t),
      wetop: w.label,
      source: 'таблица',
      inSource: t.label,
      what:
        w.amount === t.amount
          ? 'способ оплаты разный'
          : w.method === t.method
            ? 'сумма разная'
            : 'сумма и способ разные',
    });
  }
  for (const t of unmatched)
    out.push({
      list: 'деньги',
      key: keyOf(t),
      wetop: 'операции нет',
      source: 'таблица',
      inSource: t.label,
      what: 'в таблице есть, в WETOP нет',
    });
  for (const w of ours) {
    if (used.has(w)) continue;
    if (w.kind === 'PAYMENT' && w.method === 'EXTERNAL') {
      totals.channelPrepaid += w.amount;
      continue;
    }
    out.push({
      list: 'деньги',
      key: keyOf(w),
      wetop: w.label,
      source: 'таблица',
      inSource: 'строки нет',
      what: 'в WETOP есть, в таблице нет',
    });
  }
  return { discrepancies: out, totals };
}

export interface CashCount {
  /** Время пересчёта по часам объекта */
  localAt: string;
  expectedMinor: bigint;
  countedMinor: bigint;
}

/** Пересчёт наличных в кассе (сверка кассы в WETOP, DATA_MODEL §21.4): насчитанное равно ожидаемому до тиына */
export function reconcileCash(count: CashCount | null): Discrepancy[] {
  if (!count || count.countedMinor === count.expectedMinor) return [];
  return [
    {
      list: 'деньги',
      key: 'касса, Наличные',
      wetop: `по WETOP ${tenge(count.expectedMinor)}`,
      source: 'пересчёт кассы',
      inSource: `насчитано ${tenge(count.countedMinor)}, ${count.localAt.slice(11, 16)}`,
      what:
        count.countedMinor > count.expectedMinor
          ? `в кассе больше, чем по WETOP, на ${tenge(count.countedMinor - count.expectedMinor)}`
          : `в кассе меньше, чем по WETOP, на ${tenge(count.expectedMinor - count.countedMinor)}`,
    },
  ];
}

// ── Остатки по ночам ────────────────────────────────────────────────────────────────────────────────────────

export interface NightCell {
  category: string;
  date: string;
  /** Свободно в WETOP: столько WETOP разрешает продать на эту ночь (`GET /availability`) */
  wetop: number;
  /** Остаток в Channex, то есть то, что видят каналы; null, если в Channex значения нет */
  channex: number | null;
}

export interface BoardNight {
  category: string;
  date: string;
  /** Ячеек категории в эту ночь, занятых, закрытых */
  units: number;
  occupied: number;
  blocked: number;
  /** Проживаний этой категории без ячейки в эту ночь */
  unassigned: number;
}

export interface OutboxState {
  pending: number;
  failed: number;
  oldestPendingAt: string | null;
  ariStopped: boolean;
}

/** Сколько изменение может ждать в очереди к Channex, прежде чем это расхождение, а не задержка */
export const OUTBOX_STALE_MS = 10 * 60_000;

/**
 * Остатки: в каждой клетке «категория × ночь» Channex показывает ровно то, что свободно в WETOP (больше: канал
 * продаст лишнее; меньше: недопродажа). Двойная продажа видна на шахматке: проживаний без ячейки больше, чем
 * свободных ячеек. Очередь к Channex: упавшие изменения и зависшие дольше OUTBOX_STALE_MS тоже расхождение.
 */
export function reconcileNights(
  cells: NightCell[],
  board: BoardNight[],
  outbox: OutboxState | null,
  now: Date,
): Discrepancy[] {
  const out: Discrepancy[] = [];
  for (const c of cells) {
    if (c.channex === c.wetop) continue;
    out.push({
      list: 'остатки',
      key: `${c.category} ${dm(c.date)}`,
      wetop: `свободно ${c.wetop}`,
      source: 'Channex',
      inSource: c.channex === null ? 'значения нет' : `остаток ${c.channex}`,
      what:
        c.channex === null
          ? 'в Channex нет остатка на эту ночь'
          : c.channex > c.wetop
            ? 'канал видит больше мест, чем свободно: продаст лишнее'
            : 'канал видит меньше мест, чем свободно: недопродажа',
    });
  }
  for (const n of board) {
    const free = Math.max(0, n.units - n.occupied - n.blocked);
    if (n.unassigned <= free) continue;
    out.push({
      list: 'остатки',
      key: `${n.category} ${dm(n.date)}`,
      wetop: `ячеек ${n.units}, занято ${n.occupied}, закрыто ${n.blocked}, без ячейки ${n.unassigned}`,
      source: 'шахматка WETOP',
      inSource: `свободных ячеек ${free}`,
      what: `двойная продажа: без ячейки на ${n.unassigned - free} больше, чем свободных ячеек`,
    });
  }
  if (outbox) {
    if (outbox.ariStopped)
      out.push({
        list: 'остатки',
        key: 'очередь Channex',
        wetop: 'исходящие остатки выключены',
        source: 'Channex',
        inSource: 'изменения не уходят',
        what: 'ARI выключен (scripts/ops/ari.sh stop): каналы не узнают об изменениях',
      });
    if (outbox.failed > 0)
      out.push({
        list: 'остатки',
        key: 'очередь Channex',
        wetop: `упало изменений: ${outbox.failed}`,
        source: 'Channex',
        inSource: 'не приняты',
        what: 'изменения остатков не дошли до Channex',
      });
    if (
      outbox.pending > 0 &&
      outbox.oldestPendingAt &&
      now.getTime() - Date.parse(outbox.oldestPendingAt) > OUTBOX_STALE_MS
    )
      out.push({
        list: 'остатки',
        key: 'очередь Channex',
        wetop: `ждут отправки: ${outbox.pending}`,
        source: 'Channex',
        inSource: `самое старое с ${outbox.oldestPendingAt.slice(0, 16).replace('T', ' ')} UTC`,
        what: 'очередь к Channex стоит дольше 10 минут',
      });
  }
  return out;
}

// ── Журнал расхождений ──────────────────────────────────────────────────────────────────────────────────────

export const LOG_COLUMNS = [
  '№',
  'когда (Алматы)',
  'список',
  'ключ',
  'WETOP',
  'источник',
  'в источнике',
  'что не так',
  'статус',
  'причина и исправление',
  'кто разобрал',
] as const;

export const STATUS_OPEN = 'открыто';
export const STATUS_DONE = 'разобрано';
/** Как человек может отметить разобранное в журнале */
const DONE_WORDS = new Set([STATUS_DONE, 'закрыто', 'исправлено', 'решено', 'сошлось']);

const csvField = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
/** Строка журнала: «;», как выгрузки стойки (ADR-113), чтобы файл открывался в Excel по-русски */
export const csvLine = (cells: readonly string[]) => cells.map(csvField).join(';');
/** Заголовок нового журнала: с BOM, чтобы Excel узнал UTF-8 */
export const LOG_HEADER = `\uFEFF${csvLine(LOG_COLUMNS)}\r\n`;

export interface LogEntry {
  id: string;
  status: string;
}

/** Журнал → номера и статусы. Статус «разобрано» пишет человек, всё прочее считается открытым */
export function parseLog(text: string): LogEntry[] {
  const clean = text.replace(/^\uFEFF/, '');
  if (!clean.trim()) return [];
  const records = splitRecords(clean, ';');
  const header = records[0]!.map((h) => h.trim());
  const idAt = header.indexOf('№');
  const statusAt = header.indexOf('статус');
  if (idAt < 0) return [];
  return records
    .slice(1)
    .filter((r) => (r[idAt] ?? '').trim() !== '')
    .map((r) => {
      const status = norm(statusAt < 0 ? '' : (r[statusAt] ?? ''));
      return { id: r[idAt]!.trim(), status: DONE_WORDS.has(status) ? STATUS_DONE : STATUS_OPEN };
    });
}

export interface LogDelta {
  /** Новые и вернувшиеся расхождения: их строки дописываются в журнал */
  fresh: Array<Discrepancy & { id: string; again: boolean }>;
  /** Открыты в журнале и всё ещё не сошлись */
  stillOpen: string[];
  /** Открыты в журнале, а в этом срезе их нет: сошлись, смена закрывает с причиной */
  converged: string[];
}

/**
 * Что дописать в журнал. Открытое расхождение второй раз не пишется, его номер идёт в «ещё не сошлись». Разобранное,
 * которое снова видно, пишется заново: исправление не помогло.
 */
export function logDelta(found: Discrepancy[], log: LogEntry[]): LogDelta {
  const last = new Map<string, string>();
  for (const e of log) last.set(e.id, e.status);
  const fresh: LogDelta['fresh'] = [];
  const stillOpen: string[] = [];
  const seen = new Set<string>();
  for (const d of found) {
    const id = discrepancyId(d);
    if (seen.has(id)) continue;
    seen.add(id);
    const status = last.get(id);
    if (status === undefined) fresh.push({ ...d, id, again: false });
    else if (status === STATUS_DONE) fresh.push({ ...d, id, again: true });
    else stillOpen.push(id);
  }
  const converged = [...last]
    .filter(([id, status]) => status !== STATUS_DONE && !seen.has(id))
    .map(([id]) => id);
  return { fresh, stillOpen, converged };
}

/** Строки журнала для дописывания (CSV) и те же строки для вставки в Google Таблицу (табуляция) */
export function logRows(delta: LogDelta, when: string): { csv: string; tsv: string } {
  const cells = delta.fresh.map((d) => [
    d.id,
    when,
    d.list,
    d.key,
    d.wetop,
    d.source,
    d.inSource,
    d.again ? `снова: ${d.what}` : d.what,
    STATUS_OPEN,
    '',
    '',
  ]);
  return {
    csv: cells.map((c) => `${csvLine(c)}\r\n`).join(''),
    tsv: cells.map((c) => c.map((v) => v.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n'),
  };
}

// ── Срез целиком ────────────────────────────────────────────────────────────────────────────────────────────

/** Список, который не удалось сверить, и почему: такой список не «в ноль», а «не сверено» */
export interface Skipped {
  skipped: string;
}
const isSkipped = (x: unknown): x is Skipped =>
  typeof x === 'object' && x !== null && 'skipped' in x;

export interface ShiftSnapshot {
  /** День смены `YYYY-MM-DD` и окно по часам объекта `HH:MM` */
  date: string;
  from: string;
  to: string;
  /** Когда снят срез, по часам объекта: `YYYY-MM-DD HH:MM` */
  at: string;
  bookings: ReadonlyMap<string, WetopBooking>;
  aliases: ReadonlyMap<string, string>;
  events: WetopEvent[];
  /** Журнал WETOP отдал предел строк, а начало окна в него не попало */
  eventsTruncated: boolean;
  operations: WetopOperation[];
  operationsTruncated: boolean;
  /** Пересчёт наличных за окно; null, если пересчёта не было */
  cash: CashCount | null;
  /** Остатки: клетки против Channex, шахматка (двойные продажи), очередь. Без Channex клеток нет, а причина в
   * channexSkipped: двойные продажи по шахматке при этом всё равно сверяются */
  nights:
    | {
        cells: NightCell[];
        board: BoardNight[];
        outbox: OutboxState | null;
        channexSkipped: string | null;
      }
    | Skipped;
  /** Приём броней каналов: журнал WETOP за окно и лента Channex. Без Channex журнал WETOP всё равно сверяется */
  intake: {
    events: IntakeEvent[];
    feed: FeedRevision[] | null;
    createdInShift: WetopBooking[];
    channelsViaChannex: string[];
    linkedNumbers: string[];
    /** Почему лента Channex не прочитана; null, если прочитана */
    feedSkipped: string | null;
  };
}

export interface ShiftCheck {
  summary: string;
  /** Что дописать в журнал: строки CSV, с заголовком, если журнал был пуст */
  csv: string;
  /** 0: всё сверено и в ноль; 1: есть расхождения; 3: расхождений нет, но сверено не всё */
  exitCode: 0 | 1 | 3;
}

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
};
const diffs = (n: number) => plural(n, 'расхождение', 'расхождения', 'расхождений');
const sumKind = (m: Map<string, bigint>, kind: OperationKind) =>
  [...m].filter(([k]) => k.startsWith(`${kind}|`)).reduce((a, [, v]) => a + v, 0n);

/**
 * Срез: таблица и данные WETOP и Channex → три списка, ошибки таблицы, строки журнала и сводка для смены. Сводка
 * короткая: по строке на список, затем новые расхождения строками для Google Таблицы, затем что ещё открыто и что
 * сошлось с прошлого среза.
 */
export function checkShift(input: {
  table: { rows: TableRow[]; problems: TableProblem[] };
  snapshot: ShiftSnapshot;
  logText: string;
  now: Date;
}): ShiftCheck {
  const s = input.snapshot;
  const rows = input.table.rows;
  const tableDiffs = tableProblemsToDiscrepancies(input.table.problems);
  const bookingDiffs = [
    ...reconcileBookings({
      table: rows,
      bookings: s.bookings,
      aliases: s.aliases,
      events: s.events,
    }),
    ...reconcileChannelIntake({
      events: s.intake.events,
      feed: s.intake.feed ?? [],
      createdInShift: s.intake.createdInShift,
      channelsViaChannex: s.intake.channelsViaChannex,
      linkedNumbers: s.intake.linkedNumbers,
      now: input.now,
    }),
  ];
  const money = reconcileMoney(rows, s.operations, s.aliases);
  const moneyDiffs = [...money.discrepancies, ...reconcileCash(s.cash)];
  const nightDiffs = isSkipped(s.nights)
    ? []
    : reconcileNights(s.nights.cells, s.nights.board, s.nights.outbox, input.now);
  const all = [...bookingDiffs, ...moneyDiffs, ...nightDiffs, ...tableDiffs];

  const log = parseLog(input.logText);
  const delta = logDelta(all, log);
  const when = `${dmy(s.at.slice(0, 10))} ${s.at.slice(11, 16)}`;
  const { csv, tsv } = logRows(delta, when);

  const tableBookings = new Set(
    rows.filter((r) => r.booking && BOOKING_EVENTS.has(r.event)).map((r) => r.booking),
  );
  const verdict = (n: number, skipped: boolean) =>
    n ? diffs(n) : skipped ? 'не сверено' : 'в ноль';

  const bookingNotes = [
    `в таблице ${plural(tableBookings.size, 'бронь', 'брони', 'броней')}`,
    `событий WETOP за окно ${s.events.length}`,
    `ревизий Channex за окно ${s.intake.events.length}`,
    s.intake.feedSkipped
      ? `лента Channex не прочитана: ${s.intake.feedSkipped}`
      : `в ленте Channex неподтверждённых ${s.intake.feed?.length ?? 0}`,
    ...(s.eventsTruncated ? ['журнал WETOP отдал не всё окно: начало смены не проверено'] : []),
  ];
  const t = money.totals;
  const moneyNotes = [
    `оплаты: таблица ${tenge(sumKind(t.table, 'PAYMENT'))}, WETOP ${tenge(sumKind(t.wetop, 'PAYMENT') - t.channelPrepaid)}`,
    `возвраты: ${tenge(sumKind(t.table, 'REFUND'))} и ${tenge(sumKind(t.wetop, 'REFUND'))}`,
    ...(sumKind(t.table, 'INCOME') || sumKind(t.wetop, 'INCOME')
      ? [`поступления: ${tenge(sumKind(t.table, 'INCOME'))} и ${tenge(sumKind(t.wetop, 'INCOME'))}`]
      : []),
    ...(sumKind(t.table, 'EXPENSE') || sumKind(t.wetop, 'EXPENSE')
      ? [`расходы: ${tenge(sumKind(t.table, 'EXPENSE'))} и ${tenge(sumKind(t.wetop, 'EXPENSE'))}`]
      : []),
    ...(t.channelPrepaid
      ? [`предоплаты каналов ${tenge(t.channelPrepaid)} записал WETOP сам`]
      : []),
    s.cash
      ? `пересчёт кассы ${s.cash.localAt.slice(11, 16)}: насчитано ${tenge(s.cash.countedMinor)}, по WETOP ${tenge(s.cash.expectedMinor)}`
      : 'пересчёта кассы за окно ещё не было',
    ...(s.operationsTruncated ? ['лента денег отдала не всё окно'] : []),
  ];
  const nightsSkipped = isSkipped(s.nights) || s.nights.channexSkipped !== null;
  const nightNotes = isSkipped(s.nights)
    ? [s.nights.skipped]
    : [
        s.nights.channexSkipped
          ? `Channex не сверен: ${s.nights.channexSkipped}`
          : `${plural(s.nights.cells.length, 'клетка', 'клетки', 'клеток')} «категория × ночь» против Channex`,
        `шахматка: ${plural(s.nights.board.length, 'клетка', 'клетки', 'клеток')} на двойные продажи`,
        s.nights.outbox
          ? `очередь к Channex: ждут ${s.nights.outbox.pending}, упали ${s.nights.outbox.failed}`
          : 'очередь к Channex не прочитана',
      ];
  const lines: Array<[string, string, string[]]> = [
    [
      'Брони',
      verdict(bookingDiffs.length, s.intake.feedSkipped !== null || s.eventsTruncated),
      bookingNotes,
    ],
    ['Деньги', verdict(moneyDiffs.length, s.operationsTruncated), moneyNotes],
    ['Остатки по ночам', verdict(nightDiffs.length, nightsSkipped), nightNotes],
    [
      'Таблица смены',
      tableDiffs.length ? plural(tableDiffs.length, 'ошибка', 'ошибки', 'ошибок') : 'без ошибок',
      [`строк в сверке ${rows.length}`],
    ],
  ];
  const skippedAny =
    s.intake.feedSkipped !== null || nightsSkipped || s.eventsTruncated || s.operationsTruncated;
  const out: string[] = [
    `Сверка смены ${dmy(s.date)}, окно ${s.from}–${s.to} по Алматы, срез ${when}`,
    '',
    ...lines.map(([name, v, notes]) => `${name.padEnd(17)} ${v.padEnd(16)} ${notes.join('; ')}`),
    '',
  ];
  if (delta.fresh.length) {
    out.push(
      `Новых расхождений ${delta.fresh.length}, дописаны в журнал. Строки для листа «Расхождения» Google Таблицы:`,
      LOG_COLUMNS.join('\t'),
      tsv,
      '',
    );
  } else out.push('Новых расхождений нет.', '');
  if (delta.stillOpen.length)
    out.push(`Ещё не сошлись (открыты в журнале): ${delta.stillOpen.join(', ')}`);
  if (delta.converged.length)
    out.push(
      `Сошлись с прошлого среза, закройте в журнале с причиной: ${delta.converged.join(', ')}`,
    );
  out.push(
    all.length
      ? `ИТОГ: не в ноль, ${diffs(all.length)}, из них новых ${delta.fresh.length}`
      : skippedAny
        ? 'ИТОГ: расхождений нет, но сверено не всё (см. «не сверено» выше)'
        : 'ИТОГ: в ноль по всем трём спискам',
  );
  return {
    summary: out.join('\n'),
    csv: csv ? `${input.logText.trim() ? '' : LOG_HEADER}${csv}` : '',
    exitCode: all.length ? 1 : skippedAny ? 3 : 0,
  };
}
