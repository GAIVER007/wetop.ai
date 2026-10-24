import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { serverT } from '../../i18n/server';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi } from '../../lib/food-api';
import { completeFoodList } from '../../lib/food-data';
import type { MenuCategory, MenuItemView, OrderView } from '../../lib/food-types';
import { restaurantShell } from '../food/restaurant-load';
import { WaiterBoard } from './waiter-board';
import '../food/food.css';
import '../food/restaurant.css';
import './waiter.css';

/**
 * «Принять заказ» с телефона официанта (решение владельца 22.10.2026, DATA_MODEL §33.6): столы зала, затем стол, меню,
 * корзина и «Отправить»; позиции уходят на кухню и в бар по станции категории. Свои открытые заказы со статусом позиций.
 * Открыт «Личному кабинету» ресторана (право `orders`) и всем ролям стойки.
 */
export default async function WaiterPage() {
  const t = await serverT();
  try {
    const shell = await restaurantShell();
    const [floor, categories, menuItems, open] = await Promise.all([
      restaurantApi.waiterTables(),
      completeFoodList<MenuCategory>(restaurantApi.categories),
      completeFoodList<MenuItemView>(restaurantApi.menuItems),
      completeFoodList<OrderView>((cursor) => restaurantApi.openOrders(cursor)),
    ]);
    // у стойки API отдаёт все заказы: официант с привязанным сотрудником видит свои
    const mine = floor.me ? open.filter((o) => o.waiter?.id === floor.me!.id) : open;
    return (
      <Page title={t('Принять заказ')} width="full" className="waiter-page">
        <div key={shell.scopeKey}>
          <WaiterBoard
            scopeKey={shell.scopeKey}
            timezone={shell.timezone}
            write={!shell.readOnly}
            me={floor.me}
            tables={floor.tables}
            categories={categories}
            menuItems={menuItems}
            orders={mine}
          />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('Принять заказ')}>
        <LoadError testId="waiter-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
