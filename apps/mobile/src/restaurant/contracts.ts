export type RestaurantTable = {
  id: string;
  name: string;
  capacity: number;
  areaName: string;
  busy: boolean;
  mine: boolean;
  needsCleaning: boolean;
};
export type RestaurantTables = {
  me: { id: string; name: string } | null;
  tables: RestaurantTable[];
};
export type RestaurantOrder = {
  id: string;
  number: number;
  status: string;
  table: { id: string; name: string } | null;
  waiter: { id: string; name: string } | null;
  guestCount: number;
  totalMinor: string;
  paidMinor: string;
  currency: string;
  updatedAt: string;
  delayed: boolean;
  items: {
    id: string;
    name: string;
    qty: number;
    priceMinor: string;
    station?: string;
    status?: string;
  }[];
};
export type RestaurantOrders = { items: RestaurantOrder[]; nextCursor: string | null };
export type MenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  station: string;
};
export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  priceMinor: string;
  currency: string;
  active: boolean;
  photoUrl: string | null;
  modifierGroups: {
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    required: boolean;
    modifiers: { id: string; name: string; priceDeltaMinor: string }[];
  }[];
};
export type MenuPage<T> = { items: T[]; nextCursor: string | null };
