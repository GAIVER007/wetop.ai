import { ApiError } from './api-error';
import { plusDays, validDate } from './hotel-api';
import { normalizeSearchParams, type SearchParams } from './search-params';

/** Only the date window crosses vertical routes, never a tenant or an unrelated filter. */
export function financePeriodHref(path: string, params: SearchParams): string {
  const sp = normalizeSearchParams(params);
  const query = new URLSearchParams();
  for (const key of ['from', 'to'] as const) {
    if (sp[key] !== undefined) query.set(key, sp[key]);
  }
  return query.size ? `${path}?${query}` : path;
}

/** Date-only arithmetic; `today` must come from the location API, not the host clock. */
export function financeDateRange(
  params: SearchParams,
  today: string,
  defaults: { period: 'week' | 'month'; maxDays: number },
): { from: string; to: string; dates: string[] } {
  const sp = normalizeSearchParams(params);
  const to = sp.to ?? today;
  if (!validDate(to)) throw new ApiError(400, 'Проверьте дату окончания периода.');
  const from = sp.from ?? (defaults.period === 'week' ? plusDays(to, -6) : `${to.slice(0, 8)}01`);
  if (!validDate(from) || from > to) throw new ApiError(400, 'Проверьте даты периода.');
  const length = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (length > defaults.maxDays) throw new ApiError(422, `Период не больше ${defaults.maxDays} дней.`);
  return { from, to, dates: Array.from({ length }, (_, i) => plusDays(from, i)) };
}
