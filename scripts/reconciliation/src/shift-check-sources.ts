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
  type FeedRevision,
  type IntakeEvent,
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
  /**
   * Лента неподтверждённых ревизий объекта (`GET /booking_revisions/feed`): тот же запрос, что делает приём броней, только
   * без подтверждения. Список всех броней объекта сверка не читает: Channex просит так не делать (best-practices-guide.md)
   */
  feed(propertyId: string): Promise<Array<Omit<FeedRevision, 'insertedLocal'>>>;
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
  let feed: FeedRevision[] | null = null;
  let feedSkipped: string | null = null;
  if ('unavailable' in channex) {
    channexSkipped = channex.unavailable;
    feedSkipped = channex.unavailable;
  } else if (mapping.length === 0) {
    channexSkipped = 'маппинг Channex пуст: категории не связаны';
    feedSkipped = channexSkipped;
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
      feed = (await channex.feed(propertyId)).map((r) => ({
        ...r,
        insertedLocal: localStamp(new Date(r.insertedAt), timeZone),
      }));
    } catch (e) {
      feedSkipped = `лента Channex не прочитана: ${(e as Error).message}`;
    }
  }
  const intake = await intakeEvents(get, params, start, end);

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
    intake: { ...intake, feed, createdInShift, feedSkipped },
  };
}

interface EventsPage {
  total: number;
  rows: Array<{
    externalEventId: string;
    type: string;
    status: IntakeEvent['status'];
    receivedAt: string;
    lastError: string | null;
    uniqueId: string | null;
    otaName: string | null;
    reservationNumber: string | null;
  }>;
}

/** Сколько дней журнала приёма смотреть, чтобы узнать каналы, которые уже идут через Channex */
export const CHANNELS_LOOKBACK_DAYS = 30;

/**
 * Журнал приёма ревизий WETOP: ревизии окна смены, каналы, чьи брони приходили через Channex за CHANNELS_LOOKBACK_DAYS,
 * и номера броней, связанных с ревизиями. Журнал отдаётся страницами от новых к старым, чтение останавливается на первой
 * ревизии старше срока.
 */
async function intakeEvents(
  get: ApiGet,
  params: ShiftParams,
  start: string,
  end: string,
): Promise<{ events: IntakeEvent[]; channelsViaChannex: string[]; linkedNumbers: string[] }> {
  const since = `${plusDays(params.date, -CHANNELS_LOOKBACK_DAYS)} 00:00`;
  const events: IntakeEvent[] = [];
  const channels = new Set<string>();
  const linked = new Set<string>();
  for (let offset = 0; offset < 20 * PAGE; offset += PAGE) {
    const page = await get<EventsPage>(`/channels/channex/events?limit=${PAGE}&offset=${offset}`);
    if (!page || page.rows.length === 0) break;
    let older = false;
    for (const r of page.rows) {
      const receivedLocal = localStamp(new Date(r.receivedAt), params.timeZone);
      if (receivedLocal < since) {
        older = true;
        break;
      }
      if (r.otaName) channels.add(r.otaName);
      if (r.reservationNumber) linked.add(bookingNumber(r.reservationNumber));
      if (receivedLocal >= start && receivedLocal <= end)
        events.push({
          revisionId: r.externalEventId,
          type: r.type,
          status: r.status,
          receivedAt: r.receivedAt,
          receivedLocal,
          lastError: r.lastError,
          uniqueId: r.uniqueId,
          otaName: r.otaName,
          reservationNumber: r.reservationNumber ? bookingNumber(r.reservationNumber) : null,
        });
    }
    if (older || page.rows.length < PAGE) break;
  }
  return { events, channelsViaChannex: [...channels], linkedNumbers: [...linked] };
}
