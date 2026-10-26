import type { BeautyServiceRow } from '../../../lib/api';
import type { IconName } from '../../../components/icon';

/**
 * Прайс-лист услуг салона (вариант B, выбор владельца 25.10.2026): цвет и значок категории, доля визитов и итоги
 * строки. Категории салона — свободный текст, поэтому цвет берётся из имени (одна категория — всегда один цвет),
 * а значок — по смыслу слова, иначе общий ярлык.
 */
export const CATEGORY_TONES = 6;

export function categoryTone(name: string | null | undefined): number {
  const key = (name ?? '').trim().toLocaleLowerCase('ru-RU');
  if (!key) return 0;
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return (h % (CATEGORY_TONES - 1)) + 1;
}

const ICON_WORDS: Array<[RegExp, IconName]> = [
  [/волос|стриж|окраш|уклад|причес|барбер|бород|усы|муж/u, 'beauty'], // kk-allow: слова для сверки с названием категории, на экран не выводятся
  [/ногт|маник|педик|наращ/u, 'star'], // kk-allow: слова для сверки с названием категории, на экран не выводятся
  [/лиц|бров|ресниц|ресн|макияж|косметолог|чистк/u, 'eye'], // kk-allow: слова для сверки с названием категории, на экран не выводятся
  [/массаж|спа|тел|депил|эпил|шугар/u, 'person'], // kk-allow: слова для сверки с названием категории, на экран не выводятся
];

export function categoryIcon(name: string | null | undefined): IconName {
  const key = (name ?? '').toLocaleLowerCase('ru-RU');
  return ICON_WORDS.find(([re]) => re.test(key))?.[1] ?? 'tag';
}

export type ServiceScope = 'all' | 'location' | 'missing';

export function inLocation(row: BeautyServiceRow): boolean {
  return row.active && row.location?.enabled === true;
}

/** Цена, которую видит гость: цена филиала, если услуга там продаётся, иначе цена каталога; '0' — не задана */
export function shownPriceMinor(row: BeautyServiceRow): string {
  return row.effective?.sellable ? row.effective.priceMinor : row.priceMinor; // row.effective.priceMinor — цена филиала
}

export function popularityPercent(row: BeautyServiceRow): number | null {
  const p = row.popularity;
  if (!p || p.totalCompletedVisits <= 0) return null;
  return (p.completedVisits * 100) / p.totalCompletedVisits;
}

export interface ServicesSummary {
  inLocation: number;
  total: number;
  /** средняя цена услуг филиала в тиынах (целое, с округлением вниз); null — нет услуг с ценой */
  averageMinor: string | null;
  top: string | null;
  missingPrice: number;
}

/** Итоги над списком: только действующие услуги; средняя — по услугам филиала с ценой больше нуля */
export function servicesSummary(rows: readonly BeautyServiceRow[]): ServicesSummary {
  const active = rows.filter((r) => r.active);
  const here = active.filter(inLocation);
  const priced = here.map((r) => BigInt(shownPriceMinor(r))).filter((p) => p > 0n);
  const average = priced.length ? priced.reduce((a, b) => a + b, 0n) / BigInt(priced.length) : null;
  let top: BeautyServiceRow | null = null;
  for (const r of active)
    if ((r.popularity?.completedVisits ?? 0) > (top?.popularity?.completedVisits ?? 0)) top = r;
  return {
    inLocation: here.length,
    total: active.length,
    averageMinor: average === null ? null : average.toString(),
    top: top?.name ?? null,
    missingPrice: here.filter((r) => shownPriceMinor(r) === '0').length,
  };
}
