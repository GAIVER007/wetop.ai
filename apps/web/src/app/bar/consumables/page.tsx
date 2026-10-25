import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { deskShell } from '../../../lib/desk-shell';
import { stockApi } from '../../../lib/food-api';
import { mayAccess, mayBeautyAccess } from '../../../lib/navigation';
import { requireFeature } from '../../../lib/vertical-guard';
import { selectedWorkspaceBranch, workspaceTimezone } from '../../../lib/workspace-context';
import { StockBoard } from '../../food/stock-board';
import { BarTabs } from '../tabs';
import { StockInsightsView } from '../../food/stock-insights';
import { buildStockInsights } from '../../food/stock-insights-data';
import { loadBarContext } from '../load-context';
import '../../food/food.css';
import '../../food/restaurant.css';
import '../bar.css';
import { serverT } from '../../../i18n/server';

export default async function BeautyConsumablesPage() {
  const me = await requireFeature('/bar/consumables');
  const t = await serverT();
  try {
    const [shell, branch, products, movements] = await Promise.all([
      deskShell(),
      selectedWorkspaceBranch(),
      stockApi.products(),
      stockApi.movements(),
    ]);
    const beauty = me.context?.vertical === 'BEAUTY';
    // у гостиницы валюта в её объекте (филиалов гостиницы в списке филиалов нет), у салона в филиале
    const hotel = beauty ? null : await loadBarContext();
    const currency = beauty ? branch?.currency : hotel?.currency;
    const scopeKey = shell.scopeKey ?? hotel?.propertyId;
    if (!currency || !scopeKey) throw new Error(t('Сначала выберите филиал'));
    // салон решает по матрице должностей, гостиница по ролям: справочник `property`, приход и списания `desk`
    const may = (action: 'create' | 'update' | 'delete') =>
      !shell.readOnly && mayBeautyAccess(shell.access, 'stock', action, { legacy: 'settings' });
    const rights = beauty
      ? { canCreate: may('create'), canUpdate: may('update'), canDelete: may('delete') }
      : { canDesk: !shell.readOnly && mayAccess(shell.access, 'desk'), canProperty: !shell.readOnly && mayAccess(shell.access, 'property') };
    return (
      <Page
        width="wide"
        className="bar-subpage"
        title={t('Склад: кухня')}
        subtitle={beauty ? t('Материалы для услуг, приходы, списания и остатки') : t('Продукты и материалы, приходы, списания и остатки')}
      >
        <BarTabs current="consumables" />
        <div key={scopeKey}>
          <StockInsightsView insights={buildStockInsights(products.items, null)} currency={currency} />
          <StockBoard
            ctx={{
              scopeKey,
              currency,
              timezone: await workspaceTimezone(),
              vertical: beauty ? 'BEAUTY' : 'HOSPITALITY',
              ...rights,
            }}
            products={products.items}
            movements={movements.items}
          />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('Склад: кухня')}>
        <LoadError testId="beauty-consumables-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
