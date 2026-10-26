import type { MenuItem } from './contracts';
export type DraftLine = {
  key: string;
  item: MenuItem;
  modifierIds: string[];
  notes: string;
  qty: number;
  unitMinor: string;
};
export function draftLine(item: MenuItem, modifierIds: string[], notes: string): DraftLine {
  if (!item.active) throw new Error('Позиция больше недоступна.');
  if (notes.trim().length > 500) throw new Error('Комментарий: не больше 500 символов.');
  if (new Set(modifierIds).size !== modifierIds.length || modifierIds.length > 50)
    throw new Error('Проверьте выбранные варианты.');
  const allowed = new Set(item.modifierGroups.flatMap((g) => g.modifiers.map((m) => m.id)));
  if (modifierIds.some((id) => !allowed.has(id))) throw new Error('Вариант больше недоступен.');
  for (const group of item.modifierGroups) {
    const count = group.modifiers.filter((m) => modifierIds.includes(m.id)).length;
    if (count < Math.max(group.minSelect, group.required ? 1 : 0) || count > group.maxSelect)
      throw new Error(`Выберите варианты: ${group.name}.`);
  }
  const modifiers = item.modifierGroups
    .flatMap((g) => g.modifiers)
    .filter((m) => modifierIds.includes(m.id));
  const unit = modifiers.reduce(
    (sum, m) => sum + BigInt(m.priceDeltaMinor),
    BigInt(item.priceMinor),
  );
  if (unit < 0n) throw new Error('Цена позиции недоступна. Обновите меню.');
  return {
    key: JSON.stringify([item.id, [...modifierIds].sort(), notes.trim()]),
    item,
    modifierIds: [...modifierIds],
    notes: notes.trim(),
    qty: 1,
    unitMinor: unit.toString(),
  };
}
export function draftTotal(lines: DraftLine[]): string {
  if (new Set(lines.map((l) => l.item.currency)).size > 1)
    throw new Error('В одном заказе должна быть одна валюта.');
  if (lines.some((l) => !Number.isInteger(l.qty) || l.qty < 1 || l.qty > 999))
    throw new Error('Проверьте количество.');
  return lines.reduce((sum, l) => sum + BigInt(l.unitMinor) * BigInt(l.qty), 0n).toString();
}
