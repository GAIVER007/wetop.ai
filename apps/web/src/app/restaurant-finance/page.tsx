import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi } from '../../lib/food-api';
import { FinanceBoard } from '../food/finance-board';
import { restaurantShell } from '../food/restaurant-load';
import '../food/food.css';
import '../food/restaurant.css';

import { financeDateRange } from '../../lib/finance-period';
import type { SearchParams } from '../../lib/search-params';

/** «Финансы» ресторана по макету владельца (экран 12): выручка, расходы и поступления из кассы (§35).
 * Период считает сервер (ADR-181): фильтр последних 100 строк в браузере занижал итоги. */
export default async function RestaurantFinancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  try {
    const shell = await restaurantShell();
    // Тот же предел, что в RestaurantService.cash: не смешиваем его с гостиничным годом.
    const { from, to } = financeDateRange(params, shell.date, { period: 'month', maxDays: 93 });
    const cash = await restaurantApi.cash({ from, to });
    return (
      <Page title="Финансы">
        <div key={shell.scopeKey}>
          <FinanceBoard cash={cash} timezone={shell.timezone} from={from} to={to} />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Финансы">
        <LoadError testId="restaurant-finance-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
