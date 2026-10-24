import type { KkPart } from './types';

/** KK3: Ресторан: меню, заказы, кухня, склад кухни, бар, официант. Ключ русская фраза, значение перевод; правка перевода меняет только значение */
export const restaurantService: KkPart = {
  paths: [
    'app/food/stock-board.tsx',
    'app/food/menu-board.tsx',
    'app/food/modifier-parts.tsx',
    'app/food/order-drawer.tsx',
    'app/food/workspace-board.tsx',
    'app/food/menu-costing.tsx',
    'app/food/dish-picker.tsx',
    'app/food/catalog-board.tsx',
    'app/food/catalog-form.tsx',
    'app/food/stock-insights.tsx',
    'app/food/stock-insights-data.ts',
    'app/food/stock-actions.ts',
    'app/food/kitchen-board.tsx',
    'app/food/orders-board.tsx',
    'app/food/bar-board.tsx',
    'app/menu',
    'app/orders',
    'app/kitchen',
    'app/stock',
    'app/drinks',
    'app/waiter',
  ],
  phrases: {},
};
