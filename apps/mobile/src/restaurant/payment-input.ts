import { AccessError } from '../auth/contracts';
// Existing branch cash contract, DATA_MODEL 21.7. Only server-enabled methods are offered.
export const PAYMENT_METHODS = [
  'CASH',
  'CARD_TERMINAL',
  'KASPI',
  'HALYK',
  'BANK_TRANSFER_PERSON',
  'BANK_TRANSFER_LEGAL',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export function readPaymentMethods(value: unknown): PaymentMethod[] {
  if (
    !value ||
    typeof value !== 'object' ||
    !('methods' in value) ||
    !Array.isArray(value.methods) ||
    value.methods.length > PAYMENT_METHODS.length
  )
    throw new AccessError('invalid');
  const seen = new Set<string>();
  const rows = value.methods.map((item: unknown) => {
    if (
      !item ||
      typeof item !== 'object' ||
      !('method' in item) ||
      !('enabled' in item) ||
      !('sortOrder' in item) ||
      !PAYMENT_METHODS.includes(item.method as PaymentMethod) ||
      typeof item.enabled !== 'boolean' ||
      typeof item.sortOrder !== 'number' ||
      !Number.isSafeInteger(item.sortOrder) ||
      item.sortOrder < 0 ||
      seen.has(item.method as string)
    )
      throw new AccessError('invalid');
    seen.add(item.method as string);
    return {
      method: item.method as PaymentMethod,
      enabled: item.enabled,
      sortOrder: item.sortOrder,
    };
  });
  return rows
    .filter((row) => row.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => row.method);
}
/** Existing server contract: two decimal places, integer minor units within JSON safe integer range. */
export function paymentAmount(input: string, remainingMinor: string): number {
  const value = input.trim();
  if (
    value.length > 32 ||
    !/^\d+(?:[.,]\d{1,2})?$/.test(value) ||
    remainingMinor.length > 64 ||
    !/^\d+$/.test(remainingMinor)
  )
    throw new Error('Введите сумму с точностью до двух знаков.');
  const [whole, fraction = ''] = value.split(/[.,]/);
  const amount = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (amount < 1n) throw new Error('Сумма должна быть больше нуля.');
  if (amount > BigInt(remainingMinor)) throw new Error('Сумма больше остатка к оплате.');
  if (amount > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Сумма превышает допустимый размер платежа.');
  return Number(amount);
}
