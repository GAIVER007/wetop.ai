import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi } from '../../lib/food-api';
import { PayrollBoard, PayrollMonthNav, PayrollTotals } from '../food/payroll-board';
import { restaurantShell } from '../food/restaurant-load';
import { requireFeature } from '../../lib/vertical-guard';
import { HotelPayrollPage } from './hotel-page';
import { serverT } from '../../i18n/server';
import '../food/food.css';
import '../food/restaurant.css';

/** «Зарплата и финансы» ресторана и салона (ADR-159, §33.4, §19.2); выплаты из кассы филиала (§35.3, ADR-165) */
export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const t = await serverT();
  // зарплата у всех направлений (кабинет горничной, решение 22.10.2026); гостиница своим экраном начислений
  const me = await requireFeature('/payroll');
  if (me.context?.vertical === 'HOSPITALITY') return <HotelPayrollPage month={month} />;
  try {
    const shell = await restaurantShell(undefined, ['FOOD_SERVICE', 'BEAUTY']);
    const salon = shell.vertical === 'BEAUTY';
    const chosen = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : shell.date.slice(0, 7);
    const payroll = await restaurantApi.payroll(chosen);
    return (
      <Page
        className="payroll-page"
        title={t('Зарплата')}
        actions={
          <>
            <PayrollTotals payroll={payroll} />
            <PayrollMonthNav month={payroll.month} />
          </>
        }
      >
        <div key={shell.scopeKey}>
          <PayrollBoard
            scopeKey={shell.scopeKey}
            write={shell.canStaff && !shell.readOnly}
            payroll={payroll}
            basis={salon ? 'visits' : 'orders'}
          />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('Зарплата')}>
        <LoadError testId="payroll-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
