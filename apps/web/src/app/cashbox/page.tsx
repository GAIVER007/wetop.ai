import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi } from '../../lib/food-api';
import { CashBoard } from '../food/cash-board';
import { restaurantShell } from '../food/restaurant-load';
import '../food/food.css';
import '../food/restaurant.css';

/** «Касса» ресторана (DATA_MODEL §35.2, ADR-165): остатки по способам, операции и сверка */
export default async function CashboxPage() {
  try {
    const shell = await restaurantShell();
    const cash = await restaurantApi.cash();
    return (
      <Page
        className="restaurant-page"
        title="Касса"
        subtitle="Деньги филиала по способам оплаты: заказы, приходы, расходы и выплаты"
      >
        <div key={shell.scopeKey}>
          <CashBoard
            scopeKey={shell.scopeKey}
            timezone={shell.timezone}
            write={shell.canDesk && !shell.readOnly}
            refunds={shell.canRefunds && !shell.readOnly}
            cash={cash}
          />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page className="restaurant-page" title="Касса">
        <LoadError testId="cashbox-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
