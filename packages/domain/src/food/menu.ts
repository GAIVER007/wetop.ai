import { foodId, foodInt, foodObject, foodText } from './food';

/** Кухня FS1 (DATA_MODEL §33, ADR-KITCHEN-FS): разбор ввода каталога меню. Деньги в minor units. */
export const MENU_TAGS = ['hit', 'new'] as const;
export type MenuTag = (typeof MENU_TAGS)[number];
export const MENU_CURRENCIES = ['KZT', 'RUB', 'USD', 'EUR'] as const;

/** Подсказки категорий из ТЗ §2: строки интерфейса, не данные */
export const MENU_CATEGORY_PRESETS = [
  'Горячие блюда',
  'Закуски',
  'Холодные закуски',
  'Салаты',
  'Супы',
  'Паста',
  'Пицца',
  'Гарниры',
  'Десерты',
  'Гриль',
  'Завтраки',
  'Детское меню',
  'Хлеб и выпечка',
  'Специальные предложения',
  'Сезонное меню',
] as const;

function menuBool(v: unknown): boolean {
  if (typeof v !== 'boolean') throw new Error('Нужно логическое значение');
  return v;
}

/** Цена в minor units: целое, не отрицательное, в пределах BigInt-безопасного ввода */
export function menuPrice(v: unknown): number {
  return foodInt(v, 0, Number.MAX_SAFE_INTEGER);
}

export function menuCurrency(v: unknown): string {
  if (typeof v !== 'string' || !MENU_CURRENCIES.some((c) => c === v))
    throw new Error('Неизвестная валюта');
  return v;
}

function menuTags(v: unknown): MenuTag[] {
  if (!Array.isArray(v) || v.some((t) => !MENU_TAGS.some((m) => m === t)))
    throw new Error('Неизвестная пометка блюда');
  return [...new Set(v as MenuTag[])];
}

function menuAllergens(v: unknown): string[] {
  if (!Array.isArray(v) || v.length > 30) throw new Error('Некорректный список аллергенов');
  return v.map((a) => foodText(a, 100));
}

export interface MenuCategoryInput {
  name?: string;
  sortOrder?: number;
  active?: boolean;
}

export function parseMenuCategory(raw: unknown, partial = false): MenuCategoryInput {
  const b = foodObject(raw, ['name', 'sortOrder', 'active']);
  const out: MenuCategoryInput = {};
  if (!partial || b.name !== undefined) out.name = foodText(b.name, 200);
  if (b.sortOrder !== undefined) out.sortOrder = foodInt(b.sortOrder, -2147483648);
  if (b.active !== undefined) out.active = menuBool(b.active);
  return out;
}

export interface MenuItemInput {
  name?: string;
  categoryId?: string | null;
  sku?: string | null;
  description?: string | null;
  price?: number;
  currency?: string;
  outputWeightGrams?: number | null;
  prepTimeMinutes?: number | null;
  allergens?: string[];
  tags?: MenuTag[];
  active?: boolean;
}

export function parseMenuItem(raw: unknown, partial = false): MenuItemInput {
  const b = foodObject(raw, [
    'name',
    'categoryId',
    'sku',
    'description',
    'price',
    'currency',
    'outputWeightGrams',
    'prepTimeMinutes',
    'allergens',
    'tags',
    'active',
  ]);
  const out: MenuItemInput = {};
  if (!partial || b.name !== undefined) out.name = foodText(b.name, 200);
  if (!partial || b.price !== undefined) out.price = menuPrice(b.price);
  if (!partial || b.currency !== undefined) out.currency = menuCurrency(b.currency);
  if (b.categoryId !== undefined) out.categoryId = b.categoryId == null ? null : foodId(b.categoryId);
  if (b.sku !== undefined) out.sku = b.sku == null ? null : foodText(b.sku, 64);
  if (b.description !== undefined)
    out.description = b.description == null ? null : foodText(b.description, 4000);
  if (b.outputWeightGrams !== undefined)
    out.outputWeightGrams = b.outputWeightGrams == null ? null : foodInt(b.outputWeightGrams);
  if (b.prepTimeMinutes !== undefined)
    out.prepTimeMinutes = b.prepTimeMinutes == null ? null : foodInt(b.prepTimeMinutes, 1, 1440);
  if (b.allergens !== undefined) out.allergens = menuAllergens(b.allergens);
  if (b.tags !== undefined) out.tags = menuTags(b.tags);
  if (b.active !== undefined) out.active = menuBool(b.active);
  return out;
}

export interface LocationMenuItemInput {
  enabled?: boolean;
  available?: boolean;
  priceOverride?: number | null;
}

/** Переопределение филиала: пустой объект недопустим, менять нечего */
export function parseLocationMenuItem(raw: unknown): LocationMenuItemInput {
  const b = foodObject(raw, ['enabled', 'available', 'priceOverride']);
  const out: LocationMenuItemInput = {};
  if (b.enabled !== undefined) out.enabled = menuBool(b.enabled);
  if (b.available !== undefined) out.available = menuBool(b.available);
  if (b.priceOverride !== undefined)
    out.priceOverride = b.priceOverride == null ? null : menuPrice(b.priceOverride);
  if (Object.keys(out).length === 0) throw new Error('Пустое переопределение');
  return out;
}

/** Действующие на филиале цена и доступность блюда (отсутствие строки = каталог, в наличии) */
export function effectiveMenuItem(
  item: { price: bigint | number; active: boolean },
  override: { enabled: boolean; available: boolean; priceOverride: bigint | number | null } | null,
): { visible: boolean; available: boolean; price: bigint | number } {
  const visible = item.active && (override?.enabled ?? true);
  return {
    visible,
    available: visible && (override?.available ?? true),
    price: override?.priceOverride ?? item.price,
  };
}
