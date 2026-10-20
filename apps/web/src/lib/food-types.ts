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
  /** Схема зала (§42): центр на полотне зоны 0–1000; null значит «не расставлен» */
  posX?: number | null;
  posY?: number | null;
  shape?: 'ROUND' | 'SQUARE' | 'RECT' | null;
  scale?: number;
  rotation?: number;
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
  /** Ручная метка VIP и дата рождения (§36, ADR-166) */
  isVip?: boolean;
  birthDate?: string | null;
  /** Через сколько дней день рождения по дате филиала: 0 сегодня */
  birthdayInDays?: number | null;
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
  /** §38: ингредиент склада, null — строка не списывается */
  productId?: string | null;
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
  /** Подписанный адрес фото блюда на время (§37); null, если фото нет или хранилище выключено */
  photoUrl?: string | null;
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
  productId?: string | null;
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
  /** Сумма действующих платежей (§35.1) */
  paidMinor: string;
  /** Сумма действующих возвратов после закрытия (§56) */
  refundedMinor: string;
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
  payments: OrderPaymentView[];
  /** §56: возвраты после закрытия, операции кассы */
  refunds: OrderRefundView[];
  /** §39: оценка гостя после оплаты */
  rating?: { stars: number; comment: string | null; createdAt: string } | null;
}
export type FoodPaymentMethod =
  | 'CASH'
  | 'CARD_TERMINAL'
  | 'KASPI'
  | 'HALYK'
  | 'BANK_TRANSFER_PERSON'
  | 'BANK_TRANSFER_LEGAL';
export const FOOD_PAYMENT_METHODS: FoodPaymentMethod[] = [
  'CASH',
  'CARD_TERMINAL',
  'KASPI',
  'HALYK',
  'BANK_TRANSFER_PERSON',
  'BANK_TRANSFER_LEGAL',
];
export interface OrderPaymentView {
  id: string;
  method: FoodPaymentMethod;
  amountMinor: string;
  status: 'COMPLETED' | 'VOIDED';
  paidAt: string;
  voidReason: string | null;
}
/** Возврат по закрытому заказу (§56): расход кассы филиала */
export interface OrderRefundView {
  id: string;
  method: FoodPaymentMethod;
  amountMinor: string;
  status: 'COMPLETED' | 'VOIDED';
  note: string | null;
  occurredAt: string;
}
/** Касса филиала (§35.2) */
export interface FoodCashView {
  currency: string;
  balances: Array<{ method: FoodPaymentMethod; balanceMinor: string }>;
  operations: Array<{
    id: string;
    kind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    method: FoodPaymentMethod;
    methodTo: FoodPaymentMethod | null;
    amountMinor: string;
    note: string | null;
    employee: string | null;
    period: string | null;
    /** возврат гостю по записи или заказу (§54, §56) */
    refund?: boolean;
    status: 'COMPLETED' | 'VOIDED';
    occurredAt: string;
    /** H1 (паритет с zapis.kz): операция оплаты или возврата записи ссылается на неё */
    appointmentId?: string | null;
    appointmentStartsAt?: string | null;
  }>;
  payments: Array<{
    id: string;
    orderNumber: number;
    method: FoodPaymentMethod;
    amountMinor: string;
    status: 'COMPLETED' | 'VOIDED';
    paidAt: string;
  }>;
  reconciliations: Array<{
    id: string;
    method: FoodPaymentMethod;
    expectedMinor: string;
    countedMinor: string;
    note: string | null;
    createdAt: string;
  }>;
}
export interface FoodCashOperationInput {
  idempotencyKey?: string;
  kind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  method: FoodPaymentMethod;
  methodTo?: FoodPaymentMethod;
  amount: number;
  note?: string | null;
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
  profileRevision: string;
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  shift: string | null;
  onShift: boolean;
  salesTodayMinor: string;
  /** §39: рейтинг по оценкам гостей; average null, пока оценок нет */
  rating?: { average: number | null; count: number };
  /** Назначение в «Персонале» (решение владельца 20.10.2026); null = не назначено */
  personnelKind?: 'SPECIALIST' | 'OTHER_EMPLOYEE' | 'BOTH' | null;
}
/** График смен (Q-REST-11): неделя с понедельника, у выходного дня список пуст */
export interface FoodShiftWeekDay {
  weekday: number;
  intervals: Array<{ timeFrom: string; timeTo: string }>;
}
export interface FoodShiftRow {
  id: string;
  name: string;
  week: FoodShiftWeekDay[];
  weekRevision: string;
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
  /** Выплачено из кассы за месяц и остаток (§35.3) */
  paidMinor: string;
  remainingMinor: string;
}
export interface PayrollView {
  month: string;
  currency: string;
  totals: {
    fundMinor: string;
    bonusMinor: string;
    penaltyMinor: string;
    payoutMinor: string;
    paidMinor: string;
  };
  rows: PayrollRow[];
  adjustments: Array<{
    id: string;
    employeeId: string;
    amountMinor: string;
    reason: string;
    createdAt: string;
  }>;
}

// ── Склад кухни FS2 (DATA_MODEL §34, ADR-KITCHEN-FS). Количества строками («2.5»), деньги строками в minor units ──
export type StockUnit = 'г' | 'мл' | 'шт';
export interface StockProductView {
  id: string;
  name: string;
  unit: StockUnit;
  minQty: string;
  active: boolean;
  onHand: string;
  valueMinor: string;
  low: boolean;
  nearestExpiry: string | null;
}
export interface StockLotView {
  id: string;
  productId: string;
  supplier: string | null;
  document: string | null;
  receivedOn: string;
  receivedQty: string;
  remainingQty: string;
  unitCostMinor: string;
  expiresOn: string | null;
  reversed: boolean;
  reversible: boolean;
}
export type StockMovementKind =
  | 'RECEIPT'
  | 'WRITE_OFF'
  | 'INVENTORY'
  | 'REVERSAL'
  | 'CONSUMPTION'
  | 'SHORTAGE'
  | 'CONSUMPTION_RETURN';
export interface StockMovementView {
  id: string;
  productId: string;
  productName: string;
  unit: StockUnit;
  lotId: string | null;
  kind: StockMovementKind;
  qty: string;
  costMinor: string;
  reason: string | null;
  createdAt: string;
}
export interface StockProductInput {
  name: string;
  unit: StockUnit;
  minQty?: string;
  active?: boolean;
}
export interface StockReceiptInput {
  supplier?: string | null;
  document?: string | null;
  receivedOn?: string | null;
  lines: Array<{ productId: string; qty: string; unitCost: number; expiresOn?: string | null }>;
}
/** Отчёт ресторана за период (Аналитика): закрытые заказы, оплаты по способам, блюда, официанты */
export interface FoodPeriodReport {
  from: string;
  to: string;
  currency: string;
  ordersCount: number;
  /** гости закрытых заказов периода */
  guestsCount?: number;
  revenueMinor: string;
  /** выручка бара периода отдельным полем (ADR-182): POSTED-продажи по дате продажи */
  barRevenueMinor?: string;
  averageCheckMinor: string | null;
  payments: Array<{ method: string; amountMinor: string; count: number }>;
  topDishes: Array<{ name: string; qty: number; revenueMinor: string }>;
  waiters: Array<{ name: string; orders: number; revenueMinor: string }>;
  /** §38: себестоимость проданного по ленте склада, валовая прибыль, фудкост и недостачи */
  costMinor: string;
  grossProfitMinor: string;
  foodCostPct: number | null;
  shortages: Array<{ name: string; unit: string; qty: string }>;
  /** выручка закрытых заказов по дням периода (пояс филиала), каждый день периода */
  revenueByDay?: Array<{ date: string; revenueMinor: string; orders: number }>;
  /** продажи по категориям меню, по убыванию */
  categories?: Array<{ name: string; revenueMinor: string }>;
}
