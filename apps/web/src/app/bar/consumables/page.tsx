import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { deskShell } from '../../../lib/desk-shell';
import { stockApi } from '../../../lib/food-api';
import { mayAccess, mayBeautyAccess } from '../../../lib/navigation';
import { requireFeature } from '../../../lib/vertical-guard';
import { selectedWorkspaceBranch } from '../../../lib/workspace-context';
import { StockBoard } from '../../food/stock-board';
import { BarTabs } from '../tabs';
import '../../food/food.css';
import '../../food/restaurant.css';
import '../bar.css';

export default async function BeautyConsumablesPage() {
  const me = await requireFeature('/bar/consumables');
  try {
    const [shell, branch, products, movements] = await Promise.all([
      deskShell(),
      selectedWorkspaceBranch(),
      stockApi.products(),
      stockApi.movements(),
    ]);
    if (!branch?.currency || !shell.scopeKey) throw new Error('Сначала выберите филиал');
    const beauty = me.context?.vertical === 'BEAUTY';
    // салон решает по матрице должностей, гостиница по ролям: справочник `property`, приход и списания `desk`
    const may = (action: 'create' | 'update' | 'delete') =>
      !shell.readOnly && mayBeautyAccess(shell.access, 'stock', action, { legacy: 'settings' });
    const rights = beauty
      ? { canCreate: may('create'), canUpdate: may('update'), canDelete: may('delete') }
      : { canDesk: !shell.readOnly && mayAccess(shell.access, 'desk'), canProperty: !shell.readOnly && mayAccess(shell.access, 'property') };
    return (
      <Page
        title={beauty ? 'Склад: расходники' : 'Склад: кухня'}
        subtitle={beauty ? 'Материалы для услуг, приходы, списания и остатки' : 'Продукты кухни, приходы, списания и остатки'}
      >
        <BarTabs current="consumables" />
        <div key={shell.scopeKey}>
          <StockBoard
            ctx={{
              scopeKey: shell.scopeKey,
              currency: branch.currency,
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
      <Page title="Склад: кухня и расходники">
        <LoadError testId="beauty-consumables-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
