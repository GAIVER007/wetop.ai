/** Canonical product contract, independent of database and browser state. */
export const BUSINESS_VERTICALS = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const;
export type BusinessVertical = (typeof BUSINESS_VERTICALS)[number];
export type VerticalCapability =
  | 'hospitality.reservations'
  | 'hospitality.inventory'
  | 'hospitality.rates'
  | 'hospitality.channels'
  | 'beauty.appointments'
  | 'beauty.customers'
  | 'beauty.employees'
  | 'beauty.services'
  | 'food.tableReservations'
  | 'food.floorPlan'
  | 'food.tables'
  | 'food.menu'
  | 'food.orders'
  | 'food.staff'
  | 'food.stock'
  | 'branch.stock'
  /** меню, техкарты и добавки (§62.3): у ресторана «Меню», у гостиницы и салона «Меню бара» */
  | 'branch.menu'
  /** касса филиала (§35.2, §48): ресторан и салон */
  | 'branch.cash'
  /** зарплата сотрудников (§33.4, §19.2, §4.1): все три направления; у гостиницы без выплат из кассы */
  | 'branch.payroll';
export interface VerticalDefinition {
  readonly id: BusinessVertical;
  readonly label: string;
  readonly availability: 'AVAILABLE' | 'PILOT';
  readonly capabilities: readonly VerticalCapability[];
}
const DEFINITIONS: Readonly<Record<BusinessVertical, VerticalDefinition>> = Object.freeze({
  HOSPITALITY: Object.freeze({
    id: 'HOSPITALITY',
    label: 'Гостиничный бизнес',
    availability: 'AVAILABLE',
    capabilities: Object.freeze([
      'hospitality.reservations',
      'hospitality.inventory',
      'hospitality.rates',
      'hospitality.channels',
      'branch.stock',
      'branch.menu',
      // зарплата гостиницы: начисления тем же расчётом; выплаты из кассы нет (docs/decisions/2026-10-22-hotel-staff-cabinet.md)
      'branch.payroll',
    ] as const),
  }),
  BEAUTY: Object.freeze({
    id: 'BEAUTY',
    label: 'Салон красоты / студия',
    availability: 'PILOT',
    capabilities: Object.freeze([
      'beauty.appointments',
      'beauty.customers',
      'beauty.employees',
      'beauty.services',
      'branch.stock',
      'branch.menu',
      'branch.cash',
      'branch.payroll',
    ] as const),
  }),
  FOOD_SERVICE: Object.freeze({
    id: 'FOOD_SERVICE',
    label: 'Кафе / ресторан',
    availability: 'PILOT',
    capabilities: Object.freeze([
      'food.tableReservations',
      'food.floorPlan',
      'food.tables',
      'food.menu',
      'food.orders',
      'food.staff',
      'food.stock',
      'branch.stock',
      'branch.menu',
      'branch.cash',
      'branch.payroll',
    ] as const),
  }),
});
export function parseBusinessVertical(value: unknown): BusinessVertical | null {
  return typeof value === 'string' && BUSINESS_VERTICALS.some((id) => id === value)
    ? (value as BusinessVertical)
    : null;
}
export function verticalDefinition(id: BusinessVertical): VerticalDefinition {
  return DEFINITIONS[id];
}
export function hasVerticalCapability(
  id: BusinessVertical,
  capability: VerticalCapability,
): boolean {
  return DEFINITIONS[id].capabilities.includes(capability);
}
