import { BUSINESS_MARKET_MAX_DAYS, levelFromSlots } from './business';
import { MarketInputError, type AvailabilityLevel } from './occupancy';

/**
 * Сборщик загрузки соседей салона и ресторана (DATA_MODEL §60, план `plans/2026-10-23-competitors-business-manual.md`
 * срез 3, проба `reports/2026-10-23-competitor-platform-probe.md`). Здесь только чистые правила: где в ссылке соседа
 * номер компании, сколько окон в ответе виджета на день и что сборщик вправе записать. Сеть и браузер снаружи.
 */

/** Не больше дней за один запрос сборщика: та же доска «по дням», что у человека (14) */
export const BUSINESS_COLLECT_MAX_ENTRIES = BUSINESS_MARKET_MAX_DAYS;

/**
 * Номер компании Dikidi из ссылки соседа: `dikidi.net/ru/record/2091353`, `dikidi.net/2091353`,
 * `dikidi.net/ru/profile/korkemai_salon_2091353`, `…?company=2091353`. Иначе null: сосед остаётся «вручную».
 */
export function dikidiCompanyId(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)dikidi\.(net|ru)$/.test(u.hostname.toLowerCase())) return null;
  const q = u.searchParams.get('company') ?? u.searchParams.get('company_id');
  if (q && /^\d{3,12}$/.test(q)) return q;
  const path = u.pathname.replace(/\/+$/, '');
  const m =
    path.match(/\/record\/(\d{3,12})(?:\/|$)/) ??
    path.match(/^\/(?:[a-z]{2}\/)?(\d{3,12})$/) ??
    path.match(/\/profile\/[^/]*?_(\d{3,12})$/);
  return m ? m[1]! : null;
}

/**
 * Окна дня из ответа виджета Dikidi `get_datetimes` (`data.times`: мастер → список «ГГГГ-ММ-ДД ЧЧ:ММ:СС»). Одно время у
 * двух мастеров считается одним окном: гость видит одно время. День, которого нет в `dates_true`, — «нет мест» (0).
 * Неожиданная форма ответа — null: данных нет, ничего не пишем (не путаем «не поняли» с «всё занято»).
 */
export function dikidiDaySlots(data: unknown, day: string): number | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { dates_true?: unknown; times?: unknown };
  if (!Array.isArray(d.dates_true)) return null;
  if (!d.dates_true.includes(day)) return 0;
  if (d.times === undefined || d.times === null) return 0;
  const lists = Array.isArray(d.times) ? (d.times.length ? null : []) : typeof d.times === 'object' ? Object.values(d.times) : null;
  if (lists === null) return null;
  const slots = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) return null;
    for (const t of list) if (typeof t === 'string' && t.startsWith(`${day} `)) slots.add(t.slice(11, 16));
  }
  return slots.size;
}

/** Restoplace: адрес соседа из ссылки (`?address=<20 hex>`) или из страницы виджета (`data-hash`); иначе null */
export function restoplaceAddress(url: string | null | undefined, html = ''): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)restoplace\.(ws|cc)$/.test(u.hostname.toLowerCase())) return null;
  const q = u.searchParams.get('address');
  if (q && /^[0-9a-f]{20}$/.test(q)) return q;
  const m = html.match(/data-hash=['"]([0-9a-f]{20})['"]/);
  return m ? m[1]! : null;
}

/**
 * Свободные столы дня из ответа виджета Restoplace (`getJsonParams:<день>:first:0`): столы, которые ресторан даёт
 * бронировать онлайн (`type=table`, `reserve=1`), минус столы с любой бронью, начинающейся в этот день
 * (`tables_reserve["<id>_table"].n[].time_from`). Неожиданная форма ответа — null, ничего не пишем.
 */
export function restoplaceFreeTables(data: unknown, day: string): number | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { items?: unknown; tables_reserve?: unknown };
  if (!Array.isArray(d.items)) return null;
  const tables = new Set<string>();
  for (const it of d.items) {
    const i = (it ?? {}) as { id?: unknown; type?: unknown; reserve?: unknown };
    if (i.type === 'table' && String(i.reserve) === '1' && (typeof i.id === 'string' || typeof i.id === 'number')) tables.add(String(i.id));
  }
  if (tables.size === 0) return null;
  const reserves = d.tables_reserve ?? {};
  if (typeof reserves !== 'object' || reserves === null) return null;
  const busy = new Set<string>();
  for (const [key, v] of Object.entries(reserves as Record<string, unknown>)) {
    const m = key.match(/^(\d+)_table$/);
    if (!m || !tables.has(m[1]!)) continue;
    const list = (v as { n?: unknown } | null)?.n;
    if (!Array.isArray(list)) return null;
    if (list.some((r) => typeof (r as { time_from?: unknown })?.time_from === 'string' && (r as { time_from: string }).time_from.startsWith(day))) busy.add(m[1]!);
  }
  return tables.size - busy.size;
}

export interface CollectedDay {
  day: string;
  level: AvailabilityLevel;
  freeSlots: number;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Что сборщик вправе записать: дни от «сегодня» филиала на 14 дней вперёд, каждый раз, целое число окон; уровень
 * считается из окон тем же порогом, что у человека (`levelFromSlots`). Сборщик ничего не стирает.
 */
export function parseCollectedDays(raw: unknown, today: string): CollectedDay[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new MarketInputError('entries: список { day, freeSlots }');
  if (raw.length > BUSINESS_COLLECT_MAX_ENTRIES)
    throw new MarketInputError(`Не больше ${BUSINESS_COLLECT_MAX_ENTRIES} дней за раз`);
  const latest = plusDays(today, BUSINESS_MARKET_MAX_DAYS - 1);
  const seen = new Set<string>();
  return raw.map((item) => {
    const e = (item ?? {}) as { day?: unknown; freeSlots?: unknown };
    const day = typeof e.day === 'string' ? e.day : '';
    if (!ISO.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`)))
      throw new MarketInputError('day: дата в формате ГГГГ-ММ-ДД');
    if (day < today || day > latest) throw new MarketInputError(`День ${day}: можно от ${today} до ${latest}`);
    if (seen.has(day)) throw new MarketInputError(`День ${day} указан дважды`);
    seen.add(day);
    const n = e.freeSlots;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 10_000)
      throw new MarketInputError(`День ${day}: свободных окон, целое число от нуля`);
    return { day, level: levelFromSlots(n), freeSlots: n };
  });
}
