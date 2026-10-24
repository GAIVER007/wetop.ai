import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { deskShell } from '../../../lib/desk-shell';
import { barApi } from '../../../lib/api';
import { restaurantApi, stockApi } from '../../../lib/food-api';
import { completeFoodList } from '../../../lib/food-data';
import type { MenuCategory, MenuItemView } from '../../../lib/food-types';
import { currencySign } from '../../../lib/money';
import { mayAccess, mayBeautyAccess } from '../../../lib/navigation';
import { requireFeature } from '../../../lib/vertical-guard';
import { MenuBoard } from '../../food/menu-board';
import { MenuCostingPanel } from '../../food/menu-costing';
import { BarTabs } from '../tabs';
import { loadBarContext } from '../load-context';
import { barActionAccess } from '../action-access';
import { MenuSaleForm } from '../menu-sale-form';
import '../../food/food.css';
import '../../food/restaurant.css';
import '../bar.css';

/**
 * «Меню бара» гостиницы и салона (DATA_MODEL §62.3, Q-KITCHEN-ALL-1 «а»): кофе, напитки, бутерброды с техкартой и
 * добавками; продажа на баре сразу списывает продукты склада кухни. Меню тот же экран, что у ресторана.
 */
export default async function BarMenuPage() {
  const me = await requireFeature('/bar/menu');
  try {
    const vertical = me.context?.vertical === 'BEAUTY' ? 'BEAUTY' : 'HOSPITALITY';
    const [shell, context, categories, items, stock, modifierGroups, methods, folios, costing] = await Promise.all([
      deskShell(),
      loadBarContext(),
      completeFoodList<MenuCategory>(restaurantApi.categories),
      completeFoodList<MenuItemView>(restaurantApi.menuItems),
      // продукты склада кухни для техкарты и добавок; нет доступа к складу: техкарта без связи
      stockApi.products().then(
        (r) => r.items.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, unit: p.unit })),
        () => [],
      ),
      restaurantApi.modifierGroups().then((r) => r.items),
      barApi.paymentMethods().then((r) => r.sale),
      vertical === 'HOSPITALITY' ? barApi.folios() : Promise.resolve([]),
      // §62.4 (K4): себестоимость по складу кухни; отказ (нет права) прячет блок
      restaurantApi.menuCosting().catch(() => null),
    ]);
    if (!shell.scopeKey) throw new Error('Сначала выберите филиал');
    // правка меню: салон по матрице должностей («Склад»), гостиница по роли `property`, как справочник склада кухни
    const write =
      !shell.readOnly &&
      (vertical === 'BEAUTY'
        ? mayBeautyAccess(shell.access, 'stock', 'update', { legacy: 'settings' })
        : mayAccess(shell.access, 'property'));
    const canSell = barActionAccess(shell, vertical).sell;
    return (
      <Page width="wide" className="bar-subpage" title="Меню бара" subtitle="Кофе, напитки и закуски: продажа списывает продукты со склада кухни">
        <BarTabs current="menu" />
        <div key={shell.scopeKey}>
          {canSell && (
            <section className="panel" aria-labelledby="bar-menu-sale-title">
              <h2 id="bar-menu-sale-title" className="bar-panel-title">
                Продажа
              </h2>
              <MenuSaleForm items={items} context={context} methods={methods} folios={folios} />
            </section>
          )}
          <MenuBoard
            ctx={{ scopeKey: shell.scopeKey, write, currencyHint: currencySign(context.currency) }}
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
      <Page title="Меню бара">
        <LoadError testId="bar-menu-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
