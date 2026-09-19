/**
 * Тип блокировки ячейки — словом. Один словарь для шахматки и карточки ячейки: раньше сетка знала
 * только «ремонт» и печатала `OUT_OF_ORDER` / `MANAGEMENT` сырым кодом (план дизайн-системы §10 п. 4).
 * Ключи — значения `InventoryBlockType` из `schema.prisma`; сторожит `block-types.test.ts`.
 */
export const BLOCK_TYPE_RU = {
  MAINTENANCE: 'ремонт',
  OUT_OF_ORDER: 'неисправна',
  MANAGEMENT: 'решение управляющего',
  OTHER: 'другое',
} as const;

export type BlockType = keyof typeof BLOCK_TYPE_RU;

/** Слово для подсказки и подписи: неизвестный тип печатается как есть, пустой — «блокировка». */
export function blockTypeLabel(type: string | null | undefined): string {
  if (!type) return 'блокировка';
  return (BLOCK_TYPE_RU as Record<string, string>)[type] ?? type;
}
