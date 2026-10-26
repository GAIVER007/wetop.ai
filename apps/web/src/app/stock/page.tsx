import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { serverT } from '../../i18n/server';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi, stockApi } from '../../lib/food-api';
import { completeFoodList } from '../../lib/food-data';
import type { MenuItemView } from '../../lib/food-types';
import { StockInsightsView } from '../food/stock-insights';
import { buildStockInsights } from '../food/stock-insights-data';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { StockBoard } from '../food/stock-board';
import { restaurantShell } from '../food/restaurant-load';
import '../food/food.css';
import '../food/restaurant.css';
import '../bar/bar.css';

/** «Склад» кухни FS2 (DATA_MODEL §34, ADR-KITCHEN-FS): ингредиенты, приход, списание, инвентаризация */
export default async function StockPage() {
  const t = await serverT();
  try {
    const shell = await restaurantShell();
    const [products, movements, branch, dishes] = await Promise.all([
      stockApi.products(),
      stockApi.movements(),
      selectedWorkspaceBranch(),
      // блюда нужны только для порций и калькуляции: без них склад работает как раньше
      completeFoodList<MenuItemView>(restaurantApi.menuItems).catch(() => null),
    ]);
    const currency = branch?.currency ?? 'KZT';
    return (
      <Page width="wide" className="bar-subpage" title={t('Склад')}>
        <div key={shell.scopeKey}>
          <StockInsightsView insights={buildStockInsights(products.items, dishes)} currency={currency} menuHref="/menu" />
          <StockBoard
            ctx={{
              scopeKey: shell.scopeKey,
              canDesk: shell.canDesk && !shell.readOnly,
              canProperty: shell.canProperty && !shell.readOnly,
              currency: branch?.currency ?? 'KZT',
              ...(branch?.timezone ? { timezone: branch.timezone } : {}),
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
      <Page title={t('Склад')}>
        <LoadError testId="stock-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
