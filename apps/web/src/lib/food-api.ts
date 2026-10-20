import type { BookingRules, TableLayout } from '@pms/domain';
import { getJsonPublic, sendJson } from './api';
import type {
  FoodShiftRow,
  FoodShiftWeekDay,
  AreaInput,
  DiningArea,
  DiningTable,
  FoodCashOperationInput,
  FoodCashView,
  FoodCustomer,
  FoodEmployee,
  FoodPaymentMethod,
  FoodPage,
  FoodReport,
  FoodStatus,
  FoodToken,
  IngredientInput,
  MenuCategory,
  MenuCategoryInput,
  MenuItemInput,
  MenuItemView,
  OrderCreateInput,
  OrderPatch,
  OrderStatus,
  OrderToken,
  OrderView,
  PayModel,
  PayrollView,
  PeriodInput,
  ReservationInput,
  ReservationPatch,
  RestaurantReservation,
  ServicePeriod,
  TableInput,
  StockLotView,
  StockMovementView,
  StockProductInput,
  StockProductView,
  StockReceiptInput,
} from './food-types';
const base = '/food-service';
const idPath = (collection: string, id: string) =>
  `${base}/${collection}/${encodeURIComponent(id)}`;
const query = (cursor?: string, date?: string) => {
  const q = new URLSearchParams({ limit: '100' });
  if (cursor) q.set('cursor', cursor);
  if (date) q.set('date', date);
  return `?${q}`;
};
export const foodApi = {
  areas: (cursor?: string) => getJsonPublic<FoodPage<DiningArea>>(`${base}/areas${query(cursor)}`),
  createArea: (body: AreaInput) => sendJson<DiningArea>('POST', `${base}/areas`, body),
  updateArea: (id: string, body: Partial<AreaInput>) =>
    sendJson<DiningArea>('PATCH', idPath('areas', id), body),
  /** Правила брони столов (§43): настройки и будущие закрытые дни */
  bookingRules: () =>
    getJsonPublic<{ rules: BookingRules; closedDays: Array<{ id: string; day: string; reason: string | null }> }>(
      `${base}/booking-rules`,
    ),
  setBookingRules: (rules: BookingRules) => sendJson<BookingRules>('PUT', `${base}/booking-rules`, rules),
  addClosedDay: (body: { day: string; reason: string | null }) =>
    sendJson<{ id: string }>('POST', `${base}/closed-days`, body),
  removeClosedDay: (id: string) => sendJson<{ ok: true }>('DELETE', idPath('closed-days', id), {}),
  /** Схема зала (§42): расстановка зоны целиком */
  setLayout: (areaId: string, tables: TableLayout[]) =>
    sendJson<{ tables: TableLayout[] }>('PUT', `${idPath('areas', areaId)}/layout`, { tables }),
  tables: (cursor?: string) =>
    getJsonPublic<FoodPage<DiningTable>>(`${base}/tables${query(cursor)}`),
  createTable: (body: TableInput) => sendJson<DiningTable>('POST', `${base}/tables`, body),
  updateTable: (id: string, body: Partial<Omit<TableInput, 'areaId'>>) =>
    sendJson<DiningTable>('PATCH', idPath('tables', id), body),
  periods: (cursor?: string) =>
    getJsonPublic<FoodPage<ServicePeriod>>(`${base}/service-periods${query(cursor)}`),
  createPeriod: (body: PeriodInput) =>
    sendJson<ServicePeriod>('POST', `${base}/service-periods`, body),
  updatePeriod: (id: string, body: Partial<PeriodInput>) =>
    sendJson<ServicePeriod>('PATCH', idPath('service-periods', id), body),
  customers: (cursor?: string) =>
    getJsonPublic<FoodPage<FoodCustomer>>(`${base}/customers${query(cursor)}`),
  updateCustomer: (id: string, body: { isVip?: boolean; birthDate?: string | null }) =>
    sendJson<{ id: string }>('PATCH', idPath('customers', id), body),
  reservations: (date: string, cursor?: string) =>
    getJsonPublic<FoodPage<RestaurantReservation>>(`${base}/reservations${query(cursor, date)}`),
  create: (body: ReservationInput, key: string) =>
    sendJson<RestaurantReservation>('POST', `${base}/reservations`, body, {
      'Idempotency-Key': key,
    }),
  update: (id: string, body: ReservationPatch) =>
    sendJson<RestaurantReservation>('PATCH', idPath('reservations', id), body),
  status: (id: string, body: FoodToken & { status: FoodStatus }) =>
    sendJson<RestaurantReservation>('POST', `${idPath('reservations', id)}/status`, body),
  assign: (id: string, body: FoodToken & { tableId: string }) =>
    sendJson<RestaurantReservation>('PUT', `${idPath('reservations', id)}/table`, body),
  unassign: (id: string, body: FoodToken) =>
    sendJson<RestaurantReservation>('DELETE', `${idPath('reservations', id)}/table`, body),
};

export const restaurantApi = {
  categories: (cursor?: string) =>
    getJsonPublic<FoodPage<MenuCategory>>(`${base}/menu/categories${query(cursor)}`),
  createCategory: (body: MenuCategoryInput) =>
    sendJson<MenuCategory>('POST', `${base}/menu/categories`, body),
  updateCategory: (id: string, body: Partial<MenuCategoryInput>) =>
    sendJson<MenuCategory>('PATCH', idPath('menu/categories', id), body),
  menuItems: (cursor?: string) =>
    getJsonPublic<FoodPage<MenuItemView>>(`${base}/menu/items${query(cursor)}`),
  menuItem: (id: string) => getJsonPublic<MenuItemView>(idPath('menu/items', id)),
  createMenuItem: (body: MenuItemInput) =>
    sendJson<MenuItemView>('POST', `${base}/menu/items`, body),
  updateMenuItem: (id: string, body: Partial<MenuItemInput>) =>
    sendJson<MenuItemView>('PATCH', idPath('menu/items', id), body),
  replaceIngredients: (id: string, ingredients: IngredientInput[]) =>
    sendJson<MenuItemView>('PUT', `${idPath('menu/items', id)}/ingredients`, { ingredients }),
  orders: (date: string, cursor?: string) =>
    getJsonPublic<FoodPage<OrderView>>(`${base}/orders${query(cursor, date)}`),
  openOrders: (cursor?: string) =>
    getJsonPublic<FoodPage<OrderView>>(`${base}/orders${query(cursor)}&open=1`),
  createOrder: (body: OrderCreateInput) => sendJson<OrderView>('POST', `${base}/orders`, body),
  updateOrder: (id: string, body: OrderPatch) =>
    sendJson<OrderView>('PATCH', idPath('orders', id), body),
  orderStatus: (id: string, body: OrderToken & { status: OrderStatus }) =>
    sendJson<OrderView>('POST', `${idPath('orders', id)}/status`, body),
  payOrder: (id: string, body: { method: FoodPaymentMethod; amount: number; idempotencyKey: string }) =>
    sendJson<OrderView>('POST', `${idPath('orders', id)}/payments`, body),
  rateOrder: (id: string, body: { stars: number; comment: string | null }) =>
    sendJson<OrderView>('POST', `${idPath('orders', id)}/rating`, body),
  /** Ссылка на оценку с телефона гостя (§40): ключ только в ответе, 72 часа */
  ratingLink: (id: string) =>
    sendJson<{ token: string; expiresAt: string }>('POST', `${idPath('orders', id)}/rating-link`, {}),
  voidPayment: (id: string, reason: string) =>
    sendJson<OrderView>('POST', `${idPath('payments', id)}/void`, { reason }),
  /** Возврат по закрытому заказу (§56) */
  refundOrder: (id: string, body: { method: FoodPaymentMethod; amount: number; reason: string; idempotencyKey: string }) =>
    sendJson<OrderView>('POST', `${idPath('orders', id)}/refunds`, body),
  // период считает сервер (ADR-181); без дат прежние последние 100 строк для экрана «Касса»
  cash: (period?: { from: string; to: string }) =>
    getJsonPublic<FoodCashView>(
      `${base}/cash${period ? `?from=${period.from}&to=${period.to}` : ''}`,
    ),
  cashOperation: (body: FoodCashOperationInput) =>
    sendJson<{ id: string }>('POST', `${base}/cash/operations`, body),
  voidCashOperation: (id: string) =>
    sendJson<{ id: string }>('POST', `${idPath('cash/operations', id)}/void`, {}),
  cashReconciliation: (body: { method: FoodPaymentMethod; counted: number; note?: string | null }) =>
    sendJson<{ id: string }>('POST', `${base}/cash/reconciliations`, body),
  payout: (id: string, body: { period: string; method: FoodPaymentMethod; amount: number; idempotencyKey: string }) =>
    sendJson<{ id: string }>('POST', `${idPath('employees', id)}/payouts`, body),
  tableCleaning: (id: string, needsCleaning: boolean) =>
    sendJson<{ id: string }>('POST', `${idPath('tables', id)}/cleaning`, { needsCleaning }),
  report: (date: string) => getJsonPublic<FoodReport>(`${base}/report?date=${date}`),
  employees: (cursor?: string) =>
    getJsonPublic<FoodPage<FoodEmployee>>(`${base}/employees${query(cursor)}`),
  assignEmployeePersonnelKind: (
    id: string,
    body: { personnelKind: 'SPECIALIST' | 'OTHER_EMPLOYEE' | 'BOTH'; expectedProfileRevision: string },
  ) => sendJson<{ id: string }>('PATCH', `${idPath('employees', id)}/personnel-kind`, body),
  createEmployee: (body: {
    name: string;
    phone?: string | null;
    email?: string | null;
    personnelKind?: 'SPECIALIST' | 'OTHER_EMPLOYEE' | 'BOTH';
  }) =>
    sendJson<FoodEmployee>('POST', `${base}/employees`, body),
  updateEmployee: (
    id: string,
    body: { name?: string; phone?: string | null; email?: string | null; status?: string; expectedProfileRevision: string },
  ) => sendJson<FoodEmployee>('PATCH', idPath('employees', id), body),
  shifts: () => getJsonPublic<{ employees: FoodShiftRow[] }>(`${base}/shifts`),
  setShifts: (id: string, intervals: Array<{ weekday: number; timeFrom: string; timeTo: string }>, expectedRevision: string) =>
    sendJson<{ week: FoodShiftWeekDay[]; weekRevision: string }>('PUT', `${idPath('employees', id)}/working-hours`, { intervals, expectedRevision }),
  payroll: (month: string) => getJsonPublic<PayrollView>(`${base}/payroll?month=${month}`),
  setPaySettings: (id: string, body: { model: PayModel; fixedMinor: number; percent: number }) =>
    sendJson<unknown>('PUT', `${idPath('employees', id)}/pay-settings`, body),
  addPayAdjustment: (id: string, body: { period: string; amountMinor: number; reason: string }) =>
    sendJson<unknown>('POST', `${idPath('employees', id)}/pay-adjustments`, body),
};

/** Склад кухни FS2 (DATA_MODEL §34): справочник целиком, движения последние 200 */
export const stockApi = {
  products: () => getJsonPublic<{ items: StockProductView[] }>(`${base}/stock/products`),
  createProduct: (body: StockProductInput) =>
    sendJson<StockProductView>('POST', `${base}/stock/products`, body),
  updateProduct: (id: string, body: Partial<StockProductInput>) =>
    sendJson<StockProductView>('PATCH', idPath('stock/products', id), body),
  lots: (productId: string) =>
    getJsonPublic<{ items: StockLotView[] }>(
      `${base}/stock/lots?productId=${encodeURIComponent(productId)}`,
    ),
  movements: () => getJsonPublic<{ items: StockMovementView[] }>(`${base}/stock/movements`),
  receipt: (body: StockReceiptInput) =>
    sendJson<{ items: StockLotView[] }>('POST', `${base}/stock/receipts`, body),
  reverseLot: (id: string) =>
    sendJson<StockLotView>('POST', `${idPath('stock/lots', id)}/reverse`, {}),
  writeOff: (body: { productId: string; qty: string; reason: string }) =>
    sendJson<StockProductView>('POST', `${base}/stock/write-offs`, body),
  inventory: (body: { productId: string; actualQty: string; reason?: string | null }) =>
    sendJson<StockProductView>('POST', `${base}/stock/inventory`, body),
};

