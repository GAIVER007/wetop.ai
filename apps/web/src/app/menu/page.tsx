import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi, stockApi } from '../../lib/food-api';
import { completeFoodList } from '../../lib/food-data';
import type { MenuCategory, MenuItemView } from '../../lib/food-types';
import { MenuBoard } from '../food/menu-board';
import { restaurantShell } from '../food/restaurant-load';
import { currencySign } from '../../lib/money';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import '../food/food.css';
import '../food/restaurant.css';

/** «Меню и техкарты» по макету владельца (ADR-159): категории, блюда, калькуляция */
export default async function MenuPage() {
  try {
    const shell = await restaurantShell();
    const [categories, items, stock, branch] = await Promise.all([
      completeFoodList<MenuCategory>(restaurantApi.categories),
      completeFoodList<MenuItemView>(restaurantApi.menuItems),
      // склад нужен только для связи техкарты (§38); нет доступа к складу — техкарта без связи
      stockApi.products().then(
        (r) => r.items.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, unit: p.unit })),
        () => [],
      ),
      // цены меню в валюте филиала, не всегда тенге (поручение владельца 20.10.2026)
      selectedWorkspaceBranch(),
    ]);
    return (
      <Page title="Меню">
        <div key={shell.scopeKey}>
          <MenuBoard
            ctx={{
              scopeKey: shell.scopeKey,
              write: shell.canProperty && !shell.readOnly,
              currencyHint: currencySign(branch?.currency ?? 'KZT'),
            }}
            categories={categories}
            items={items}
            stock={stock}
          />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Меню">
        <LoadError testId="menu-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
