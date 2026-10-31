import { unstable_rethrow } from 'next/navigation';
import type { SearchParams } from '../../lib/search-params';
import FinanceReportPage from '../finance/page';
import { requireFeature } from '../../lib/vertical-guard';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi } from '../../lib/food-api';
import { CashBoard } from '../food/cash-board';
import { restaurantShell } from '../food/restaurant-load';
import '../food/food.css';
import '../food/restaurant.css';
import '../finance/summary.css';
import { serverT } from '../../i18n/server';

/** «Касса» филиала ресторана и салона (DATA_MODEL §35.2, §48, ADR-165): остатки по способам, операции и сверка */
export default async function CashboxPage({
  searchParams = Promise.resolve({}),
}: { searchParams?: Promise<SearchParams> } = {}) {
  const t = await serverT();
  // гостиница (31.10.2026, «в финансах обзор и касса»): касса вкладкой её «Финансов», пункт меню «Касса» свой
  if ((await requireFeature('/cashbox')).context?.vertical === 'HOSPITALITY')
    return <FinanceReportPage searchParams={searchParams} view="cash" />;
  try {
    const shell = await restaurantShell(undefined, ['FOOD_SERVICE', 'BEAUTY']);
    const cash = await restaurantApi.cash();
    return (
      <Page
        title={t('Касса')}
        subtitle={
          shell.vertical === 'BEAUTY'
            ? t('Деньги салона по способам оплаты: приходы, расходы и выплаты')
            : t('Деньги филиала по способам оплаты: заказы, приходы, расходы и выплаты')
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
      <Page title={t('Касса')}>
        <LoadError testId="cashbox-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
