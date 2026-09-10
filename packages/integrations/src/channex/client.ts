/**
 * Клиент Channex API v1 — единственное место, где живут vendor-специфика и ID Channex (ADR-004).
 * Источники (docs/channex/site/api-v.1-documentation): api-reference.md (JSON:API, `user-api-key`,
 * ошибки `errors.code/title/details`, пагинация `pagination[page|limit]`, max limit 100),
 * rate-limits.md (429 → пауза 1 мин, экспоненциальный backoff; 10 запросов/мин на ARI-эндпоинт),
 * hotels-collection.md, room-types-collection.md, rate-plans-collection.md, ari.md.
 * Ключ приходит через конструктор из окружения и в ошибки/логи не попадает.
 */

export interface ChannexClientOptions {
  apiKey: string;
  /** По умолчанию staging (sandbox); production только после Gate 9 (CUTOVER.md) */
  baseUrl?: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Повторов на 429/5xx/сетевые ошибки (по умолчанию 3) */
  maxRetries?: number;
}

export class ChannexApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ChannexApiError';
  }
}

/** JSON:API-объект Channex: `{ type, id, attributes, relationships? }` */
export interface ChannexResource<A = Record<string, unknown>> {
  type: string;
  id: string;
  attributes: A;
  relationships?: Record<
    string,
    { data: { type: string; id: string } | Array<{ type: string; id: string }> | null }
  >;
}
interface ListResponse<A> {
  data: ChannexResource<A>[];
  meta?: { limit?: number; page?: number; total?: number };
}
interface OneResponse<A> {
  data: ChannexResource<A>;
}

export interface ChannexPropertyAttributes {
  title: string;
  currency: string;
  email?: string;
  phone?: string;
  zip_code?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
  property_type?: string;
  group_id?: string;
  settings?: Record<string, unknown>;
  content?: Record<string, unknown>;
  is_active?: boolean;
  [k: string]: unknown;
}
export interface ChannexRoomTypeAttributes {
  property_id: string;
  title: string;
  count_of_rooms: number;
  occ_adults: number;
  occ_children: number;
  occ_infants: number;
  default_occupancy: number;
  /** `room` | `dorm` (room-types-collection.md → Fields) */
  room_kind?: 'room' | 'dorm';
  /** Коек в одной физической комнате; только для dorm */
  capacity?: number | null;
  facilities?: string[];
  content?: Record<string, unknown>;
}
export interface ChannexOccupancyOption {
  occupancy: number;
  is_primary: boolean;
  rate?: number | string;
  derived_option?: Record<string, unknown>;
}
export interface ChannexRatePlanAttributes {
  title: string;
  property_id: string;
  room_type_id: string;
  options: ChannexOccupancyOption[];
  currency?: string;
  sell_mode?: 'per_room' | 'per_person';
  rate_mode?: 'manual' | 'derived' | 'auto' | 'cascade';
  parent_rate_plan_id?: string | null;
  tax_set_id?: string | null;
}
/** Одно изменение цен/ограничений (ari.md → Update Rate & Restrictions → Fields). */
export interface ChannexRestrictionValue {
  property_id: string;
  rate_plan_id: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  days?: Array<'mo' | 'tu' | 'we' | 'th' | 'fr' | 'sa' | 'su'>;
  /** Integer в минимальных единицах валюты (20000 = 200.00) или строка "200.00" */
  rate?: number | string;
  rates?: Array<{ occupancy: number; rate: number | string }>;
  min_stay_arrival?: number;
  min_stay_through?: number;
  min_stay?: number;
  max_stay?: number;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  stop_sell?: boolean;
}
/** Одно изменение доступности (ari.md → Update Availability → Fields). */
export interface ChannexAvailabilityValue {
  property_id: string;
  room_type_id: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  availability: number;
}
/** Ревизия брони (bookings-collection.md → Booking Revision). `guarantee` — данные карты: НЕ хранить (SECURITY.md). */
export interface ChannexBookingRoom {
  checkin_date: string;
  checkout_date: string;
  rate_plan_id: string | null;
  room_type_id: string | null;
  occupancy: { adults: number; children: number; infants: number; ages?: number[] };
  guests?: Array<{ name?: string | null; surname?: string | null }>;
  amount: string;
  days?: Record<string, string>;
  ota_unique_id?: string | null;
  meta?: Record<string, unknown>;
  [k: string]: unknown;
}
export interface ChannexBookingRevisionAttributes {
  id: string;
  property_id: string;
  booking_id: string;
  unique_id: string;
  system_id?: string | null;
  ota_reservation_code: string;
  ota_name: string;
  status: 'new' | 'modified' | 'cancelled';
  rooms: ChannexBookingRoom[];
  services?: unknown[];
  guarantee?: unknown;
  customer?: {
    name?: string | null;
    surname?: string | null;
    mail?: string | null;
    phone?: string | null;
    country?: string | null;
    language?: string | null;
    [k: string]: unknown;
  } | null;
  occupancy: { adults: number; children: number; infants: number };
  arrival_date: string;
  departure_date: string;
  arrival_hour?: string | null;
  amount: string;
  currency: string;
  notes?: string | null;
  payment_collect?: 'property' | 'ota' | null;
  payment_type?: 'credit_card' | 'bank_transfer' | null;
  inserted_at: string;
  [k: string]: unknown;
}

export interface ChannexTaskResponse {
  data: Array<{ id: string; type: string }>;
  meta?: { message?: string; warnings?: unknown[] };
}

export const CHANNEX_STAGING_URL = 'https://staging.channex.io/api/v1';
const RATE_LIMIT_PAUSE_MS = 60_000; // rate-limits.md: «pause updates for the property for 1 minute»
const MAX_BACKOFF_MS = 60_000;
const PAGE_LIMIT = 100;

/** Webhook (webhook-collection.md): чтение — data.attributes */
export interface ChannexWebhookAttributes {
  callback_url: string;
  /** '*' | 'booking' | 'booking_new;booking_modification;…' | 'ari' */
  event_mask: string;
  request_params: Record<string, string> | null;
  headers: Record<string, string> | null;
  is_active: boolean;
  send_data: boolean;
  protected: boolean;
  is_global: boolean;
}
/** Webhook: запись — { webhook: … }; property_id null только для глобального */
export interface ChannexWebhookInput {
  callback_url: string;
  event_mask: string;
  property_id: string | null;
  request_params?: Record<string, string> | null;
  headers?: Record<string, string> | null;
  is_active?: boolean;
  send_data?: boolean;
  is_global?: boolean;
}
export interface ChannexWebhookTestResult {
  status_code: number;
  body: string;
}

export class ChannexClient {
  private readonly base: string;
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetries: number;

  constructor(private readonly opts: ChannexClientOptions) {
    this.base = (opts.baseUrl ?? CHANNEX_STAGING_URL).replace(/\/$/, '');
    this.fetchFn = opts.fetch ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.maxRetries = opts.maxRetries ?? 3;
  }

  /** Все запросы: ключ в `user-api-key`; 429 → пауза (retry-after или 1 минута); 5xx/сеть → backoff. */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    let attempt = 0;
    for (;;) {
      let res: Response;
      try {
        res = await this.fetchFn(`${this.base}${path}`, {
          method,
          headers: {
            'user-api-key': this.opts.apiKey,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch (e) {
        if (attempt < this.maxRetries) {
          attempt += 1;
          await this.sleep(Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS));
          continue;
        }
        throw new ChannexApiError(`Channex ${path}: сеть — ${(e as Error).message}`, 0, path);
      }
      if (res.ok) return (res.status === 204 ? {} : await res.json()) as T;
      const errBody = (await res.json().catch(() => ({}))) as {
        errors?: { code?: string; title?: string; details?: unknown };
      };
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < this.maxRetries) {
        attempt += 1;
        const ra = Number(res.headers.get('retry-after') ?? '0');
        const wait =
          res.status === 429
            ? ra > 0
              ? Math.min(ra * 1000, RATE_LIMIT_PAUSE_MS)
              : RATE_LIMIT_PAUSE_MS
            : Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
        await this.sleep(wait);
        continue;
      }
      const e = errBody.errors ?? {};
      throw new ChannexApiError(
        `Channex ${method} ${path.split('?')[0]}: HTTP ${res.status} ${e.code ?? ''} ${e.title ?? ''}`.trim() +
          (e.details ? ` ${JSON.stringify(e.details).slice(0, 300)}` : ''),
        res.status,
        path,
        e.code,
        e.details,
      );
    }
  }

  /** Обход пагинации: `pagination[page]` с 1, `pagination[limit]` ≤ 100, конец по `meta.total`. */
  async listAll<A>(
    path: string,
    query: Record<string, string> = {},
  ): Promise<ChannexResource<A>[]> {
    const out: ChannexResource<A>[] = [];
    for (let page = 1; ; page += 1) {
      const q = new URLSearchParams({
        ...query,
        'pagination[page]': String(page),
        'pagination[limit]': String(PAGE_LIMIT),
      });
      const res = await this.request<ListResponse<A>>('GET', `${path}?${q.toString()}`);
      out.push(...res.data);
      const total = res.meta?.total;
      if (
        res.data.length === 0 ||
        (total !== undefined && out.length >= total) ||
        res.data.length < PAGE_LIMIT
      )
        break;
    }
    return out;
  }

  // ── Properties (hotels-collection.md) ──
  listProperties(): Promise<ChannexResource<ChannexPropertyAttributes>[]> {
    return this.listAll<ChannexPropertyAttributes>('/properties');
  }
  async createProperty(
    attrs: ChannexPropertyAttributes,
  ): Promise<ChannexResource<ChannexPropertyAttributes>> {
    return (
      await this.request<OneResponse<ChannexPropertyAttributes>>('POST', '/properties', {
        property: attrs,
      })
    ).data;
  }
  async getProperty(id: string): Promise<ChannexResource<ChannexPropertyAttributes>> {
    return (
      await this.request<OneResponse<ChannexPropertyAttributes>>(
        'GET',
        `/properties/${encodeURIComponent(id)}`,
      )
    ).data;
  }

  // ── Room types (room-types-collection.md) ──
  listRoomTypes(propertyId: string): Promise<ChannexResource<ChannexRoomTypeAttributes>[]> {
    return this.listAll<ChannexRoomTypeAttributes>('/room_types', {
      'filter[property_id]': propertyId,
    });
  }
  async createRoomType(
    attrs: ChannexRoomTypeAttributes,
  ): Promise<ChannexResource<ChannexRoomTypeAttributes>> {
    return (
      await this.request<OneResponse<ChannexRoomTypeAttributes>>('POST', '/room_types', {
        room_type: attrs,
      })
    ).data;
  }
  async updateRoomType(
    id: string,
    attrs: Partial<ChannexRoomTypeAttributes>,
  ): Promise<ChannexResource<ChannexRoomTypeAttributes>> {
    return (
      await this.request<OneResponse<ChannexRoomTypeAttributes>>(
        'PUT',
        `/room_types/${encodeURIComponent(id)}`,
        { room_type: attrs },
      )
    ).data;
  }

  // ── Rate plans (rate-plans-collection.md) ──
  listRatePlans(propertyId: string): Promise<ChannexResource<ChannexRatePlanAttributes>[]> {
    return this.listAll<ChannexRatePlanAttributes>('/rate_plans', {
      'filter[property_id]': propertyId,
    });
  }
  async createRatePlan(
    attrs: ChannexRatePlanAttributes,
  ): Promise<ChannexResource<ChannexRatePlanAttributes>> {
    return (
      await this.request<OneResponse<ChannexRatePlanAttributes>>('POST', '/rate_plans', {
        rate_plan: attrs,
      })
    ).data;
  }

  // ── ARI (ari.md): отдельно доступность, отдельно цены и ограничения ──
  updateAvailability(values: ChannexAvailabilityValue[]): Promise<ChannexTaskResponse> {
    return this.request<ChannexTaskResponse>('POST', '/availability', { values });
  }
  updateRestrictions(values: ChannexRestrictionValue[]): Promise<ChannexTaskResponse> {
    return this.request<ChannexTaskResponse>('POST', '/restrictions', { values });
  }

  // ── Bookings (bookings-collection.md): лента неподтверждённых ревизий → обработка → ack ──
  bookingRevisionsFeed(
    propertyId?: string,
  ): Promise<ChannexResource<ChannexBookingRevisionAttributes>[]> {
    const q: Record<string, string> = { 'order[inserted_at]': 'asc' };
    if (propertyId) q['filter[property_id]'] = propertyId;
    return this.listAll<ChannexBookingRevisionAttributes>('/booking_revisions/feed', q);
  }
  async getBookingRevision(id: string): Promise<ChannexResource<ChannexBookingRevisionAttributes>> {
    return (
      await this.request<OneResponse<ChannexBookingRevisionAttributes>>(
        'GET',
        `/booking_revisions/${encodeURIComponent(id)}`,
      )
    ).data;
  }
  /** Подтвердить получение: без ack ревизия возвращается в ленту 30 минут, потом письмо-предупреждение. */
  async ackBookingRevision(id: string): Promise<void> {
    await this.request<{ meta?: { message?: string } }>(
      'POST',
      `/booking_revisions/${encodeURIComponent(id)}/ack`,
    );
  }

  /**
   * Остатки по категориям за период (ari.md → Get the Availability per Room Type).
   * Ответ: { room_type_id: { 'YYYY-MM-DD': остаток } }. Нужен для сверки: канал обязан видеть ноль,
   * когда мест нет, иначе продаст сверх фонда.
   */
  async getAvailability(
    propertyId: string,
    from: string,
    to: string,
  ): Promise<Record<string, Record<string, number>>> {
    const q = new URLSearchParams({
      'filter[date][gte]': from,
      'filter[date][lte]': to,
      'filter[property_id]': propertyId,
    });
    const res = await this.request<{ data: Record<string, Record<string, number>> }>(
      'GET',
      `/availability?${q.toString()}`,
    );
    return res.data;
  }

  // ── Webhooks (webhook-collection.md): секрет — свой заголовок, HMAC у Channex нет ──
  listWebhooks(): Promise<ChannexResource<ChannexWebhookAttributes>[]> {
    return this.listAll<ChannexWebhookAttributes>('/webhooks');
  }
  async createWebhook(
    input: ChannexWebhookInput,
  ): Promise<ChannexResource<ChannexWebhookAttributes>> {
    const res = await this.request<OneResponse<ChannexWebhookAttributes>>('POST', '/webhooks', {
      webhook: input,
    });
    return res.data;
  }
  async updateWebhook(
    id: string,
    input: ChannexWebhookInput,
  ): Promise<ChannexResource<ChannexWebhookAttributes>> {
    const res = await this.request<OneResponse<ChannexWebhookAttributes>>(
      'PUT',
      `/webhooks/${encodeURIComponent(id)}`,
      { webhook: input },
    );
    return res.data;
  }
  async deleteWebhook(id: string): Promise<void> {
    await this.request<{ meta?: { message?: string } }>(
      'DELETE',
      `/webhooks/${encodeURIComponent(id)}`,
    );
  }
  /**
   * Channex шлёт пробный POST на callback_url и возвращает, что ответил наш endpoint.
   * Живой staging отвечает `{ status, body, headers, request_url }`, документация — `status_code`; принимаем оба.
   */
  async testWebhook(input: ChannexWebhookInput): Promise<ChannexWebhookTestResult> {
    const raw = await this.request<{ status_code?: number; status?: number; body?: string }>(
      'POST',
      '/webhooks/test',
      { webhook: input },
    );
    return { status_code: raw.status_code ?? raw.status ?? 0, body: raw.body ?? '' };
  }
}
