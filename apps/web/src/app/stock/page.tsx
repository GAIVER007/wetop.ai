import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { stockApi } from '../../lib/food-api';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { StockBoard } from '../food/stock-board';
import { restaurantShell } from '../food/restaurant-load';
import '../food/food.css';
import '../food/restaurant.css';

/** «Склад» кухни FS2 (DATA_MODEL §34, ADR-KITCHEN-FS): ингредиенты, приход, списание, инвентаризация */
export default async function StockPage() {
  try {
    const shell = await restaurantShell();
    const [products, movements, branch] = await Promise.all([
      stockApi.products(),
      stockApi.movements(),
      selectedWorkspaceBranch(),
    ]);
    return (
      <Page title="Склад" subtitle="Ингредиенты кухни, приходы, списания и инвентаризация">
        <div key={shell.scopeKey}>
          <StockBoard
            ctx={{
              scopeKey: shell.scopeKey,
              canDesk: shell.canDesk && !shell.readOnly,
              canProperty: shell.canProperty && !shell.readOnly,
              currency: branch?.currency ?? 'KZT',
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
      <Page title="Склад">
        <LoadError testId="stock-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
