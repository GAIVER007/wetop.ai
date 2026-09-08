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
