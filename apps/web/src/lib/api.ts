/**
 * Клиент API стойки. Адрес — APP_API_URL (по умолчанию локальный API на 3001).
 * Формы ответов повторяют apps/api (InventorySummaryDto, InventoryUnitDto).
 */
export interface CategorySummary {
  code: string;
  name: string;
  units: number;
  maxGuests: number;
}

export interface InventorySummary {
  property: { name: string; timezone: string; currency: string };
  totalUnits: number;
  rooms: number;
  beds: number;
  maxGuests: number;
  physicalRooms: number;
  blocks: number;
  byCategory: CategorySummary[];
}

export interface InventoryUnit {
  code: string;
  exelyRoomNumber: string | null;
  kind: 'ROOM' | 'BED';
  accommodationTypeCode: string;
  accommodationTypeName: string;
  roomNumber: string;
  roomCapacity: number;
  isDorm: boolean;
}

/** Fixtures are available only to the isolated test runner, never to next start. */
async function backendFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const endpoint = process.env.APP_API_URL?.trim() || 'http://127.0.0.1:3001';
  const testing = process.env.NODE_ENV !== 'production' && process.env.APP_ALLOW_TEST_DATA === '1';
  if (!testing && new URL(endpoint).port === '4311') {
    throw new ApiError(503, 'Тестовый источник отключён. Подключите рабочий API.');
  }
  let response: Response;
  try {
    response = await fetch(`${endpoint.replace(/\/$/, '')}${path}`, {
      ...options,
      cache: 'no-store',
      headers: { ...options.headers, ...(testing ? { 'x-wetop-test-client': '1' } : {}) },
      signal: AbortSignal.timeout(options.method && options.method !== 'GET' ? 60_000 : 15_000),
    });
  } catch (error) {
    // Next.js also throws here to switch static prerendering to request-time rendering.
    // Only translate actual fetch failures; framework control flow must propagate unchanged.
    if (!(
      error instanceof TypeError ||
      (error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name))
    ))
      throw error;
    // No automatic retry: a timed-out payment/booking may already have been committed by the API.
    throw new ApiError(
      503,
      options.method && options.method !== 'GET'
        ? 'Нет ответа API. Проверьте результат операции перед повтором.'
        : 'Нет связи с API. Проверьте подключение.',
    );
  }
  if (!testing && response.headers.get('x-wetop-data-source') === 'synthetic') {
    throw new ApiError(503, 'Тестовый источник отключён. Подключите рабочий API.');
  }
  return response;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await backendFetch(path);
  if (!res.ok) {
    throw new ApiError(res.status, `API ${path}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Для страниц, которым нужен произвольный путь API (журнал). */
export const getJsonPublic = getJson;

export const api = {
  inventorySummary: () => getJson<InventorySummary>('/inventory/summary'),
  inventoryUnits: (category?: string) =>
    getJson<InventoryUnit[]>(
      category ? `/inventory/units?category=${encodeURIComponent(category)}` : '/inventory/units',
    ),
};

export type CellState = 'FREE' | 'OCCUPIED' | 'BLOCKED';
export interface ChessboardCell {
  date: string;
  state: CellState;
  itemId?: string;
  itemStatus?: string;
  confirmationNumber?: string;
  guestLabel?: string;
  guestPhone?: string | null;
  isArrival?: boolean;
  isLastNight?: boolean;
  blockType?: string;
  /** причина блокировки («ремонт: кондиционер») — показывается подсказкой на клетке */
  blockReason?: string | null;
}
export interface ChessboardRow {
  unit: {
    id: string;
    code: string;
    kind: 'ROOM' | 'BED';
    accommodationTypeCode: string;
    accommodationTypeName: string;
  };
  cells: ChessboardCell[];
}
/** Проживание без ячейки в диапазоне доски (строка «Без ячейки», паритет с «Без номера» в Exely). Без гостей — ПД. */
export interface UnassignedStay {
  confirmationNumber: string;
  categoryCode: string;
  categoryName: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
}
export interface Chessboard {
  from: string;
  to: string;
  dates: string[];
  rows: ChessboardRow[];
  summary: Record<string, { occupied: number; blocked: number; free: number }>;
  /** дата → код категории → сколько единиц, занято, заблокировано, свободно */
  byCategory: Record<
    string,
    Record<string, { units: number; occupied: number; blocked: number; free: number }>
  >;
  /** По категории, затем по заезду; ячеек не занимают, в summary не входят */
  unassigned: UnassignedStay[];
}
export interface ReservationCard {
  confirmationNumber: string;
  source: string;
  channel: string | null;
  status: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  currency: string;
  totalAmountMinor: string;
  notes: string | null;
  primaryGuest: {
    id: string;
    label: string;
    citizenship: string | null;
    phone: string | null;
  } | null;
  items: Array<{
    id: string;
    accommodationTypeCode: string;
    accommodationTypeName: string;
    arrivalDate: string;
    departureDate: string;
    status: string;
    priceMinor: string;
    /** Гостей на проживании — правится с карточки */
    adults: number;
    children: number;
    unitCode: string | null;
    guests: Array<{ label: string; isPrimary: boolean }>;
  }>;
}
export const chessboardApi = {
  board: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const s = q.toString();
    return getJson<Chessboard>(`/chessboard${s ? `?${s}` : ''}`);
  },
  reservation: (number: string) =>
    getJson<ReservationCard>(`/reservations/${encodeURIComponent(number)}`),
};
/** Тиыны → строка в тенге с разделителями, без float-арифметики. */
/**
 * T5: ссылки в мессенджеры по телефону гостя. Телефон приводим к цифрам — оба сервиса ждут
 * международный формат без плюса и разделителей. Пустой или слишком короткий номер ссылок не даёт.
 */
export function messengerLinks(phone: string | null | undefined): {
  whatsapp: string;
  telegram: string;
} | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return { whatsapp: `https://wa.me/${digits}`, telegram: `https://t.me/+${digits}` };
}

export function formatMinor(minor: string, currency = 'KZT'): string {
  const neg = minor.startsWith('-');
  const digits = minor.replace('-', '').padStart(3, '0');
  const int = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '−' : ''}${int},${digits.slice(-2)} ${currency === 'KZT' ? '₸' : currency}`;
}

export interface StayAvailability {
  arrivalDate: string;
  departureDate: string;
  nights: number;
  byCategory: Record<string, { units: number; available: number; availableUnitCodes: string[] }>;
  total: { units: number; available: number };
}
export interface RatePlanOption {
  code: string;
  name: string;
  currency: string;
}
/** Ошибка API с текстом из ответа NestJS (400/404/409/422) — показывается администратору как есть. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
async function sendJson<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
): Promise<T> {
  const res = await backendFetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string | string[] };
      if (j.message) message = Array.isArray(j.message) ? j.message.join('; ') : j.message;
    } catch {
      /* тело не JSON */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}
export const reservationsApi = {
  ratePlans: () => getJson<RatePlanOption[]>('/rate-plans'),
  availability: (arrival: string, departure: string) =>
    getJson<StayAvailability>(
      `/availability?arrival=${encodeURIComponent(arrival)}&departure=${encodeURIComponent(departure)}`,
    ),
  create: (body: unknown) => sendJson<ReservationCard>('POST', '/reservations', body),
  changeDates: (number: string, body: unknown) =>
    sendJson<ReservationCard>('PATCH', `/reservations/${encodeURIComponent(number)}/dates`, body),
  /** Правка готовой брони: заметки и источник */
  update: (number: string, body: unknown) =>
    sendJson<ReservationCard>('PATCH', `/reservations/${encodeURIComponent(number)}`, body),
  /** Гостей на проживании */
  updateItem: (number: string, itemId: string, body: unknown) =>
    sendJson<ReservationCard>(
      'PATCH',
      `/reservations/${encodeURIComponent(number)}/items/${encodeURIComponent(itemId)}`,
      body,
    ),
  cancel: (number: string) =>
    sendJson<ReservationCard>('POST', `/reservations/${encodeURIComponent(number)}/cancel`, {}),
  stay: (
    number: string,
    itemId: string,
    action: 'check-in' | 'check-out' | 'no-show',
    body: unknown = {},
  ) =>
    sendJson<ReservationCard>(
      'POST',
      `/reservations/${encodeURIComponent(number)}/items/${encodeURIComponent(itemId)}/${action}`,
      body,
    ),
  extend: (number: string, itemId: string, nights = 1) =>
    sendJson<ReservationCard>(
      'POST',
      `/reservations/${encodeURIComponent(number)}/items/${encodeURIComponent(itemId)}/extend`,
      { nights },
    ),
  assign: (number: string, itemId: string, body: unknown) =>
    sendJson<ReservationCard>(
      'POST',
      `/reservations/${encodeURIComponent(number)}/items/${encodeURIComponent(itemId)}/assign`,
      body,
    ),
};

// ── Цены и ограничения (Slice 3.5 / 4.5) ──
export interface RateCalendarDay {
  date: string;
  prices: Record<string, string>;
  minStay: number | null;
  maxStay: number | null;
  stopSell: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}
export interface RateCalendar {
  accommodationTypeCode: string;
  ratePlanCode: string;
  currency: string;
  capacityAdults: number;
  days: RateCalendarDay[];
}
export interface RateOptions {
  categories: Array<{ code: string; name: string; capacityAdults: number }>;
  ratePlans: Array<{ code: string; name: string; currency: string; active: boolean }>;
}
export interface RateChangeInput {
  accommodationTypeCode: string;
  ratePlanCode: string;
  dateFrom: string;
  dateTo: string;
  days?: string[] | undefined;
  price?: string | undefined;
  occupancy?: number | undefined;
  minStay?: number | null | undefined;
  maxStay?: number | null | undefined;
  stopSell?: boolean | undefined;
  closedToArrival?: boolean | undefined;
  closedToDeparture?: boolean | undefined;
}
export const ratesApi = {
  options: () => getJson<RateOptions>('/rates/options'),
  calendar: (accommodationTypeCode: string, ratePlanCode: string, from: string, to: string) =>
    getJson<RateCalendar>(
      `/rates?accommodationTypeCode=${encodeURIComponent(accommodationTypeCode)}&ratePlanCode=${encodeURIComponent(ratePlanCode)}&from=${from}&to=${to}`,
    ),
  bulk: (changes: RateChangeInput[]) =>
    sendJson<{ applied: number; rateRows: number; restrictionRows: number }>(
      'POST',
      '/rates/bulk',
      { changes },
    ),
};

// ── Каналы (Channex) ──
export interface ChannelMappingRow {
  id: string;
  localAccommodationTypeCode: string | null;
  localRatePlanId: string | null;
  providerPropertyId: string;
  providerRoomTypeId: string | null;
  providerRatePlanId: string | null;
}
export interface OutboxSummary {
  /** ISO-время самой старой неотправленной дельты (T6) */
  oldestPendingAt?: string | null;
  pending: number;
  failed: number;
  sent: number;
  lastSentAt: string | null;
  lastTaskId: string | null;
}
export const channelsApi = {
  connection: () => getJson<ChannelConnection>('/channels/channex/connection'),
  mapping: () => getJson<ChannelMappingRow[]>('/channels/channex/mapping'),
  outbox: () => getJson<OutboxSummary>('/channels/channex/outbox'),
  setup: () => sendJson<unknown>('POST', '/channels/channex/setup', {}),
  /** Без `days` — глубина по умолчанию API (DEFAULT_SYNC_DAYS = 500, сертификация Channex §1) */
  sync: (days?: number) =>
    sendJson<{ from: string; to: string; tasks: string[] }>(
      'POST',
      days ? `/channels/channex/sync?days=${days}` : '/channels/channex/sync',
      {},
    ),
  pull: () =>
    sendJson<{ received: number; acknowledged: number; outcomes: unknown[] }>(
      'POST',
      '/channels/channex/pull',
      {},
    ),
  flush: () =>
    sendJson<{ sent: unknown[]; errors: unknown[] }>('POST', '/channels/channex/outbox/flush', {}),
  events: (limit = 30) => getJson<InboundEvent[]>(`/channels/channex/events?limit=${limit}`),
  retryEvent: (revisionId: string) =>
    sendJson<{ result: string; confirmationNumber: string | null; error?: string }>(
      'POST',
      `/channels/channex/events/${encodeURIComponent(revisionId)}/retry`,
      {},
    ),
  webhookStatus: () => getJson<WebhookStatus>('/channels/channex/webhook/status'),
  registerWebhook: () =>
    sendJson<{
      id: string;
      callbackUrl: string;
      created: boolean;
      eventMask: string;
      active: boolean;
    }>('POST', '/channels/channex/webhook/register', {}),
  testWebhook: () =>
    sendJson<{ callbackUrl: string; statusCode: number; body: string; verdict: string }>(
      'POST',
      '/channels/channex/webhook/test',
      {},
    ),
};
export interface ChannelConnection {
  checkedAt: string;
  environment: 'staging' | 'production' | 'custom';
  apiConfigured: boolean;
  propertyId: string | null;
  propertyAccessible: boolean;
  mappedCategories: number;
  mappedRatePlans: number;
  lastWebhookAt: string | null;
  lastPullAt: string | null;
  state: string;
  message: string;
}
export interface InboundEvent {
  externalEventId: string;
  receivedVia?: 'WEBHOOK' | 'PULL' | 'MANUAL';
  type: string;
  status: string;
  attempts: number;
  receivedAt: string;
  processedAt: string | null;
  lastError: string | null;
}
export interface WebhookStatus {
  registered: boolean;
  id: string | null;
  callbackUrl: string | null;
  eventMask: string | null;
  active: boolean;
  sendData: boolean;
  expectedUrl: string | null;
  secretConfigured: boolean;
  /** Проба зарегистрированного адреса: true — ответил, false — не отвечает, null — не проверяли */
  callbackReachable?: boolean | null;
  callbackCheckedAt?: string | null;
}

// ── Ячейки: блокировки и уборка ──
export interface UnitCard {
  id: string;
  code: string;
  kind: 'ROOM' | 'BED';
  active: boolean;
  housekeepingStatus: 'DIRTY' | 'CLEAN' | 'INSPECTED';
  accommodationTypeCode: string;
  accommodationTypeName: string;
  roomNumber: string;
  blocks: Array<{
    id: string;
    dateFrom: string;
    dateTo: string;
    type: string;
    reason: string | null;
  }>;
  stays: Array<{
    confirmationNumber: string;
    startDate: string;
    endDate: string;
    status: string;
    guestLabel: string;
  }>;
  housekeepingHistory: Array<{ at: string; from: string; to: string }>;
}
async function deleteJson<T>(path: string): Promise<T> {
  const res = await backendFetch(path, { method: 'DELETE' });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string };
      if (j.message) message = j.message;
    } catch {
      /* не JSON */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}
export const unitsApi = {
  card: (code: string) => getJson<UnitCard>(`/units/${encodeURIComponent(code)}`),
  block: (code: string, body: unknown) =>
    sendJson<UnitCard>('POST', `/units/${encodeURIComponent(code)}/blocks`, body),
  unblock: (code: string, blockId: string) =>
    deleteJson<UnitCard>(
      `/units/${encodeURIComponent(code)}/blocks/${encodeURIComponent(blockId)}`,
    ),
  housekeeping: (code: string, status: string) =>
    sendJson<UnitCard>('POST', `/units/${encodeURIComponent(code)}/housekeeping`, { status }),
};

// ── Гости ──
export interface GuestSummary {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string | null;
  email: string | null;
  citizenship: string | null;
  staysCount: number;
  lastStay: string | null;
}
export interface GuestCard {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  birthDate: string | null;
  citizenship: string | null;
  gender: 'MALE' | 'FEMALE' | 'UNKNOWN';
  phone: string | null;
  email: string | null;
  notes: string | null;
  documents: Array<{
    id: string;
    type: string;
    numberMasked: string;
    issueCountry: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
  }>;
  stays: Array<{
    confirmationNumber: string;
    accommodationTypeName: string;
    arrivalDate: string;
    departureDate: string;
    status: string;
    unitCode: string | null;
  }>;
}
export const guestsApi = {
  search: (q: string) => getJson<GuestSummary[]>(`/guests?q=${encodeURIComponent(q)}`),
  card: (id: string) => getJson<GuestCard>(`/guests/${encodeURIComponent(id)}`),
  update: (id: string, body: unknown) =>
    sendJson<GuestCard>('PATCH', `/guests/${encodeURIComponent(id)}`, body),
  addDocument: (id: string, body: unknown) =>
    sendJson<GuestCard>('POST', `/guests/${encodeURIComponent(id)}/documents`, body),
  deleteDocument: (id: string, documentId: string) =>
    deleteJson<GuestCard>(
      `/guests/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`,
    ),
};

// ── Счета (DATA_MODEL §6) ──
export interface FinanceCharge {
  id: string;
  kind: 'ACCOMMODATION' | 'SERVICE' | 'PENALTY' | 'ADJUSTMENT';
  serviceCode: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: string;
  amountMinor: string;
  serviceDate: string | null;
  createdAt: string;
  voidedAt: string | null;
}
export interface FinancePaymentLine {
  paymentId: string;
  method: string;
  status: 'COMPLETED' | 'VOIDED';
  paidAt: string;
  note: string | null;
  externalReference: string | null;
  paymentAmountMinor: string;
  allocatedMinor: string;
  refundedMinor: string;
}
export interface FinanceRefund {
  id: string;
  paymentId: string;
  amountMinor: string;
  reason: string | null;
  createdAt: string;
}
export interface FinanceFolio {
  id: string;
  reservationItemId: string;
  status: 'OPEN' | 'CLOSED';
  currency: string;
  stay: {
    accommodationTypeName: string;
    arrivalDate: string;
    departureDate: string;
    status: string;
  };
  charges: FinanceCharge[];
  payments: FinancePaymentLine[];
  refunds: FinanceRefund[];
  chargedMinor: string;
  paidMinor: string;
  refundedMinor: string;
  balanceMinor: string;
}
export interface ReservationFinance {
  confirmationNumber: string;
  currency: string;
  folios: FinanceFolio[];
  chargedMinor: string;
  paidMinor: string;
  refundedMinor: string;
  balanceMinor: string;
}
export interface ServiceOption {
  code: string;
  nameRu: string;
  nameKz: string | null;
  priceMinor: string;
  group: string | null;
}
export interface PeriodReport {
  from: string;
  to: string;
  currency: string;
  chargesByKind: Array<{ kind: string; count: number; amountMinor: string }>;
  paymentsByMethod: Array<{ method: string; count: number; amountMinor: string }>;
  refunds: { count: number; amountMinor: string };
  accommodationByCategory: Array<{ category: string; count: number; amountMinor: string }>;
  chargedMinor: string;
  paidMinor: string;
  refundedMinor: string;
  balanceMinor: string;
}
export const financeApi = {
  report: (from: string, to: string) =>
    getJson<PeriodReport>(
      `/finance/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  reservation: (number: string) =>
    getJson<ReservationFinance>(`/finance/reservations/${encodeURIComponent(number)}`),
  services: () => getJson<ServiceOption[]>('/finance/services'),
  addCharge: (folioId: string, body: unknown) =>
    sendJson<ReservationFinance>(
      'POST',
      `/finance/folios/${encodeURIComponent(folioId)}/charges`,
      body,
    ),
  voidCharge: (chargeId: string) =>
    sendJson<ReservationFinance>(
      'POST',
      `/finance/charges/${encodeURIComponent(chargeId)}/void`,
      {},
    ),
  pay: (body: unknown) => sendJson<ReservationFinance>('POST', '/finance/payments', body),
  /** Ручное закрытие счёта — только при нулевом балансе */
  addStayExtra: (folioId: string, extra: 'EARLY_CHECK_IN' | 'LATE_CHECK_OUT', time?: string) =>
    sendJson<ReservationFinance>(
      'POST',
      `/finance/folios/${encodeURIComponent(folioId)}/stay-extras`,
      time ? { extra, time } : { extra },
    ),
  closeFolio: (folioId: string) =>
    sendJson<ReservationFinance>(
      'POST',
      `/finance/folios/${encodeURIComponent(folioId)}/close`,
      {},
    ),
  refund: (paymentId: string, body: unknown) =>
    sendJson<ReservationFinance>(
      'POST',
      `/finance/payments/${encodeURIComponent(paymentId)}/refunds`,
      body,
    ),
};

// ── Рабочий день стойки ──
export interface DeskRow {
  itemId: string;
  confirmationNumber: string;
  guestLabel: string;
  guestPhone: string | null;
  unitCode: string | null;
  accommodationTypeName: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
  balanceMinor: string;
  citizenship: string | null;
  adults: number;
  guestsRecorded: number;
  blockedReason: string | null;
}
export interface DeskDay {
  date: string;
  arrivals: DeskRow[];
  departures: DeskRow[];
  inHouse: DeskRow[];
  counts: {
    arrivals: number;
    departures: number;
    inHouse: number;
    toCheckIn: number;
    toCheckOut: number;
  };
  debtMinor: string;
}
export const deskApi = {
  today: (date?: string) =>
    getJson<DeskDay>(`/desk/today${date ? `?date=${encodeURIComponent(date)}` : ''}`),
};

// ───────────── Аналитика сайта (срез 8) ─────────────
export interface TrackedSite {
  id: string;
  name: string;
  hosts: string[];
  publicKey: string;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: string;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  /** Виджет бронирования (срез 9) */
  bookingEnabled: boolean;
  bookingRatePlan: { id: string; code: string; name: string } | null;
}
export interface TrackedSiteCard {
  site: TrackedSite;
  status: { lastEventAt: string | null; sessionsToday: number; pageviewsToday: number };
  snippet: {
    key: string;
    scriptUrl: string;
    code: string;
    demoUrl: string;
    bookingCode: string;
    bookingDemoUrl: string;
  };
}
export interface SiteReport {
  site: { id: string; name: string };
  period: { from: string; to: string; timezone: string };
  summary: {
    sessions: number;
    visitors: number;
    pageviews: number;
    pagesPerSession: number;
    avgDurationSeconds: number;
    mobileSessions: number;
    mobileShare: number;
    bounces: number;
    bounceRate: number;
    bookings: number;
  };
  daily: Array<{
    date: string;
    sessions: number;
    visitors: number;
    pageviews: number;
    mobile: number;
  }>;
  sources: Array<{
    kind: 'DIRECT' | 'SEARCH' | 'SOCIAL' | 'PAID' | 'EMAIL' | 'REFERRAL';
    source: string | null;
    sessions: number;
    visitors: number;
    pageviews: number;
    avgDurationSeconds: number;
    share: number;
    bookings: number;
  }>;
  pages: Array<{ path: string; views: number; share: number }>;
  demand: Array<{ arrival: string; searches: number }>;
  events: Array<{ name: string; count: number; sessions: number }>;
  devices: {
    devices: Array<{ key: string | null; sessions: number; share: number }>;
    browsers: Array<{ key: string | null; sessions: number; share: number }>;
    os: Array<{ key: string | null; sessions: number; share: number }>;
  };
}
export const analyticsApi = {
  sites: () => getJson<TrackedSite[]>('/analytics/sites'),
  card: (id: string) => getJson<TrackedSiteCard>(`/analytics/sites/${encodeURIComponent(id)}`),
  create: (body: { name: string; hosts: string[] }) =>
    sendJson<TrackedSiteCard>('POST', '/analytics/sites', body),
  update: (
    id: string,
    body: {
      name?: string;
      hosts?: string[];
      status?: 'ACTIVE' | 'PAUSED';
      bookingEnabled?: boolean;
      bookingRatePlanCode?: string | null;
    },
  ) => sendJson<TrackedSiteCard>('PATCH', `/analytics/sites/${encodeURIComponent(id)}`, body),
  remove: (id: string) =>
    sendJson<{ deleted: true }>('DELETE', `/analytics/sites/${encodeURIComponent(id)}`, {}),
  report: (id: string, from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return getJson<SiteReport>(
      `/analytics/sites/${encodeURIComponent(id)}/report${qs ? `?${qs}` : ''}`,
    );
  },
};

// ───────────────────────── Сторож системы (срез 11, ADR-028) ─────────────────────────

export type IncidentClass = 'A' | 'B' | 'C';
export type IncidentStatus = 'OPEN' | 'FIXING' | 'ESCALATED' | 'ACKNOWLEDGED' | 'RESOLVED';
/** Неисправность из одного места (DATA_MODEL §12). Без ФИО и телефонов — только номера и коды. */
export interface Incident {
  id: string;
  kind: string;
  class: IncidentClass;
  severity: 'CRITICAL' | 'WARNING';
  status: IncidentStatus;
  title: string;
  subjectType: string | null;
  subjectId: string | null;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  fixAttempts: number;
  lastFixAt: string | null;
  lastFixResult: string | null;
  alertedAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: 'GUARD' | 'AGENT' | 'STAFF' | null;
}
export interface GuardStatus {
  running: boolean;
  autofix: boolean;
  propertyLive: boolean;
  notifier: { configured: boolean; recipients: number };
  dbDownSince: string | null;
  lastTick: {
    at: string;
    durationMs: number;
    dbOk: boolean;
    checked: string[];
    checkErrors: Array<{ check: string; error: string }>;
    alertError: string | null;
  } | null;
  open: { total: number; critical: number; escalated: number };
}
export const guardApi = {
  status: () => getJson<GuardStatus>('/guard/status'),
  incidents: (status: 'open' | 'all', limit = 100) =>
    getJson<Incident[]>(`/guard/incidents?status=${status}&limit=${limit}`),
  acknowledge: (id: string) =>
    sendJson<Incident>('POST', `/guard/incidents/${encodeURIComponent(id)}/acknowledge`, {}),
  resolve: (id: string) =>
    sendJson<Incident>('POST', `/guard/incidents/${encodeURIComponent(id)}/resolve`, {}),
  tick: () => sendJson<{ observed: unknown[]; resolved: number }>('POST', '/guard/tick', {}),
};
