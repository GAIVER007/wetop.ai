/**
 * Клиент Channex API v1 — единственное место, где живут vendor-специфика и ID Channex (ADR-004).
 * Источники (docs/channex/site/api-v.1-documentation): api-reference.md (JSON:API, `user-api-key`,
 * ошибки `errors.code/title/details`, пагинация `pagination[page|limit]`, max limit 100),
 * rate-limits.md (429 → пауза 1 мин, экспоненциальный backoff; 10 запросов/мин на ARI-эндпоинт),
 * hotels-collection.md, room-types-collection.md, rate-plans-collection.md, ari.md.
 * Ключ приходит через конструктор из окружения и в ошибки/логи не попадает.
 */

import type { ChannexChannelAdapter, ChannexChannelAttributes } from './channel-connections';

export interface ChannexClientOptions {
  apiKey: string;
  /** По умолчанию staging (sandbox); production только после Gate 9 (CUTOVER.md) */
  baseUrl?: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Повторов на 429/5xx/сетевые ошибки (по умолчанию 3) */
  maxRetries?: number;
  /**
   * Сколько ждать ответа на один запрос, мс (по умолчанию 15 000).
   *
   * `fetch` без сигнала висит, пока открыто соединение: замолчавший Channex держал экран
   * «Подключения» и кнопки «Каналов» минутами. Таймаут превращает молчание в обычную сетевую
   * ошибку — повтор с backoff, затем внятный отказ.
   */
  timeoutMs?: number;
  /**
   * Разрешение ходить в Channex production (AGENTS.md §9, SECURITY.md §9, Q-171). Без него запрос на любой хост
   * channex.io, кроме staging, отказывает до сети. API ставит его из `CHANNEX_PRODUCTION=1` — шагом переключения
   * (CUTOVER.md): ошибка в .env (адрес и ключ production) не превращается в отправку ARI и подтверждение броней.
   */
  allowProduction?: boolean;
}

/** Хост Channex production: всё на channex.io, кроме staging. Свои адреса (подделки тестов) production не считаются */
export function isChannexProduction(baseUrl: string): boolean {
  let host: string;
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  return (host === 'channex.io' || host.endsWith('.channex.io')) && host !== 'staging.channex.io';
}

/** Разрешение на production из окружения: ровно `CHANNEX_PRODUCTION=1`, ставит владелец при переключении (CUTOVER.md) */
export function channexProductionAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env['CHANNEX_PRODUCTION']?.trim() === '1';
}

export const CHANNEX_PRODUCTION_REFUSED =
  'Адрес Channex — production, а разрешения нет: до переключения каналов (AGENTS.md §9, CUTOVER.md) production ' +
  'не вызывается. Разрешает владелец: CHANNEX_PRODUCTION=1 в .env';

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
/**
 * Имена ограничений для чтения (ari.md → Get Availability Or Restrictions Per Rate Plan →
 * «restrictions … Supported values»). availability_offset и max_availability — только чтение.
 */
export type ChannexRestrictionName =
  | 'availability'
  | 'rate'
  | 'min_stay_arrival'
  | 'min_stay_through'
  | 'min_stay'
  | 'closed_to_arrival'
  | 'closed_to_departure'
  | 'stop_sell'
  | 'max_stay'
  | 'availability_offset'
  | 'max_availability';
/**
 * Клетка ответа GET /restrictions (ari.md → Restriction Object): только запрошенные ключи.
 * Цена приходит строкой с двумя знаками ("200.00" в документации, "14000.00" на живом staging —
 * tests/fixtures/channex/readback-restrictions-2026-09-09.json), хотя шлём мы её integer minor units.
 */
export interface ChannexRestrictionCell {
  availability?: number;
  rate?: string;
  min_stay_arrival?: number;
  min_stay_through?: number;
  min_stay?: number;
  max_stay?: number;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  stop_sell?: boolean;
  availability_offset?: number;
  max_availability?: number;
  /** В документации нет; живой staging добавляет к каждой дате (см. фикстуру выше) */
  unavailable_reasons?: unknown[];
}
/** Ответ GET /restrictions: тариф Channex → дата YYYY-MM-DD → клетка */
export type ChannexRestrictionsByPlan = Record<string, Record<string, ChannexRestrictionCell>>;
/** То, что мы сами публикуем в POST /restrictions и хотим сверить назад */
export const DEFAULT_READBACK_RESTRICTIONS: readonly ChannexRestrictionName[] = [
  'rate',
  'min_stay_arrival',
  'stop_sell',
  'closed_to_arrival',
  'closed_to_departure',
];
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
/** Ждём ответ на один запрос не дольше этого: замолчавший Channex не должен держать экран стойки */
const DEFAULT_TIMEOUT_MS = 15_000;
const PAGE_LIMIT = 100;

/**
 * Цена из ответа Channex ("14000.00") → integer minor units (1400000n, тиыны) без плавающей точки
 * (ADR-008). Мы отправляем rate как integer minor units (ari.md: 20000 = 200.00), назад Channex
 * отдаёт десятичную строку — это единственное место перевода. Число принимаем через String, чтобы
 * не заниматься арифметикой над float; всё, что не «целое[.до двух знаков]», — ошибка.
 */
export function channexDecimalToMinor(value: string | number): bigint {
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim());
  if (!m) throw new Error(`Channex rate «${String(value)}» не десятичное число`);
  const minor = BigInt(m[2]!) * 100n + BigInt((m[3] ?? '').padEnd(2, '0'));
  return m[1] ? -minor : minor;
}

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
  private readonly timeoutMs: number;
  private readonly productionRefused: boolean;

  constructor(private readonly opts: ChannexClientOptions) {
    this.base = (opts.baseUrl ?? CHANNEX_STAGING_URL).replace(/\/$/, '');
    this.productionRefused = isChannexProduction(this.base) && opts.allowProduction !== true;
    this.fetchFn = opts.fetch ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.maxRetries = opts.maxRetries ?? 3;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Все запросы: ключ в `user-api-key`; 429 → пауза (retry-after или 1 минута); 5xx/сеть → backoff. */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (this.productionRefused) throw new ChannexApiError(CHANNEX_PRODUCTION_REFUSED, 403, path);
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
          signal: AbortSignal.timeout(this.timeoutMs),
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch (e) {
        if (attempt < this.maxRetries) {
          attempt += 1;
          await this.sleep(Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS));
          continue;
        }
        const aborted =
          (e as Error).name === 'TimeoutError' ||
          (e as Error).name === 'AbortError' ||
          /abort/i.test((e as Error).message);
        throw new ChannexApiError(
          aborted
            ? `Channex ${path}: таймаут ${this.timeoutMs} мс — ответа нет`
            : `Channex ${path}: сеть — ${(e as Error).message}`,
          0,
          path,
        );
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
  // Ревизию по ID и список ревизий клиент не читает: сценарий 11 сертификации Channex требует приёма
  // «via webhook/feed, not list-polling or by-id fetching» (reports/channex-cert-review-2026-09-24.md).
  bookingRevisionsFeed(
    propertyId?: string,
  ): Promise<ChannexResource<ChannexBookingRevisionAttributes>[]> {
    const q: Record<string, string> = { 'order[inserted_at]': 'asc' };
    if (propertyId) q['filter[property_id]'] = propertyId;
    return this.listAll<ChannexBookingRevisionAttributes>('/booking_revisions/feed', q);
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

  /**
   * Цены и ограничения по тарифам за период (ari.md → Get Availability Or Restrictions Per Rate Plan).
   * Запрос требует ровно три аргумента: filter[property_id] (один объект), filter[date][gte|lte]
   * и filter[restrictions] — список через запятую; без него Channex отвечает 400 «restrictions is required».
   * Ответ: { rate_plan_id: { 'YYYY-MM-DD': { ограничение: значение } } } — только запрошенные ключи.
   * Фильтра по тарифу в документации нет, поэтому ratePlanIds сужают ответ уже у нас.
   * Нужен для сверки в обе стороны: то, что мы опубликовали, обязано совпасть с тем, что канал видит.
   */
  async getRestrictions(
    propertyId: string,
    from: string,
    to: string,
    ratePlanIds?: readonly string[],
    restrictions: readonly ChannexRestrictionName[] = DEFAULT_READBACK_RESTRICTIONS,
  ): Promise<ChannexRestrictionsByPlan> {
    const q = new URLSearchParams({
      'filter[property_id]': propertyId,
      'filter[date][gte]': from,
      'filter[date][lte]': to,
      'filter[restrictions]': restrictions.join(','),
    });
    const res = await this.request<{ data?: ChannexRestrictionsByPlan }>(
      'GET',
      `/restrictions?${q.toString()}`,
    );
    const data = res.data ?? {};
    if (!ratePlanIds) return data;
    const wanted = new Set(ratePlanIds);
    return Object.fromEntries(Object.entries(data).filter(([id]) => wanted.has(id)));
  }

  /**
   * Контент объекта (hotels-collection.md → Update Property). Меняем только переданные поля:
   * Channex принимает частичный объект внутри { property }.
   */
  async updateProperty(
    id: string,
    patch: Partial<{
      phone: string;
      email: string;
      facilities: string[];
      content: { description?: string };
    }>,
  ): Promise<ChannexResource<ChannexPropertyAttributes>> {
    const res = await this.request<OneResponse<ChannexPropertyAttributes>>(
      'PUT',
      `/properties/${encodeURIComponent(id)}`,
      { property: patch },
    );
    return res.data;
  }

  /** Правила объекта (hotel-policy-collection.md → Create Hotel Policy): время заезда и выезда, валюта. */
  async createHotelPolicy(
    input: {
      property_id: string;
      title: string;
      currency: string;
    } & Record<string, unknown>,
  ): Promise<ChannexResource<Record<string, unknown>>> {
    const res = await this.request<OneResponse<Record<string, unknown>>>(
      'POST',
      '/hotel_policies',
      {
        hotel_policy: input,
      },
    );
    return res.data;
  }

  /** Правка правил объекта (hotel-policy-collection.md → Update Hotel Policy). */
  async updateHotelPolicy(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<ChannexResource<Record<string, unknown>>> {
    const res = await this.request<OneResponse<Record<string, unknown>>>(
      'PUT',
      `/hotel_policies/${encodeURIComponent(id)}`,
      { hotel_policy: patch },
    );
    return res.data;
  }

  /**
   * Загрузка файла фотографии (photos-collection.md → Upload Photo). Возвращает временную ссылку,
   * которую затем передают в createPhoto. Заголовок content-type не ставим: его формирует FormData
   * вместе с разделителем частей, иначе сервер не разберёт тело.
   */
  async uploadPhoto(file: Blob, filename: string): Promise<string> {
    if (this.productionRefused)
      throw new ChannexApiError(CHANNEX_PRODUCTION_REFUSED, 403, '/photos/upload');
    const form = new FormData();
    form.append('photo', file, filename);
    const res = await this.fetchFn(`${this.base}/photos/upload`, {
      method: 'POST',
      headers: { 'user-api-key': this.opts.apiKey, accept: 'application/json' },
      // Файл идёт дольше обычного запроса, но ждать бесконечно нельзя и здесь
      signal: AbortSignal.timeout(this.timeoutMs * 4),
      body: form,
    });
    if (!res.ok)
      throw new ChannexApiError(
        `Channex /photos/upload: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`,
        res.status,
        '/photos/upload',
      );
    const body = (await res.json()) as { url?: string };
    if (!body.url)
      throw new ChannexApiError('Channex /photos/upload: в ответе нет url', 502, '/photos/upload');
    return body.url;
  }

  /** Привязка загруженной фотографии к объекту или категории (photos-collection.md → Create Photo). */
  async createPhoto(input: {
    property_id: string;
    url: string;
    description?: string;
    position?: number;
    room_type_id?: string | null;
    kind?: string;
  }): Promise<ChannexResource<Record<string, unknown>>> {
    const res = await this.request<OneResponse<Record<string, unknown>>>('POST', '/photos', {
      photo: input,
    });
    return res.data;
  }

  /** Справочник удобств объекта (facilities-collection.md) — id выбираются из него, а не выдумываются. */
  listPropertyFacilities(): Promise<ChannexResource<Record<string, unknown>>[]> {
    return this.listAll<Record<string, unknown>>('/property_facilities');
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

  // ── Channel API (channel-api.md): каталог каналов и подключения объекта; только чтение ──
  /** `GET /channels/list` — все адаптеры каналов; ответ — массив без пагинации */
  async listChannelAdapters(): Promise<ChannexChannelAdapter[]> {
    return (
      (await this.request<{ data: ChannexChannelAdapter[] }>('GET', '/channels/list')).data ?? []
    );
  }
  /** `GET /channels/codes` — короткие коды каналов (BDC, AGO…), которыми окно Channex фильтрует список */
  async listChannelCodes(): Promise<Array<{ code: string; name: string }>> {
    return (
      (
        await this.request<{ data: Array<{ code: string; name: string }> }>(
          'GET',
          '/channels/codes',
        )
      ).data ?? []
    );
  }
  /** `GET /channels?filter[property_id]=…` — подключения объекта к каналам, постранично */
  listChannels(propertyId: string): Promise<ChannexResource<ChannexChannelAttributes>[]> {
    return this.listAll<ChannexChannelAttributes>('/channels', {
      'filter[property_id]': propertyId,
    });
  }
  /**
   * `POST /channels/{id}/execute/{action}` (channel-api-examples/booking.com.md, «Actions»): действие выполняется
   * сразу; `load_future_reservations` просит канал выдать будущие брони, они приходят обычной лентой ревизий.
   */
  async executeChannelAction(channelId: string, action: string): Promise<void> {
    await this.request<unknown>(
      'POST',
      `/channels/${encodeURIComponent(channelId)}/execute/${encodeURIComponent(action)}`,
      {},
    );
  }
  /**
   * `POST /auth/one_time_token` (channel-iframe.md): одноразовый токен окна Channex, живёт 15 минут.
   * Окно открывается от имени владельца ключа API, поэтому токен выдаёт только сервер и только на объект.
   */
  async createOneTimeToken(input: {
    propertyId: string;
    username: string;
    groupId?: string;
  }): Promise<string> {
    const res = await this.request<{ data?: { token?: string } }>('POST', '/auth/one_time_token', {
      one_time_token: {
        property_id: input.propertyId,
        ...(input.groupId ? { group_id: input.groupId } : {}),
        username: input.username,
      },
    });
    const token = res.data?.token;
    if (!token)
      throw new ChannexApiError(
        'Менеджер каналов не выдал токен окна',
        502,
        '/auth/one_time_token',
      );
    return token;
  }
}
