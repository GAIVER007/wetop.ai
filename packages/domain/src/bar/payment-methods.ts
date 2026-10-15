/**
 * Способы оплаты бара (DATA_MODEL §21.6, ADR-185, план plans/bar-payment-methods-2026-10-15.md). Бар берёт деньги
 * сразу, поэтому депозит, гарантия картой и внешний канал к нему не относятся; оплата поставщику ещё со счёта
 * организации. Бар гостиницы показывает из этого списка то, что объект включил, и в его порядке; у бара без объекта
 * (салон, ресторан) настройки нет, список бара целиком (Q-296, умолчание).
 */
export const BAR_SALE_METHODS = ['CASH', 'CARD_TERMINAL', 'KASPI', 'HALYK', 'BANK_TRANSFER_PERSON'] as const;
export const BAR_SUPPLIER_METHODS = [
  'CASH',
  'CARD_TERMINAL',
  'KASPI',
  'HALYK',
  'BANK_TRANSFER_PERSON',
  'BANK_TRANSFER_LEGAL',
] as const;

/** Подписи бара короче подписей стойки: форма продажи одной строкой (макет владельца 09.10.2026) */
export const BAR_METHOD_RU: Record<string, string> = {
  CASH: 'Наличные',
  CARD_TERMINAL: 'Карта',
  KASPI: 'Kaspi',
  HALYK: 'Halyk',
  BANK_TRANSFER_PERSON: 'Перевод',
  BANK_TRANSFER_LEGAL: 'Счет организации',
};
export const barMethodRu = (method: string): string => BAR_METHOD_RU[method] ?? method;

/**
 * Список формы бара: включённые объектом способы в порядке настройки, только те, что бар принимает.
 * `enabled === null` значит, что у бара нет объекта и настройки: список бара целиком.
 */
export function barPaymentMethods(
  enabled: readonly string[] | null,
  supported: readonly string[],
): string[] {
  if (!enabled) return [...supported];
  return enabled.filter((m) => supported.includes(m));
}
