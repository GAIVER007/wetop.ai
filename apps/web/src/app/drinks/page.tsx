import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { serverT } from '../../i18n/server';
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
import { BarBoard } from '../food/bar-board';
import { restaurantShell } from '../food/restaurant-load';
import type { OrderContext } from '../food/order-drawer';
import '../food/food.css';
import '../food/restaurant.css';

/** «Напитки» (бар) ресторана по макету владельца (экран 7): позиции станции «Бар» (§33.6) и витрина напитков меню */
export default async function DrinksPage() {
  const t = await serverT();
  try {
    const shell = await restaurantShell();
    const [open, areas, tables, employees, categories, menuItems] = await Promise.all([
      completeFoodList<OrderView>((cursor) => restaurantApi.openOrders(cursor)),
      completeFoodList<DiningArea>(foodApi.areas),
      completeFoodList<DiningTable>(foodApi.tables),
      completeFoodList<FoodEmployee>(restaurantApi.employees),
      completeFoodList<MenuCategory>(restaurantApi.categories),
      completeFoodList<MenuItemView>(restaurantApi.menuItems),
    ]);
    const ctx: OrderContext = {
      scopeKey: shell.scopeKey,
      timezone: shell.timezone,
      write: shell.canDesk && !shell.readOnly,
      refunds: shell.canRefunds && !shell.readOnly,
      areas,
      tables,
      employees,
      categories,
      menuItems,
    };
    return (
      <Page title={t('Напитки')}>
        <div key={shell.scopeKey}>
          <BarBoard ctx={ctx} orders={open} />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('Напитки')}>
        <LoadError testId="drinks-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
