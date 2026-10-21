import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi } from '../../lib/food-api';
import { CashBoard } from '../food/cash-board';
import { restaurantShell } from '../food/restaurant-load';
import '../food/food.css';
import '../food/restaurant.css';
import '../finance/summary.css';

/** «Касса» филиала ресторана и салона (DATA_MODEL §35.2, §48, ADR-165): остатки по способам, операции и сверка */
export default async function CashboxPage() {
  try {
    const shell = await restaurantShell(undefined, ['FOOD_SERVICE', 'BEAUTY']);
    const cash = await restaurantApi.cash();
    return (
      <Page
        title="Касса"
        subtitle={
          shell.vertical === 'BEAUTY'
            ? 'Деньги салона по способам оплаты: приходы, расходы и выплаты'
            : 'Деньги филиала по способам оплаты: заказы, приходы, расходы и выплаты'
        }
      >
        <div key={shell.scopeKey}>
          <CashBoard
            scopeKey={shell.scopeKey}
            timezone={shell.timezone}
            write={shell.canDesk && !shell.readOnly}
            refunds={shell.canRefunds && !shell.readOnly}
            cash={cash}
            orders={shell.vertical === 'FOOD_SERVICE'}
          />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Касса">
        <LoadError testId="cashbox-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
