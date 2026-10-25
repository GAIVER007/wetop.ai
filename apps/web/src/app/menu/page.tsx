import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { serverT } from '../../i18n/server';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { restaurantApi, stockApi } from '../../lib/food-api';
import { completeFoodList } from '../../lib/food-data';
import type { MenuCategory, MenuItemView } from '../../lib/food-types';
import { MenuBoard } from '../food/menu-board';
import { MenuCostingPanel } from '../food/menu-costing';
import { restaurantShell } from '../food/restaurant-load';
import { currencySign } from '../../lib/money';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import '../food/food.css';
import '../food/restaurant.css';

/** «Меню и техкарты» по макету владельца (ADR-159): категории, блюда, калькуляция */
export default async function MenuPage() {
  const t = await serverT();
  try {
    const shell = await restaurantShell();
    const [categories, items, stock, branch, modifierGroups, costing] = await Promise.all([
      completeFoodList<MenuCategory>(restaurantApi.categories),
      completeFoodList<MenuItemView>(restaurantApi.menuItems),
      // склад нужен только для связи техкарты (§38); нет доступа к складу — техкарта без связи
      stockApi.products().then(
        (r) => r.items.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, unit: p.unit })),
        () => [],
      ),
      // цены меню в валюте филиала, не всегда тенге (поручение владельца 20.10.2026)
      selectedWorkspaceBranch(),
      // §33.7: группы добавок бизнеса
      restaurantApi.modifierGroups().then((r) => r.items),
      // §62.4 (K4): себестоимость по складу; нет права `desk` или отказ, блока нет
      shell.canDesk ? restaurantApi.menuCosting().catch(() => null) : Promise.resolve(null),
    ]);
    return (
      <Page title={t('Меню')}>
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
            modifierGroups={modifierGroups}
          />
          {costing && <MenuCostingPanel report={costing} />}
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('Меню')}>
        <LoadError testId="menu-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
