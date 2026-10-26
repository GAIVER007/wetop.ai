import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { restaurantApi } from '../../../lib/food-api';
import { requireFeature } from '../../../lib/vertical-guard';
import { restaurantShell } from '../../food/restaurant-load';
import { ShiftsBoard } from '../../food/shifts-board';
import { serverT } from '../../../i18n/server';
import '../../food/food.css';
import '../../food/restaurant.css';
import '../../beauty/beauty.css';

/** «График смен» ресторана (Q-REST-11): смотрят все роли стойки, меняет право «сотрудники» */
export default async function ShiftsPage() {
  await requireFeature('/employees/shifts');
  const t = await serverT();
  try {
    const shell = await restaurantShell();
    const { employees } = await restaurantApi.shifts();
    return (
      <Page className="schedule-page" title={t('График работы')} subtitle={t('Обычная неделя сотрудников ресторана')}>
        <div key={shell.scopeKey}>
          <ShiftsBoard scopeKey={shell.scopeKey} write={shell.canStaff && !shell.readOnly} employees={employees} />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('График работы')}>
        <LoadError testId="shifts-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
