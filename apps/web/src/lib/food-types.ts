export type FoodStatus = 'BOOKED' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
export interface FoodPage<T> {
  items: T[];
  nextCursor: string | null;
}
export interface DiningArea {
  id: string;
  locationId: string;
  name: string;
  sortOrder: number;
  active: boolean;
}
export interface DiningTable {
  id: string;
  areaId: string;
  name: string;
  capacity: number;
  sortOrder: number;
  active: boolean;
}
export interface ServicePeriod {
  id: string;
  locationId: string;
  name: string;
  weekday: number;
  timeFrom: string;
  timeTo: string;
  endsNextDay: boolean;
  defaultDurationMinutes: number;
  active: boolean;
}
export interface FoodCustomer {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  status: string;
  name?: string;
}
export interface RestaurantReservation {
  id: string;
  locationId: string;
  customerId: string;
  servicePeriodId: string;
  startsAt: string;
  endsAt: string;
  partySize: number;
  status: FoodStatus;
  source: 'DESK' | 'WALK_IN';
  notes: string | null;
  updatedAt: string;
  customer: FoodCustomer;
  servicePeriod: ServicePeriod;
  table: (DiningTable & { areaName: string }) | null;
  nextStatuses: FoodStatus[];
}
export interface FoodToken {
  expectedStatus: FoodStatus;
  expectedUpdatedAt: string;
}
export interface AreaInput {
  name: string;
  sortOrder: number;
  active: boolean;
}
export interface TableInput extends AreaInput {
  areaId: string;
  capacity: number;
}
export type PeriodInput = Omit<ServicePeriod, 'id' | 'locationId'>;
export interface ReservationInput {
  servicePeriodId: string;
  startsAt: string;
  partySize: number;
  customerId?: string;
  customer?: { firstName: string; lastName?: string; phone?: string };
  tableId?: string;
  notes?: string | null;
  source: 'DESK' | 'WALK_IN';
}
export type ReservationPatch = FoodToken &
  Partial<Pick<ReservationInput, 'servicePeriodId' | 'startsAt' | 'partySize' | 'notes'>>;
export interface FoodCatalog {
  areas: DiningArea[];
  tables: DiningTable[];
  periods: ServicePeriod[];
  customers: FoodCustomer[];
}
export interface FoodWorkspace extends FoodCatalog {
  reservations: RestaurantReservation[];
  date: string;
  time: string;
  timezone: string;
  scopeKey: string;
  readOnly: boolean;
  canDesk: boolean;
  canProperty: boolean;
}
