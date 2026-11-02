/**
 * Курсы Нацбанка РК и перевод денег в валюту компании по курсу дня операции (владелец 01.11.2026: «курс Нацбанка РК
 * на каждый день, сам подтягивается, каждая сумма по курсу своего дня»; ADR-OWNER-FX-20261101, DATA_MODEL §18.5).
 *
 * Курс хранится как тенге за 1 единицу валюты в миллионных долях (`micro`, 6 знаков, как в ответе Нацбанка с запасом):
 * 453,87 ₸ за доллар = 453 870 000. Деньги в минимальных единицах валюты (тиын, цент), расчёт только в BigInt
 * (AGENTS §12). Минимальная единица всех валют здесь 1/100: так считает остальной код WETOP.
 */

export interface NbkRate {
  currency: string;
  kztPerUnitMicro: bigint;
}

/** Курсы по валютам, у каждой по возрастанию даты (YYYY-MM-DD) */
export type DailyRates = Map<string, Array<{ date: string; micro: bigint }>>;

const MICRO = 1_000_000n;
const CODE = /^[A-Z]{3}$/;

/** Десятичная строка «453.87» в миллионные доли без float; неверная строка: null */
function decimalMicro(text: string): bigint | null {
  const m = /^\s*(\d{1,9})(?:[.,](\d{1,6}))?\s*$/.exec(text);
  if (!m) return null;
  return BigInt(m[1]!) * MICRO + BigInt((m[2] ?? '').padEnd(6, '0'));
}

/** Ответ `https://nationalbank.kz/rss/get_rates.cfm?fdate=ДД.ММ.ГГГГ`: дата и курсы за 1 единицу (с учётом quant) */
export function parseNbkRates(xml: string): { date: string | null; rates: NbkRate[] } {
  const d = /<date>\s*(\d{2})\.(\d{2})\.(\d{4})\s*<\/date>/.exec(xml);
  if (!d) return { date: null, rates: [] };
  const rates: NbkRate[] = [];
  for (const item of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = item[1]!;
    const code = /<title>\s*([^<]*?)\s*<\/title>/.exec(body)?.[1] ?? '';
    const value = decimalMicro(/<description>([^<]*)<\/description>/.exec(body)?.[1] ?? '');
    const quant = /<quant>\s*(\d{1,9})\s*<\/quant>/.exec(body)?.[1];
    if (!CODE.test(code) || value === null || value <= 0n) continue;
    const q = BigInt(quant ?? '1');
    if (q <= 0n) continue;
    rates.push({ currency: code, kztPerUnitMicro: value / q });
  }
  return { date: `${d[3]}-${d[2]}-${d[1]}`, rates };
}

/**
 * Курс валюты на день: точный день или последний известный до него (выходные, Нацбанк не ответил). Тенге всегда 1.
 * Раньше первого известного курса: null, сумма не выдумывается.
 */
export function rateOn(
  rates: DailyRates,
  currency: string,
  date: string,
): { micro: bigint; date: string; exact: boolean } | null {
  if (currency === 'KZT') return { micro: MICRO, date, exact: true };
  const list = rates.get(currency);
  if (!list?.length) return null;
  let lo = 0;
  let hi = list.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid]!.date <= date) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0) return null;
  const r = list[found]!;
  return { micro: r.micro, date: r.date, exact: r.date === date };
}

/** Деление с округлением половины от нуля: возвраты переводятся симметрично продажам */
function divRound(n: bigint, d: bigint): bigint {
  const sign = n < 0n ? -1n : 1n;
  const a = n < 0n ? -n : n;
  return sign * ((a * 2n + d) / (2n * d));
}

/**
 * Сумма в минимальных единицах `from` на день `date` в минимальных единицах `to`, через тенге по курсам Нацбанка.
 * Нет курса одной из валют: null.
 */
export function convertMinor(amount: bigint, from: string, to: string, date: string, rates: DailyRates): bigint | null {
  if (from === to) return amount;
  const a = rateOn(rates, from, date);
  const b = rateOn(rates, to, date);
  if (!a || !b) return null;
  return divRound(amount * a.micro, b.micro);
}
