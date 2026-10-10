import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi } from '../../lib/food-api';
import { PayrollBoard } from '../food/payroll-board';
import { restaurantShell } from '../food/restaurant-load';
import '../food/food.css';
import '../food/restaurant.css';

/** «Зарплата и финансы» ресторана (ADR-159, §33.4). Выплат и кассы нет: Q-REST-6 */
export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  try {
    const shell = await restaurantShell();
    const chosen =
      month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : shell.date.slice(0, 7);
    const payroll = await restaurantApi.payroll(chosen);
    return (
      <Page
        title="Зарплата и финансы"
        subtitle="Оклады, процент от заказов, премии и штрафы. Расчёт показательный, выплаты не фиксируются"
      >
        <div key={shell.scopeKey}>
          <PayrollBoard
            scopeKey={shell.scopeKey}
            write={shell.canStaff && !shell.readOnly}
            payroll={payroll}
          />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Зарплата и финансы">
        <LoadError testId="payroll-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
