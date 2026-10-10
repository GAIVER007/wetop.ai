import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi } from '../../lib/food-api';
import { completeFoodList } from '../../lib/food-data';
import type { OrderView } from '../../lib/food-types';
import { KitchenBoard } from '../food/kitchen-board';
import { restaurantShell } from '../food/restaurant-load';
import '../food/food.css';
import '../food/restaurant.css';

/** «Кухня (KDS)» по макету владельца (ADR-159): SERVED и CLOSED кухню уже не касаются */
export default async function KitchenPage() {
  try {
    const shell = await restaurantShell();
    const open = await completeFoodList<OrderView>((cursor) => restaurantApi.openOrders(cursor));
    const kitchen = open.filter((o) => o.status !== 'SERVED');
    return (
      <Page title="Кухня" subtitle="Экран кухни: новые, в работе, готово и задержки">
        <div key={shell.scopeKey}>
          <KitchenBoard
            scopeKey={shell.scopeKey}
            timezone={shell.timezone}
            write={shell.canDesk && !shell.readOnly}
            orders={kitchen}
          />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Кухня">
        <LoadError testId="kitchen-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
