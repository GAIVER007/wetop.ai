/*
 * Калькулятор «прямая бронь против OTA» (срез D3 плана прямых продаж, Q-235). Готовых ставок у него нет: человек
 * вводит свои цифры. Деньги — целые тенге, проценты — целые; float не участвует (ADR-008). Пределы держат
 * произведение в безопасных для целого пределах: 100 000 · 1 000 000 · 100 · 100 = 10^15 < 2^53.
 */
export const MAX_NIGHTS = 100_000;
export const MAX_ADR = 1_000_000;

export type CalcInput = { nights: number; adr: number; commissionPct: number; shiftPct: number };
export type CalcResult = { commissionMonth: number; savedMonth: number; savedYear: number };

/** Деление с округлением к ближайшему целому (для неотрицательных). */
function roundDiv(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

const isWhole = (value: number, max: number) => Number.isInteger(value) && value >= 0 && value <= max;

/**
 * Комиссия OTA за месяц и то, что остаётся в кармане, если долю броней перевести на прямые.
 * Не учитывает платёжные сборы и расходы на привлечение: их у каждого объекта свои.
 */
export function directSaving(input: CalcInput): CalcResult | null {
  const { nights, adr, commissionPct, shiftPct } = input;
  if (
    !isWhole(nights, MAX_NIGHTS) ||
    !isWhole(adr, MAX_ADR) ||
    !isWhole(commissionPct, 100) ||
    !isWhole(shiftPct, 100)
  ) {
    return null;
  }
  const commissionMonth = roundDiv(nights * adr * commissionPct, 100);
  const savedMonth = roundDiv(nights * adr * commissionPct * shiftPct, 10_000);
  return { commissionMonth, savedMonth, savedYear: savedMonth * 12 };
}

/** Целое число из поля ввода: пробелы между разрядами убираем, всё остальное, кроме цифр, не принимаем. */
export function parseWhole(raw: string): number | null {
  const compact = raw.replace(/\s+/g, '');
  return /^\d+$/.test(compact) ? Number(compact) : null;
}
