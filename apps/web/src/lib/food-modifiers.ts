import type { MenuItemModifierGroup, MenuItemView, OrderItemInput, OrderItemView } from './food-types';

/**
 * Корзина стойки и официанта с добавками (§33.7). Одно блюдо с разным выбором или комментарием это разные строки;
 * точную цену и проверку делает API, здесь цена для живого итога.
 */
export function cartLineKey(i: Pick<OrderItemInput, 'menuItemId' | 'modifierIds' | 'notes'>): string {
  return [i.menuItemId, [...(i.modifierIds ?? [])].sort().join(','), i.notes?.trim() ?? ''].join('|');
}

export function cartLinePrice(dish: MenuItemView | undefined, modifierIds: readonly string[] = []): bigint {
  if (!dish) return 0n;
  const all = new Map((dish.modifierGroups ?? []).flatMap((g) => g.modifiers.map((m) => [m.id, BigInt(m.priceDeltaMinor)] as const)));
  return modifierIds.reduce((sum, id) => sum + (all.get(id) ?? 0n), BigInt(dish.priceMinor));
}

/** Добавить строку: тот же выбор складывается в количество */
export function addCartLine(items: OrderItemInput[], line: OrderItemInput): OrderItemInput[] {
  const key = cartLineKey(line);
  const index = items.findIndex((i) => cartLineKey(i) === key);
  if (index >= 0) return items.map((item, i) => (i === index ? { ...item, qty: item.qty + line.qty } : item));
  return [...items, line];
}

/** Щелчок по добавке: в группе «одна» заменяет, в группе «несколько» включает и выключает до максимума */
export function toggleChoice(selected: string[], group: MenuItemModifierGroup, id: string): string[] {
  const own = new Set(group.modifiers.map((m) => m.id));
  if (group.maxSelect === 1) return [...selected.filter((x) => !own.has(x)), id];
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  if (selected.filter((x) => own.has(x)).length >= group.maxSelect) return selected;
  return [...selected, id];
}

/** Первая группа, где выбрано меньше минимума: текст для кнопки «Добавить» */
export function choiceProblem(groups: MenuItemModifierGroup[], selected: string[]): string | null {
  for (const g of groups) {
    const n = g.modifiers.filter((m) => selected.includes(m.id)).length;
    if (n < g.minSelect) return g.minSelect === 1 ? `Выберите: ${g.name}` : `${g.name}: выберите не меньше ${g.minSelect}`;
  }
  return null;
}

/** «Большой, Овсяное. без сахара»: добавки и комментарий позиции одной строкой */
export function lineModifiersText(modifiers: ReadonlyArray<{ name: string }> = [], notes: string | null | undefined): string {
  const mods = modifiers.map((m) => m.name).join(', ');
  const note = notes?.trim() ?? '';
  return mods && note ? `${mods}. ${note}` : mods || note;
}

/** Позиции заказа обратно в корзину (правка состава, дозаказ): выбор и комментарий сохраняются */
export function orderLinesToCart(
  items: ReadonlyArray<Pick<OrderItemView, 'menuItemId' | 'qty' | 'notes' | 'modifiers'>>,
): OrderItemInput[] {
  return items
    .filter((i) => i.menuItemId)
    .map((i) => ({
      menuItemId: i.menuItemId!,
      qty: i.qty,
      notes: i.notes,
      modifierIds: (i.modifiers ?? []).map((m) => m.modifierId).filter((id): id is string => !!id),
    }));
}
