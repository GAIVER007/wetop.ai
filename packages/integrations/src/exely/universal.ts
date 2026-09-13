/**
 * Клиент «Универсального API Exely PMS» 1.5.0 — ТОЛЬКО ЧТЕНИЕ (ADR-015, AGENTS.md §9).
 * Источник: docs/exely/universal-pms-api-1.5.0.md. Авторизация: заголовок X-API-KEY = ключ
 * интеграции («Управление отелем → Настройки → Интеграции»). Ключ в логи не попадает.
 */
import { ExelyApiError, chunkDateRange } from './client';

export interface ExelyUniversalOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
}

export interface UniRoom {
  id: string;
  name: string;
  roomTypeId: string;
}
export interface UniDictionaryItem {
  key: string;
  value: string;
}
export interface UniCustomer {
  id: string;
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  birthDate?: string | null;
  citizenshipCode?: string | null;
  status?: UniDictionaryItem | null;
  emails?: string[] | null;
  phones?: string[] | null;
  gender?: string | null;
}
export interface UniRoomStay {
  id: string;
  bookingId: string;
  roomId: string | null;
  roomTypeId: string;
  checkInDateTime: string;
  checkOutDateTime: string;
  actualCheckInDateTime: string | null;
  actualCheckOutDateTime: string | null;
  status: 'CheckedIn' | 'CheckedOut' | 'Cancelled' | 'New' | string;
  bookingStatus: 'Confirmed' | 'Cancelled' | 'Pending' | string;
  guestCountInfo: { adults: number; children: number };
  guestsIds: string[];
  totalPrice: { amount: number; toPayAmount: number; toRefundAmount: number };
  amenities?: Array<{ name: string }>;
}
export interface UniBooking {
  id: string;
  number: string;
  customerLanguage?: string;
  visitPurpose?: UniDictionaryItem | null;
  customerComment?: string | null;
  lastModified?: string;
  groupName?: string | null;
  currencyId: string;
  customer: UniCustomer;
  customerCompany?: { id: string; name: string } | null;
  roomStays: UniRoomStay[];
  source?: UniDictionaryItem | null;
  sourceChannelName?: string | null;
}
export interface UniServiceRow {
  id: string;
  kind: number; // 0 проживание, 1 услуга, 2 трансфер, 3 ранний заезд, 4 поздний выезд
  name: string;
  amount: number;
  discount: number;
  vatKind: number;
  vat: number;
  quantity: number;
  date: string; // yyyyMMdd
  reservationId: number;
  optionCategory?: string | null;
  isIncluded?: boolean;
}
export interface UniReservationRow {
  id: number;
  customerIndex: number;
  agentIndex: number | null;
  currency: string;
  currencyRate: number;
  bookingNumber: string;
  roomNumber: string;
  guestId: string;
  guestName: string;
  guestCount: number;
  checkInDateTime: string; // yyyyMMddHHmm
  checkOutDateTime: string;
  isDeparted: boolean;
  isArrived: boolean;
  paymentMethod: number;
  roomTypeId: number;
  total: number;
  tax: number;
  paid: number;
  balance: number;
  creationDateTime: string;
  folioNumber: string;
  [k: string]: unknown;
}
export interface UniAnalyticsServices {
  services: UniServiceRow[];
  customers: Array<Record<string, unknown>>;
  agents: Array<Record<string, unknown>>;
  reservations: UniReservationRow[];
  roomTypes: Array<Record<string, unknown>>;
}
export interface SearchBookingsParams {
  state: 'Active' | 'Cancelled';
  roomId?: string;
  modifiedFrom?: string;
  modifiedTo?: string;
  affectsPeriodFrom?: string;
  affectsPeriodTo?: string;
}

const DEFAULT_BASE = 'https://connect.hopenapi.com/api/exelypms/v1';
const MAX_RETRY_AFTER_MS = 60_000;
const compact = (d: string) => d.replace(/-/g, '');

export class ExelyUniversalClient {
  private readonly base: string;
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetries: number;

  constructor(private readonly opts: ExelyUniversalOptions) {
    this.base = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
    this.fetchFn = opts.fetch ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.maxRetries = opts.maxRetries ?? 3;
  }

  private async get<T>(path: string): Promise<T> {
    let attempt = 0;
    for (;;) {
      const res = await this.fetchFn(`${this.base}${path}`, {
        headers: { 'X-API-KEY': this.opts.apiKey, Accept: 'application/json' },
      });
      if (res.ok) return (await res.json()) as T;
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < this.maxRetries) {
        attempt += 1;
        const ra = Number(res.headers.get('retry-after') ?? '0');
        await this.sleep(
          ra > 0
            ? Math.min(ra * 1000, MAX_RETRY_AFTER_MS)
            : Math.min(1000 * 2 ** attempt, MAX_RETRY_AFTER_MS),
        );
        continue;
      }
      const text = (await res.text().catch(() => '')).slice(0, 200);
      throw new ExelyApiError(
        `Exely PMS API ${path.split('?')[0]}: HTTP ${res.status} ${text}`,
        res.status,
        path,
      );
    }
  }

  /** GET /v1/rooms — все единицы фонда (id, name = «№ комнаты в Exely», roomTypeId). */
  async rooms(roomTypeId?: string): Promise<UniRoom[]> {
    const q = roomTypeId ? `?roomTypeId=${encodeURIComponent(roomTypeId)}` : '';
    const r = await this.get<UniRoom[] | { rooms?: UniRoom[] }>(`/rooms${q}`);
    return Array.isArray(r) ? r : (r.rooms ?? []);
  }

  /** GET /v1/bookings — номера броней по периоду пересечения и/или модификации (≤365 дней). */
  async searchBookings(p: SearchBookingsParams): Promise<string[]> {
    const q = new URLSearchParams({ state: p.state });
    for (const k of [
      'roomId',
      'modifiedFrom',
      'modifiedTo',
      'affectsPeriodFrom',
      'affectsPeriodTo',
    ] as const) {
      if (p[k]) q.set(k, p[k]!);
    }
    const r = await this.get<{ bookingNumbers?: string[] }>(`/bookings?${q.toString()}`);
    return r.bookingNumbers ?? [];
  }

  /** GET /v1/bookings/{number} — бронь с проживаниями и заказчиком. */
  async booking(number: string, language = 'ru'): Promise<UniBooking> {
    return this.get<UniBooking>(`/bookings/${encodeURIComponent(number)}?language=${language}`);
  }

  /**
   * GET /v1/analytics/services — начисления по дням; окно ≤31 день, режем сами.
   * dateKind: 0 по выезду · 1 по пребыванию · 2 по созданию · 3 по модификации · 4 по выезду без разделения.
   */
  async analyticsServices(p: {
    startDate: string;
    endDate: string;
    dateKind: 0 | 1 | 2 | 3 | 4;
    cancelled?: boolean;
  }): Promise<UniAnalyticsServices> {
    const out: UniAnalyticsServices = {
      services: [],
      customers: [],
      agents: [],
      reservations: [],
      roomTypes: [],
    };
    for (const [from, to] of chunkDateRange(p.startDate, p.endDate, 31)) {
      const path = `/analytics/services${p.cancelled ? '/cancelled' : ''}?startDate=${compact(from)}&endDate=${compact(to)}&dateKind=${p.dateKind}`;
      const r = await this.get<{ data?: Partial<UniAnalyticsServices> }>(path);
      const d = r.data ?? {};
      out.services.push(...(d.services ?? []));
      out.customers.push(...(d.customers ?? []));
      out.agents.push(...(d.agents ?? []));
      out.reservations.push(...(d.reservations ?? []));
      out.roomTypes.push(...(d.roomTypes ?? []));
    }
    return out;
  }

  /**
   * GET /v1/analytics/payments — платежи по бронированиям за период (yyyyMMddHHmm), окно ≤31 день, будущее нельзя.
   * includeExternalPayments — добавить предоплаты, проведённые вне Exely (например, гостем на сайте).
   */
  async analyticsPayments(p: {
    startDateTime: string;
    endDateTime: string;
    includeExternalPayments?: boolean;
  }): Promise<Record<string, unknown>> {
    const external = p.includeExternalPayments ? '&includeExternalPayments=true' : '';
    return this.get<Record<string, unknown>>(
      `/analytics/payments?startDateTime=${p.startDateTime}&endDateTime=${p.endDateTime}${external}`,
    );
  }
}
