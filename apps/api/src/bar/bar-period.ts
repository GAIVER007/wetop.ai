/**
 * Месяц бара к прошлому месяцу (ADR-156, макет владельца 09.10.2026). Даты: календарные даты объекта
 * (YYYY-MM-DD, AGENTS.md §13): приход считается по дате приёмки, продажа по началу суток в поясе объекта
 * (это делает репозиторий). Деньги только BigInt, прирост целыми процентами.
 */
const pad = (value: number) => String(value).padStart(2, '0');

export function monthBounds(today: string): { prevMonthStart: string; monthStart: string; nextMonthStart: string } {
  const [year = 0, month = 1] = today.split('-').map(Number);
  const start = (y: number, m: number) => {
    const shifted = new Date(Date.UTC(y, m - 1, 1));
    return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-01`;
  };
  return { prevMonthStart: start(year, month - 1), monthStart: start(year, month), nextMonthStart: start(year, month + 1) };
}

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Прирост к прошлому периоду в целых процентах, половина округляется от нуля; прошлого периода нет, тогда null */
export function growthPercent(current: bigint, previous: bigint): number | null {
  if (previous <= 0n) return null;
  const numerator = (current - previous) * 100n;
  let quotient = numerator / previous;
  const remainder = numerator % previous;
  const twice = (remainder < 0n ? -remainder : remainder) * 2n;
  if (twice >= previous) quotient += numerator < 0n ? -1n : 1n;
  return Number(quotient);
}
