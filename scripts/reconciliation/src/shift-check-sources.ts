/**
 * Сбор данных для сверки смены (shift-check.ts): WETOP служебным ключом изнутри контейнера API и Channex ключом из
 * окружения того же контейнера. Только чтение: ни одного POST, ни одного изменения.
 *
 * Сеть подаётся снаружи (`get` и `channex`), поэтому весь путь от ответов API до строк журнала проверяется тестом на
 * подставных ответах (shift-check-sources.test.ts). Имена гостей сюда не попадают: из ответов берутся номера,
 * статусы, даты, суммы и способы.
 */
import {
  AUDIT_EVENTS,
  bookingNumber,
  type BoardNight,
  type CashCount,
  type ChannexBookingRow,
  type ChannexPair,
  type NightCell,
  type OutboxState,
  type ShiftSnapshot,
  type TableRow,
  type WetopBooking,
  type WetopEvent,
  type WetopOperation,
  type OperationKind,
} from './shift-check';

/** GET к API WETOP. null, если 404 (такого нет); любой другой отказ бросает ошибку */
export type ApiGet = <T>(path: string) => Promise<T | null>;

export interface ChannexSource {
  /** `{ room_type_id: { 'YYYY-MM-DD': остаток } }` */
  availability(
    propertyId: string,
    from: string,
    to: string,
  ): Promise<Record<string, Record<string, number>>>;
  /** Брони объекта с выездом от `departureFrom` включительно, в любом статусе */
  bookings(propertyId: string, departureFrom: string): Promise<ChannexBookingRow[]>;
}

export interface ShiftParams {
  date: string;
  from: string;
  to: string;
  now: Date;
  /** Сколько ночей вперёд сверять остатки, считая день смены */
  nights: number;
  timeZone: string;
}

/** Предел журнала WETOP за один запрос (AuditService: не больше 500 строк) */
export const AUDIT_LIMIT = 500;
/** Предел ленты денег за один запрос (FinanceService: MAX_OPERATION_ROWS) */
export const OPERATIONS_LIMIT = 20_000;
const PAGE = 200;

export const plusDays = (day: string, n: number) => {
  const x = new Date(`${day}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Момент → `YYYY-MM-DD HH:MM` по часам объекта */
export function localStamp(at: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

interface DirectoryRow {
  confirmationNumber: string;
  status: string;
  source: string;
  channel: string | null;
  arrivalDate: string;
  departureDate: string;
}
interface DirectoryPage {
  total: number;
  rows: DirectoryRow[];
}
interface Card {
  confirmationNumber: string;
  status: string;
  source: string;
  channel: string | null;
  externalId?: string | null;
  arrivalDate: string;
  departureDate: string;
}
interface AuditRow {
  at: string;
  entityType: string;
  action: string;
  subject: string | null;
}
interface Operations {
  rows: Array<{
    kind: OperationKind;
    status: 'COMPLETED' | 'VOIDED';
    method: string;
    amountMinor: string;
    confirmationNumber: string | null;
    localAt: string;
  }>;
  truncated: boolean;
}
interface Cash {
  reconciliations: Array<{
    method: string;
    localAt: string;
    expectedMinor: string;
    countedMinor: string;
  }>;
}
interface Mapping {
  localAccommodationTypeCode: string | null;
  providerPropertyId: string;
  providerRoomTypeId: string | null;
}
interface Availability {
  byCategory: Record<string, { available: number }>;
}
interface Board {
  byCategory: Record<string, Record<string, { units: number; occupied: number; blocked: number }>>;
  unassigned: Array<{
    categoryCode: string;
    arrivalDate: string;
    departureDate: string;
    status: string;
  }>;
}
interface Outbox {
  pending: number;
  failed: number;
  oldestPendingAt: string | null;
  ariStopped: boolean;
}

const fromDirectory = (r: DirectoryRow): WetopBooking => ({
  number: r.confirmationNumber,
  status: r.status,
  arrival: r.arrivalDate,
  departure: r.departureDate,
  source: r.source,
  channel: r.channel,
  externalId: null,
});
const fromCard = (c: Card): WetopBooking => ({
  number: c.confirmationNumber,
  status: c.status,
  arrival: c.arrivalDate,
  departure: c.departureDate,
  source: c.source,
  channel: c.channel,
  externalId: c.externalId ?? null,
});

/** Все страницы справочника броней по отбору */
async function directory(get: ApiGet, query: Record<string, string>): Promise<WetopBooking[]> {
  const out: WetopBooking[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const q = new URLSearchParams({ ...query, page: String(page), pageSize: String(PAGE) });
    const res = await get<DirectoryPage>(`/hotel/reservations?${q.toString()}`);
    if (!res) break;
    out.push(...res.rows.map(fromDirectory));
    if (res.rows.length < PAGE || out.length >= res.total) break;
  }
  return out;
}

const STAY_ACTIVE = new Set(['TENTATIVE', 'CONFIRMED', 'CHECKED_IN']);

/**
 * Срез данных смены. Порядок: события из журнала WETOP за окно; брони, созданные в день смены; карточки всех броней
 * из таблицы и из событий; номера канала из таблицы через поиск справочника; деньги и пересчёт кассы; остатки и
 * шахматка на `nights` ночей; брони Channex с выездом от дня смены.
 */
export async function gatherShift(
  table: TableRow[],
  params: ShiftParams,
  get: ApiGet,
  channex: ChannexSource | { unavailable: string },
): Promise<ShiftSnapshot> {
  const { date, timeZone } = params;
  const start = `${date} ${params.from}`;
  const end = `${date} ${params.to}`;
  const inWindow = (local: string) => local >= start && local <= end;
  const at = localStamp(params.now, timeZone);

  // События: журнал отдаёт последние строки, окно вырезается здесь
  const audit = (await get<AuditRow[]>(`/audit?entityType=Reservation&limit=${AUDIT_LIMIT}`)) ?? [];
  const rawEvents: WetopEvent[] = [];
  for (const row of audit) {
    const event = AUDIT_EVENTS[row.action];
    if (!event || !row.subject) continue;
    const local = localStamp(new Date(row.at), timeZone);
    if (inWindow(local)) rawEvents.push({ number: bookingNumber(row.subject), event, at: local });
  }
  const oldest = audit.length ? localStamp(new Date(audit[audit.length - 1]!.at), timeZone) : null;
  const eventsTruncated = audit.length >= AUDIT_LIMIT && oldest !== null && oldest > start;

  const bookings = new Map<string, WetopBooking>();
  const createdInShift = await directory(get, { date: 'created', from: date, to: date });
  for (const b of createdInShift) bookings.set(b.number, b);

  // Карточка по номеру: точное совпадение, без периода; у неё есть номер брони в канале
  const card = async (n: string) => {
    const c = await get<Card>(`/reservations/${encodeURIComponent(n)}`);
    if (c) bookings.set(c.confirmationNumber, fromCard(c));
    return c ? fromCard(c) : null;
  };
  const tableNumbers = [...new Set(table.flatMap((r) => (r.booking ? [r.booking] : [])))];
  const aliases = new Map<string, string>();
  for (const n of tableNumbers) {
    if (bookings.has(n) || (await card(n))) continue;
    // Номер брони в канале: справочник ищет его в externalId (ADR-071) за год вокруг дня смены
    const rows = table.filter((r) => r.booking === n);
    const dated = rows.find((r) => r.arrival && r.departure);
    const found = await get<DirectoryPage>(
      `/hotel/reservations?${new URLSearchParams({
        q: n,
        from: dated?.arrival ?? plusDays(date, -183),
        to: dated?.departure ?? plusDays(date, 182),
        pageSize: '5',
      }).toString()}`,
    );
    if (found && found.rows.length === 1) {
      const b = fromDirectory(found.rows[0]!);
      bookings.set(b.number, b);
      aliases.set(n, b.number);
    }
  }
  // События по броням, которых у объекта нет, выкидываются: служебный ключ видит журнал всех организаций
  const events: WetopEvent[] = [];
  for (const e of rawEvents) {
    if (bookings.has(e.number) || (await card(e.number))) events.push(e);
  }

  const ops = await get<Operations>(
    `/finance/operations?from=${date}&to=${date}&limit=${OPERATIONS_LIMIT}`,
  );
  const operations: WetopOperation[] = (ops?.rows ?? [])
    .filter((o) => inWindow(o.localAt.slice(0, 16)))
    .map((o) => ({
      kind: o.kind,
      status: o.status,
      method: o.method,
      amountMinor: BigInt(o.amountMinor),
      number: o.confirmationNumber ? bookingNumber(o.confirmationNumber) : null,
      localAt: o.localAt.slice(0, 16),
    }));
  const cashRows = (await get<Cash>('/finance/cash'))?.reconciliations ?? [];
  const cashRow = cashRows
    .filter((c) => c.method === 'CASH' && inWindow(c.localAt.slice(0, 16)))
    .sort((a, b) => b.localAt.localeCompare(a.localAt))[0];
  const cash: CashCount | null = cashRow
    ? {
        localAt: cashRow.localAt.slice(0, 16),
        expectedMinor: BigInt(cashRow.expectedMinor),
        countedMinor: BigInt(cashRow.countedMinor),
      }
    : null;

  // Остатки: шахматка на окно ночей (двойные продажи), затем клетки против Channex
  const last = plusDays(date, params.nights - 1);
  const boardRes = await get<Board>(`/chessboard?from=${date}&to=${last}`);
  const board: BoardNight[] = [];
  for (const [day, byCode] of Object.entries(boardRes?.byCategory ?? {})) {
    for (const [category, c] of Object.entries(byCode)) {
      const unassigned = (boardRes?.unassigned ?? []).filter(
        (u) =>
          u.categoryCode === category &&
          u.arrivalDate <= day &&
          day < u.departureDate &&
          STAY_ACTIVE.has(u.status),
      ).length;
      board.push({
        category,
        date: day,
        units: c.units,
        occupied: c.occupied,
        blocked: c.blocked,
        unassigned,
      });
    }
  }
  const outbox = await get<Outbox>('/channels/channex/outbox');
  const outboxState: OutboxState | null = outbox
    ? {
        pending: outbox.pending,
        failed: outbox.failed,
        oldestPendingAt: outbox.oldestPendingAt,
        ariStopped: outbox.ariStopped,
      }
    : null;

  const mapping = ((await get<Mapping[]>('/channels/channex/mapping')) ?? []).filter(
    (m) => m.providerRoomTypeId && m.localAccommodationTypeCode,
  );
  let channexSkipped: string | null = null;
  let cells: NightCell[] = [];
  let channexPart: ShiftSnapshot['channex'];
  if ('unavailable' in channex) {
    channexSkipped = channex.unavailable;
    channexPart = { skipped: channex.unavailable };
  } else if (mapping.length === 0) {
    channexSkipped = 'маппинг Channex пуст: категории не связаны';
    channexPart = { skipped: channexSkipped };
  } else {
    const propertyId = mapping[0]!.providerPropertyId;
    try {
      const theirs = await channex.availability(propertyId, date, last);
      for (let i = 0; i < params.nights; i += 1) {
        const day = plusDays(date, i);
        const ours = await get<Availability>(
          `/availability?arrival=${day}&departure=${plusDays(day, 1)}`,
        );
        for (const m of mapping) {
          const code = m.localAccommodationTypeCode!;
          cells.push({
            category: code,
            date: day,
            wetop: ours?.byCategory[code]?.available ?? 0,
            channex: theirs[m.providerRoomTypeId!]?.[day] ?? null,
          });
        }
      }
    } catch (e) {
      cells = [];
      channexSkipped = `остатки Channex не прочитаны: ${(e as Error).message}`;
    }
    try {
      channexPart = {
        pairs: await pairChannex(await channex.bookings(propertyId, date), bookings, get, date),
        createdInShift,
      };
    } catch (e) {
      channexPart = { skipped: `брони Channex не прочитаны: ${(e as Error).message}` };
    }
  }

  return {
    date,
    from: params.from,
    to: params.to,
    at,
    bookings,
    aliases,
    events,
    eventsTruncated,
    operations,
    operationsTruncated: ops?.truncated ?? false,
    cash,
    nights: { cells, board, outbox: outboxState, channexSkipped },
    channex: channexPart,
  };
}

/**
 * Бронь Channex → бронь WETOP, тем же порядком, что приём ревизий (inbound.service.ts): по `unique_id` (номер брони,
 * которую WETOP принял из Channex), иначе по номеру брони в канале в externalId (бронь, заведённая руками до
 * переключения канала). Справочник отдаёт OTA-брони с выездом от дня смены пачкой; остальное ищется по одной.
 */
async function pairChannex(
  rows: ChannexBookingRow[],
  known: Map<string, WetopBooking>,
  get: ApiGet,
  date: string,
): Promise<ChannexPair[]> {
  const ota = await directory(get, {
    source: 'OTA',
    date: 'departure',
    from: date,
    to: plusDays(date, 365),
  });
  const byNumber = new Map<string, WetopBooking>([...known]);
  for (const b of ota) if (!byNumber.has(b.number)) byNumber.set(b.number, b);
  const pairs: ChannexPair[] = [];
  for (const c of rows) {
    let w = byNumber.get(bookingNumber(c.uniqueId)) ?? null;
    if (!w) {
      const card = await get<Card>(`/reservations/${encodeURIComponent(c.uniqueId)}`);
      if (card) w = fromCard(card);
    }
    for (const q of [c.otaCode, c.uniqueId]) {
      if (w || !q) continue;
      const found = await get<DirectoryPage>(
        `/hotel/reservations?${new URLSearchParams({ q, from: c.arrival, to: c.departure, pageSize: '5' }).toString()}`,
      );
      if (found && found.rows.length === 1) w = fromDirectory(found.rows[0]!);
    }
    pairs.push({ channex: c, wetop: w });
  }
  return pairs;
}
