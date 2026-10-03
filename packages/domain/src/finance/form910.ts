/**
 * Доход для упрощённой декларации (форма 910) по полугодиям (K7 плана развития, ADR-143). Правило по умолчанию
 * до подтверждения бухгалтером (Q-268): кассовый метод, доход = поступившие от гостей деньги минус возвраты в том же
 * периоде; гарантия картой (`CARD_GUARANTEE`) деньгами не является. Ставку налога WETOP не считает: её применяет
 * бухгалтер, у объекта может быть своя ставка региона.
 */
export interface Month {
  month: string;
  from: string;
  to: string;
}

/** Шесть месяцев полугодия в датах объекта: первое — январь–июнь, второе — июль–декабрь */
export function halfYearMonths(year: number, half: 1 | 2): Month[] {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Год от 2000 до 2100');
  if (half !== 1 && half !== 2) throw new Error('Полугодие: 1 или 2');
  return Array.from({ length: 6 }, (_, i) => {
    const m = (half - 1) * 6 + i + 1;
    const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
    const mm = String(m).padStart(2, '0');
    return { month: `${year}-${mm}`, from: `${year}-${mm}-01`, to: `${year}-${mm}-${last}` };
  });
}

/** Способы, которые не являются поступлением денег */
const NOT_MONEY = new Set(['CARD_GUARANTEE']);

export function incomeFor910(report: {
  paymentsByMethod: Array<{ method: string; amountMinor: string }>;
  refundedMinor: string;
}): {
  receivedMinor: bigint;
  refundedMinor: bigint;
  incomeMinor: bigint;
  byMethod: Array<{ method: string; amountMinor: bigint }>;
} {
  const byMethod = report.paymentsByMethod
    .filter((p) => !NOT_MONEY.has(p.method))
    .map((p) => ({ method: p.method, amountMinor: BigInt(p.amountMinor) }));
  const receivedMinor = byMethod.reduce((s, p) => s + p.amountMinor, 0n);
  const refundedMinor = BigInt(report.refundedMinor);
  return { receivedMinor, refundedMinor, incomeMinor: receivedMinor - refundedMinor, byMethod };
}
