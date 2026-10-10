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
  /** Статус «Уборка» на плане зала (§33.3) */
  needsCleaning?: boolean;
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
  /** Посещения (посажен или завершён) в этом филиале; «Постоянный гость» от двух (ADR-159) */
  visits?: number;
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
  /** Открытые заказы для занятости столов на плане зала (ADR-159); грузятся только для плана */
  orders?: OrderView[];
  date: string;
  time: string;
  timezone: string;
  scopeKey: string;
  readOnly: boolean;
  canDesk: boolean;
  canProperty: boolean;
}

// ── Ресторан v2 (§33, ADR-159): меню, заказы, кухня, сотрудники, зарплата ──
export type OrderStatus = 'NEW' | 'COOKING' | 'READY' | 'SERVED' | 'CLOSED' | 'CANCELLED';
export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
}
export interface MenuIngredient {
  id: string;
  name: string;
  normQty: string;
  unit: string;
  unitCostMinor: string;
  costMinor: string;
}
export interface MenuTotals {
  costMinor: string;
  profitMinor: string;
  foodCostPct: number | null;
  marginPct: number | null;
}
export interface MenuItemView {
  id: string;
  categoryId: string;
  name: string;
  weightGrams: number | null;
  priceMinor: string;
  currency: string;
  active: boolean;
  techNotes: string | null;
  sortOrder: number;
  updatedAt: string;
  ingredients?: MenuIngredient[];
  totals?: MenuTotals | null;
}
export interface MenuCategoryInput {
  name: string;
  sortOrder?: number;
  active?: boolean;
}
export interface MenuItemInput {
  categoryId: string;
  name: string;
  price: number;
  weightGrams?: number | null;
  active?: boolean;
  techNotes?: string | null;
  sortOrder?: number;
}
export interface IngredientInput {
  name: string;
  normQty: string;
  unit: 'г' | 'мл' | 'шт';
  unitCost: number;
}
export interface OrderItemView {
  id: string;
  menuItemId: string | null;
  name: string;
  priceMinor: string;
  qty: number;
  notes: string | null;
}
export interface OrderView {
  id: string;
  number: number;
  status: OrderStatus;
  tableId: string | null;
  table: { id: string; name: string; areaName: string } | null;
  waiter: { id: string; name: string } | null;
  guestCount: number;
  notes: string | null;
  totalMinor: string;
  currency: string;
  openedAt: string;
  cookingAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
  delayed: boolean;
  nextStatuses: OrderStatus[];
  items: OrderItemView[];
}
export interface OrderToken {
  expectedStatus: OrderStatus;
  expectedUpdatedAt: string;
}
export interface OrderItemInput {
  menuItemId: string;
  qty: number;
  notes?: string | null;
}
export interface OrderCreateInput {
  tableId?: string | null;
  waiterId?: string | null;
  guestCount: number;
  notes?: string | null;
  items: OrderItemInput[];
}
export type OrderPatch = OrderToken &
  Partial<Pick<OrderCreateInput, 'tableId' | 'waiterId' | 'guestCount' | 'notes' | 'items'>>;
export interface FoodReportTiles {
  tablesOccupied: number;
  tablesTotal: number;
  ordersCount: number;
  ordersDeltaPct: number | null;
  revenueMinor: string;
  revenueDeltaPct: number | null;
  kitchenQueue: number;
  kitchenAvgWaitMinutes: number | null;
  staffOnShift: number;
  staffTotal: number;
}
export interface FoodReport {
  date: string;
  currency: string;
  tiles: FoodReportTiles;
  hourlyRevenueMinor: string[];
  latestOrders: OrderView[];
}
export interface FoodEmployee {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  shift: string | null;
  onShift: boolean;
  salesTodayMinor: string;
}
export type PayModel = 'FIXED' | 'PERCENT' | 'FIXED_PLUS_PERCENT' | 'BONUS_ONLY';
export interface PayrollRow {
  employeeId: string;
  name: string;
  status: string;
  model: PayModel;
  fixedMinor: string;
  percent: number;
  salesMinor: string;
  baseMinor: string;
  percentMinor: string;
  bonusMinor: string;
  penaltyMinor: string;
  totalMinor: string;
}
export interface PayrollView {
  month: string;
  currency: string;
  totals: { fundMinor: string; bonusMinor: string; penaltyMinor: string; payoutMinor: string };
  rows: PayrollRow[];
  adjustments: Array<{
    id: string;
    employeeId: string;
    amountMinor: string;
    reason: string;
    createdAt: string;
  }>;
}
