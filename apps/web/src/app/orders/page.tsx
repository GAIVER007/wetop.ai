import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { foodApi, restaurantApi } from '../../lib/food-api';
import { completeFoodList } from '../../lib/food-data';
import type {
  DiningArea,
  DiningTable,
  FoodEmployee,
  MenuCategory,
  MenuItemView,
  OrderView,
} from '../../lib/food-types';
import { OrdersBoard } from '../food/orders-board';
import { restaurantShell } from '../food/restaurant-load';
import type { OrderContext } from '../food/order-drawer';
import '../food/food.css';
import '../food/restaurant.css';

/** «Заказы» ресторана по макету владельца (ADR-159) */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  try {
    const shell = await restaurantShell(date);
    const [orders, open, areas, tables, employees, categories, menuItems] = await Promise.all([
      completeFoodList<OrderView>((cursor) => restaurantApi.orders(shell.date, cursor)),
      completeFoodList<OrderView>((cursor) => restaurantApi.openOrders(cursor)),
      completeFoodList<DiningArea>(foodApi.areas),
      completeFoodList<DiningTable>(foodApi.tables),
      completeFoodList<FoodEmployee>(restaurantApi.employees),
      completeFoodList<MenuCategory>(restaurantApi.categories),
      completeFoodList<MenuItemView>(restaurantApi.menuItems),
    ]);
    const merged = [...new Map([...open, ...orders].map((o) => [o.id, o])).values()].sort(
      (a, b) => b.openedAt.localeCompare(a.openedAt),
    );
    const ctx: OrderContext = {
      scopeKey: shell.scopeKey,
      timezone: shell.timezone,
      write: shell.canDesk && !shell.readOnly,
      areas,
      tables,
      employees,
      categories,
      menuItems,
    };
    return (
      <Page title="Заказы" subtitle="Заказы ресторана за день и всё, что сейчас открыто">
        <div key={shell.scopeKey}>
          <OrdersBoard ctx={ctx} orders={merged} />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Заказы">
        <LoadError testId="orders-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
