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

const API = process.env.APP_API_URL ?? 'http://127.0.0.1:3001';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`API ${path}: HTTP ${res.status}`);
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
export interface Chessboard {
  from: string;
  to: string;
  dates: string[];
  rows: ChessboardRow[];
  summary: Record<string, { occupied: number; blocked: number; free: number }>;
  byCategory: Record<
    string,
    Record<string, { units: number; occupied: number; blocked: number; free: number }>
  >;
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
async function sendJson<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
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
  mapping: () => getJson<ChannelMappingRow[]>('/channels/channex/mapping'),
  outbox: () => getJson<OutboxSummary>('/channels/channex/outbox'),
  setup: () => sendJson<unknown>('POST', '/channels/channex/setup', {}),
  sync: (days = 365) =>
    sendJson<{ from: string; to: string; tasks: string[] }>(
      'POST',
      `/channels/channex/sync?days=${days}`,
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
  const res = await fetch(`${API}${path}`, { method: 'DELETE', cache: 'no-store' });
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
