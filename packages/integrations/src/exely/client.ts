/**
 * Клиент Exely Connect — ТОЛЬКО ЧТЕНИЕ, только на время миграции (ADR-015, AGENTS.md §9).
 * Источник: docs/exely/openapi-spec.json, docs/exely/dev-portal/scenarios/authorization.md,
 * docs/exely/dev-portal/docs/api.md (лимиты: auth 3/с, 15/мин, 300/ч; токен 15 мин; 429 + retry-after).
 * Секреты приходят через конструктор из окружения; в логи и ошибки не попадают.
 */

export interface ExelyClientOptions {
  clientId: string;
  clientSecret: string;
  propertyId: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Повторов на 429/5xx/сетевые ошибки (по умолчанию 3) */
  maxRetries?: number;
}

export class ExelyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ExelyApiError';
  }
}

export interface ExelyRoom {
  id: string;
  name?: string;
  roomTypeId?: string;
  [k: string]: unknown;
}
export interface ExelyReservationSummary {
  number: string;
  [k: string]: unknown;
}
export interface ExelyDailyOccupancy {
  date: string;
  occupancyRate?: number;
  closedRoomCount?: number;
  occupancyRoomCount?: number;
  complimentaryOccupancyRoomCount?: number;
  roomRevenue?: number;
  revenue?: number;
  arrivalCount?: number;
  guestCount?: number;
  [k: string]: unknown;
}
export interface ExelyDailyOccupancyResponse {
  currencyCode?: string;
  propertyRoomCount?: number;
  dailyOccupancies: ExelyDailyOccupancy[];
}
export interface SearchReservationsParams {
  state: 'Active' | 'Cancelled';
  startAffectPeriod?: string;
  endAffectPeriod?: string;
  startModify?: string;
  endModify?: string;
  roomId?: string;
  maxPageSize?: number;
}

const DEFAULT_BASE = 'https://connect.hopenapi.com';
const TOKEN_SAFETY_MS = 60_000;
const MAX_RETRY_AFTER_MS = 60_000;

export class ExelyConnectClient {
  private readonly base: string;
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly maxRetries: number;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly opts: ExelyClientOptions) {
    this.base = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
    this.fetchFn = opts.fetch ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? (() => Date.now());
    this.maxRetries = opts.maxRetries ?? 3;
  }

  /** Токен кэшируется до истечения минус минута: лимит авторизации 15 запросов в минуту. */
  private async getToken(force = false): Promise<string> {
    if (!force && this.token && this.token.expiresAt - TOKEN_SAFETY_MS > this.now())
      return this.token.value;
    const res = await this.fetchFn(`${this.base}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.opts.clientId,
        client_secret: this.opts.clientSecret,
      }).toString(),
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!res.ok || !body.access_token) {
      throw new ExelyApiError(
        `Exely auth failed: HTTP ${res.status} ${body.error ?? ''}`.trim(),
        res.status,
        '/auth/token',
      );
    }
    this.token = {
      value: body.access_token,
      expiresAt: this.now() + (body.expires_in ?? 900) * 1000,
    };
    return body.access_token;
  }

  /** GET с Bearer; один повтор с новым токеном на 401; повторы на 429 (retry-after) и 5xx. */
  private async get<T>(path: string): Promise<T> {
    let refreshed = false;
    let attempt = 0;
    for (;;) {
      const tok = await this.getToken();
      const res = await this.fetchFn(`${this.base}${path}`, {
        headers: { Authorization: `Bearer ${tok}`, Accept: 'application/json' },
      });
      const requestId = res.headers.get('x-request-id') ?? undefined;
      if (res.ok) return (await res.json()) as T;
      if (res.status === 401 && !refreshed) {
        refreshed = true;
        await this.getToken(true);
        continue;
      }
      const retryable = res.status === 429 || res.status === 503 || res.status >= 500;
      if (retryable && attempt < this.maxRetries) {
        attempt += 1;
        const ra = Number(res.headers.get('retry-after') ?? '0');
        const wait =
          ra > 0
            ? Math.min(ra * 1000, MAX_RETRY_AFTER_MS)
            : Math.min(1000 * 2 ** attempt, MAX_RETRY_AFTER_MS);
        await this.sleep(wait);
        continue;
      }
      const text = (await res.text().catch(() => '')).slice(0, 200);
      throw new ExelyApiError(
        `Exely ${path.split('?')[0]}: HTTP ${res.status} ${text}`,
        res.status,
        path,
        requestId,
      );
    }
  }

  private get pms(): string {
    return `/api/pms/v2/properties/${encodeURIComponent(this.opts.propertyId)}`;
  }

  /** PMS API → PropertyRoom: все единицы фонда (постранично). */
  async listRooms(): Promise<ExelyRoom[]> {
    const out: ExelyRoom[] = [];
    let pageToken: string | undefined;
    do {
      const q = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '?maxPageSize=100';
      const page = await this.get<{
        rooms?: ExelyRoom[];
        hasNextPage?: boolean;
        nextPageToken?: string;
      }>(`${this.pms}/rooms${q}`);
      out.push(...(page.rooms ?? []));
      pageToken = page.hasNextPage ? page.nextPageToken : undefined;
    } while (pageToken);
    return out;
  }

  /** PMS API → PropertyReservation.search: итератор по броням; период ≤ 365 дней (ограничение API). */
  async *searchReservations(p: SearchReservationsParams): AsyncGenerator<ExelyReservationSummary> {
    const first = new URLSearchParams({
      state: p.state,
      maxPageSize: String(p.maxPageSize ?? 100),
    });
    if (p.startAffectPeriod) first.set('startAffectPeriodDateTime', p.startAffectPeriod);
    if (p.endAffectPeriod) first.set('endAffectPeriodDateTime', p.endAffectPeriod);
    if (p.startModify) first.set('startModifyDateTime', p.startModify);
    if (p.endModify) first.set('endModifyDateTime', p.endModify);
    if (p.roomId) first.set('roomId', p.roomId);
    let query = first.toString();
    for (;;) {
      const page = await this.get<{
        reservations?: ExelyReservationSummary[];
        hasNextPage?: boolean;
        nextPageToken?: string;
      }>(`${this.pms}/reservations/search?${query}`);
      for (const r of page.reservations ?? []) yield r;
      if (!page.hasNextPage || !page.nextPageToken) return;
      query = new URLSearchParams({ pageToken: page.nextPageToken }).toString();
    }
  }

  /** PMS API → PropertyReservation: детали одной брони (проживания, гости-ID, суммы). */
  async getReservation(number: string): Promise<Record<string, unknown>> {
    const r = await this.get<{ reservation?: Record<string, unknown> }>(
      `${this.pms}/reservations/${encodeURIComponent(number)}`,
    );
    return r.reservation ?? {};
  }

  /** PMS Analytics API: дневная загрузка; диапазон режется на окна ≤ 31 дня (ограничение API). */
  async dailyOccupancy(
    startStayDate: string,
    endStayDate: string,
    otbDate?: string,
  ): Promise<ExelyDailyOccupancyResponse> {
    const out: ExelyDailyOccupancyResponse = { dailyOccupancies: [] };
    for (const [from, to] of chunkDateRange(startStayDate, endStayDate, 31)) {
      const q = new URLSearchParams({ startStayDate: from, endStayDate: to });
      if (otbDate) q.set('otbDate', otbDate);
      const r = await this.get<ExelyDailyOccupancyResponse>(
        `/api/pms-analytics/v1/properties/${encodeURIComponent(this.opts.propertyId)}/daily-occupancy?${q.toString()}`,
      );
      if (out.currencyCode === undefined && r.currencyCode !== undefined)
        out.currencyCode = r.currencyCode;
      if (out.propertyRoomCount === undefined && r.propertyRoomCount !== undefined) {
        out.propertyRoomCount = r.propertyRoomCount;
      }
      out.dailyOccupancies.push(...(r.dailyOccupancies ?? []));
    }
    return out;
  }

  /** Content API: паспорт объекта (категории, тарифы, услуги, политика заезда). */
  async getProperty(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>(
      `/api/content/v1/properties/${encodeURIComponent(this.opts.propertyId)}`,
    );
  }
}

/** Режет включительный диапазон дат YYYY-MM-DD на окна не длиннее maxDays. */
export function chunkDateRange(
  start: string,
  end: string,
  maxDays: number,
): Array<[string, string]> {
  const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const s = toDate(start);
  const e = toDate(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) {
    throw new Error(`chunkDateRange: bad range ${start}..${end}`);
  }
  const out: Array<[string, string]> = [];
  let cur = s;
  while (cur <= e) {
    const winEnd = new Date(cur);
    winEnd.setUTCDate(winEnd.getUTCDate() + maxDays - 1);
    const stop = winEnd < e ? winEnd : e;
    out.push([fmt(cur), fmt(stop)]);
    cur = new Date(stop);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
