import { getJsonPublic, sendJson } from './api';
import type {
  AreaInput,
  DiningArea,
  DiningTable,
  FoodCustomer,
  FoodPage,
  FoodStatus,
  FoodToken,
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
