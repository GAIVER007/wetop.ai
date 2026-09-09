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
  primaryGuest: { label: string; citizenship: string | null } | null;
  items: Array<{
    id: string;
    accommodationTypeCode: string;
    accommodationTypeName: string;
    arrivalDate: string;
    departureDate: string;
    status: string;
    priceMinor: string;
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
  cancel: (number: string) =>
    sendJson<ReservationCard>('POST', `/reservations/${encodeURIComponent(number)}/cancel`, {}),
  assign: (number: string, itemId: string, body: unknown) =>
    sendJson<ReservationCard>(
      'POST',
      `/reservations/${encodeURIComponent(number)}/items/${encodeURIComponent(itemId)}/assign`,
      body,
    ),
};
