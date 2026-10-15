import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi } from '../../lib/food-api';
import { FinanceBoard } from '../food/finance-board';
import { restaurantShell } from '../food/restaurant-load';
import '../food/food.css';
import '../food/restaurant.css';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** «Финансы» ресторана по макету владельца (экран 12): выручка, расходы и поступления из кассы (§35).
 * Период считает сервер (ADR-181): фильтр последних 100 строк в браузере занижал итоги. */
export default async function RestaurantFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  try {
    const shell = await restaurantShell();
    const to = DAY.test(params.to ?? '') ? params.to! : shell.date;
    const from = DAY.test(params.from ?? '') ? params.from! : `${to.slice(0, 8)}01`;
    const cash = await restaurantApi.cash(from <= to ? { from, to } : { from: to, to });
    return (
      <Page title="Финансы">
        <div key={shell.scopeKey}>
          <FinanceBoard cash={cash} timezone={shell.timezone} from={from <= to ? from : to} to={to} />
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
