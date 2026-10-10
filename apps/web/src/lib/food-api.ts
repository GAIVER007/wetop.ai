import { getJsonPublic, sendJson } from './api';
import type {
  AreaInput,
  DiningArea,
  DiningTable,
  FoodCustomer,
  FoodEmployee,
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
  tableCleaning: (id: string, needsCleaning: boolean) =>
    sendJson<{ id: string }>('POST', `${idPath('tables', id)}/cleaning`, { needsCleaning }),
  report: (date: string) => getJsonPublic<FoodReport>(`${base}/report?date=${date}`),
  employees: (cursor?: string) =>
    getJsonPublic<FoodPage<FoodEmployee>>(`${base}/employees${query(cursor)}`),
  createEmployee: (body: { name: string; phone?: string | null; email?: string | null }) =>
    sendJson<FoodEmployee>('POST', `${base}/employees`, body),
  updateEmployee: (
    id: string,
    body: { name?: string; phone?: string | null; email?: string | null; status?: string },
  ) => sendJson<FoodEmployee>('PATCH', idPath('employees', id), body),
  payroll: (month: string) => getJsonPublic<PayrollView>(`${base}/payroll?month=${month}`),
  setPaySettings: (id: string, body: { model: PayModel; fixedMinor: number; percent: number }) =>
    sendJson<unknown>('PUT', `${idPath('employees', id)}/pay-settings`, body),
  addPayAdjustment: (id: string, body: { period: string; amountMinor: number; reason: string }) =>
    sendJson<unknown>('POST', `${idPath('employees', id)}/pay-adjustments`, body),
};
