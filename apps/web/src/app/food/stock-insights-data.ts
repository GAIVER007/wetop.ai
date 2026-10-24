import { dishPortions, milliOf } from '@pms/domain';
import type { MenuItemView, StockProductView } from '../../lib/food-types';

/** Норма себестоимости блюда (доля продуктов в цене): выше неё блюдо невыгодно (макет владельца 21.10.2026) */
export const FOOD_COST_LIMIT_PCT = 30;

export interface DishRow {
  id: string;
  name: string;
  costMinor: string;
  priceMinor: string;
  foodCostPct: number | null;
  portions: number | null;
  limiting: string | null;
}

export interface StockInsights {
  /** продукты ниже минимума, как их отдаёт склад */
  restock: Array<{ id: string; name: string; onHand: string; minQty: string; unit: string }>;
  /** блюда, у которых доля продуктов выше нормы, по убыванию */
  expensive: DishRow[];
  /** активные блюда с техкартой: сколько порций хватит из остатков */
  dishes: DishRow[];
}

/** Что нужно докупить и какие блюда страдают: только из данных склада и меню, без новых расчётов в базе */
export function buildStockInsights(products: StockProductView[], items: MenuItemView[] | null): StockInsights {
  const active = products.filter((p) => p.active);
  const onHand = new Map(active.map((p) => [p.id, milliOf(p.onHand)]));
  const dishes: DishRow[] = (items ?? [])
    .filter((item) => item.active && item.ingredients && item.ingredients.length > 0)
    .map((item) => {
      const { portions, limiting } = dishPortions(item.ingredients ?? [], onHand);
      return {
        id: item.id,
        name: item.name,
        costMinor: item.totals?.costMinor ?? '0',
        priceMinor: item.priceMinor,
        foodCostPct: item.totals?.foodCostPct ?? null,
        portions,
        limiting,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return {
    restock: active
      .filter((p) => p.low)
      .map((p) => ({ id: p.id, name: p.name, onHand: p.onHand, minQty: p.minQty, unit: p.unit })),
    expensive: dishes
      .filter((d) => d.foodCostPct !== null && d.foodCostPct > FOOD_COST_LIMIT_PCT)
      .sort((a, b) => (b.foodCostPct ?? 0) - (a.foodCostPct ?? 0)),
    dishes,
  };
}
