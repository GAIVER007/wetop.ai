export function cashAmount(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d{1,13}([.,]\d{1,2})?$/.test(value.trim()))
    throw new Error('Введите сумму от нуля, максимум два знака после запятой');
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.');
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function closeCashShift(expected: bigint, counted: bigint, retained: bigint, note: string) {
  if (counted < 0n || retained < 0n || retained > counted)
    throw new Error('Оставляемая сумма должна быть от нуля до фактических наличных');
  if (expected !== counted && !note.trim()) throw new Error('Объясните расхождение с кассой');
  return {
    expected: String(expected),
    counted: String(counted),
    difference: String(counted - expected),
    retained: String(retained),
    plannedHandover: String(counted - retained),
  };
}
export function cashDelta(opening: Record<string, string>, current: Record<string, string>) {
  return Object.fromEntries(
    [...new Set([...Object.keys(opening), ...Object.keys(current)])].map((method) => [
      method,
      String(BigInt(current[method] ?? '0') - BigInt(opening[method] ?? '0')),
    ]),
  );
}
