import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi } from '../../lib/food-api';
import { FinanceBoard } from '../food/finance-board';
import { restaurantShell } from '../food/restaurant-load';
import '../food/food.css';
import '../food/restaurant.css';

/** «Финансы» ресторана по макету владельца (экран 12): выручка, расходы и поступления из кассы (§35) */
export default async function RestaurantFinancePage() {
  try {
    const shell = await restaurantShell();
    const cash = await restaurantApi.cash();
    return (
      <Page title="Финансы">
        <div key={shell.scopeKey}>
          <FinanceBoard cash={cash} timezone={shell.timezone} today={shell.date} />
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
