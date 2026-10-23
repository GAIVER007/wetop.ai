import type { WebVertical } from './vertical-landing';

/**
 * Реестр функций: какие направления открывают раздел по его адресу (план перехода к одной платформе, У1). Одна
 * таблица для охраны страниц (`requireFeature`), меню (`menuSectionsFor`) и поиска: раньше направления жили в
 * `requireVertical([...])` каждой страницы отдельно от меню, и пункты меню уводили салон и ресторан на «Главную».
 *
 * Решает самый длинный совпавший адрес: `/marketing/site` гостиничный, а `/marketing/site/editor` открыт всем.
 * Адреса нет в таблице: раздел общий для всех направлений. Сторож `features.test.ts` сверяет с таблицей каждую страницу.
 */
export const ALL_VERTICALS: readonly WebVertical[] = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'];
const H: readonly WebVertical[] = ['HOSPITALITY'];
const B: readonly WebVertical[] = ['BEAUTY'];
const F: readonly WebVertical[] = ['FOOD_SERVICE'];
const BF: readonly WebVertical[] = ['BEAUTY', 'FOOD_SERVICE'];
const HB: readonly WebVertical[] = ['HOSPITALITY', 'BEAUTY'];

const FEATURES: Readonly<Record<string, readonly WebVertical[]>> = {
  // гостиница: фонд, брони, каналы, настройки объекта, гостиничные отчёты и сайт с онлайн-бронью
  '/chessboard': H,
  '/tasks': H,
  '/guests': H,
  '/reservations': H,
  '/inventory': H,
  '/units': H,
  '/rooms': H,
  '/rates': H,
  '/channels': H,
  '/channel-manager': H,
  '/connections': H,
  '/incidents': H,
  '/hotel-settings': H,
  '/beauty-settings': B,
  '/customers/[id]': B,
  '/onboarding': H,
  '/market': H,
  // конкуренты салона и ресторана (DATA_MODEL §60): свой экран, гостиница остаётся на /market (ADR-142)
  '/market/business': BF,
  '/website': H,
  '/marketing/site': H,
  '/marketing/site/assets': ALL_VERTICALS,
  '/marketing/site/editor': ALL_VERTICALS,
  '/reports/overview': H,
  '/reports/finance': H,
  '/reports/occupancy': H,
  '/reports/units': H,
  '/reports/form-910': H,
  '/reports/print': H,
  '/management/analytics/occupancy': H,
  '/management/analytics/units': H,
  '/management/analytics/channels': H,
  // салон
  '/calendar': B,
  '/appointments': B,
  '/services': B,
  '/beauty': B,
  // склад кухни и расходников у гостиницы и салона; ресторан ведёт его на `/stock` (ADR-STOCK-ALL)
  '/bar/consumables': HB,
  '/finance/certificates': B,
  // салон и ресторан
  '/customers': BF,
  '/employees': BF,
  '/employees/shifts': F,
  '/cashbox': BF,
  // зарплата у всех трёх направлений (кабинет горничной 22.10.2026); у гостиницы без выплат из кассы
  '/payroll': ALL_VERTICALS,
  '/staff-schedule': H,
  // ресторан
  '/floor-plan': F,
  '/table-reservations': F,
  '/dining-areas': F,
  '/orders': F,
  '/kitchen': F,
  '/waiter': F,
  '/drinks': F,
  '/menu': F,
  '/stock': F,
  '/restaurant-finance': F,
  '/restaurant-settings': F,
};

/** Направления раздела по адресу: самый длинный совпавший адрес таблицы, иначе все */
export function featureVerticals(path: string): readonly WebVertical[] {
  let best: string | undefined;
  for (const route of Object.keys(FEATURES))
    if (matchesFeatureRoute(route, path) && (!best || route.length > best.length)) best = route;
  return best ? FEATURES[best]! : ALL_VERTICALS;
}

function matchesFeatureRoute(route: string, path: string): boolean {
  const prefix = route.split('/');
  const actual = path.split('/');
  return actual.length >= prefix.length && prefix.every((part, index) =>
    /^\[[A-Za-z][A-Za-z0-9_]*\]$/.test(part) ? Boolean(actual[index]) : part === actual[index],
  );
}
