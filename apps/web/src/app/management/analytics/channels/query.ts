import type { ChannelEfficiency, ChannelEfficiencyRow, ChannelEfficiencySort } from '@pms/domain';
import { sourceNames } from '../../../../lib/hotel-api';
import { csvField, csvTenge } from '../../../finance/csv';

/**
 * «Аналитика → Каналы» (ADR-141): адрес отчёта «Эффективность каналов», подписи строк и CSV.
 * Период: по дате заезда (правило «Обзора», Q-208/Q-209); по умолчанию текущий месяц, сравнение: те же даты
 * годом раньше, пока стойка не выбрала свои.
 */
export const CHANNELS_PATH = '/management/analytics/channels';
const SORTS: readonly ChannelEfficiencySort[] = ['revenue', 'nights', 'adr'];

export interface ChannelsQuery {
  from: string;
  to: string;
  compare: boolean;
  compareFrom: string;
  compareTo: string;
  channel: string;
  sort: ChannelEfficiencySort;
  empty: boolean;
  error: string | null;
}

// 13-й месяц даёт Invalid Date, а его toISOString() бросает RangeError: проверяем число до перевода в строку
const isDate = (s: string | undefined): s is string => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
};
const monthEnd = (month: string) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/** Та же дата годом раньше; 29 февраля в невисокосный год: 28 */
export function sameDatesYearBefore(date: string): string {
  const y = Number(date.slice(0, 4)) - 1;
  const candidate = `${y}${date.slice(4)}`;
  return isDate(candidate) ? candidate : `${y}-02-28`;
}

function range(from: string | undefined, to: string | undefined, fallback: [string, string]) {
  if (from === undefined && to === undefined) return { from: fallback[0], to: fallback[1], error: null };
  if (!isDate(from) || !isDate(to))
    return { from: fallback[0], to: fallback[1], error: 'Даты периода: в виде ДД.ММ.ГГГГ' };
  if (to < from) return { from: fallback[0], to: fallback[1], error: 'Окончание периода раньше начала' };
  return { from, to, error: null };
}

export function parseChannelsQuery(sp: Record<string, string | undefined>, today: string): ChannelsQuery {
  const month = today.slice(0, 7);
  const main = range(sp.from, sp.to, [`${month}-01`, monthEnd(month)]);
  const cmp = range(sp.cfrom, sp.cto, [sameDatesYearBefore(main.from), sameDatesYearBefore(main.to)]);
  return {
    from: main.from,
    to: main.to,
    compare: sp.compare === '1',
    compareFrom: cmp.from,
    compareTo: cmp.to,
    channel: (sp.channel ?? '').slice(0, 80),
    sort: SORTS.includes(sp.sort as ChannelEfficiencySort) ? (sp.sort as ChannelEfficiencySort) : 'revenue',
    empty: sp.empty === '1',
    error: main.error ?? (sp.compare === '1' ? cmp.error : null),
  };
}

export function channelsHref(
  q: ChannelsQuery,
  patch: Partial<Pick<ChannelsQuery, 'sort' | 'channel' | 'empty'>> = {},
  path = CHANNELS_PATH,
): string {
  const n = { ...q, ...patch };
  const p = new URLSearchParams({ from: n.from, to: n.to });
  if (n.compare) {
    p.set('compare', '1');
    p.set('cfrom', n.compareFrom);
    p.set('cto', n.compareTo);
  }
  if (n.channel) p.set('channel', n.channel);
  if (n.empty) p.set('empty', '1');
  if (n.sort !== 'revenue') p.set('sort', n.sort);
  return `${path}?${p.toString()}`;
}

/** Канал OTA: своим именем; стойка, сайт, телефон: словами стойки */
export function channelLabel(row: Pick<ChannelEfficiencyRow, 'label' | 'source'>): string {
  return row.source === 'OTA' ? row.label : (sourceNames[row.source] ?? row.label);
}

const pct = (v: number) => String(v).replace('.', ',');

export function channelsCsv(report: ChannelEfficiency): string {
  const head = ['Канал', 'Брони', 'Доход', 'Доля дохода, %', 'Ночи', 'Доля ночей, %', 'Средняя стоимость ночи'];
  const lines = [head.join(';')];
  for (const r of report.rows)
    lines.push(
      [
        csvField(channelLabel(r)),
        String(r.bookings),
        csvTenge(r.revenueMinor),
        pct(r.revenueShare),
        String(r.nights),
        pct(r.nightsShare),
        r.adrMinor === null ? '' : csvTenge(r.adrMinor),
      ].join(';'),
    );
  const t = report.totals;
  lines.push(
    [
      'Итого',
      String(t.bookings),
      csvTenge(t.revenueMinor),
      t.nights > 0 || t.revenueMinor !== '0' ? '100' : '0',
      String(t.nights),
      t.nights > 0 ? '100' : '0',
      t.adrMinor === null ? '' : csvTenge(t.adrMinor),
    ].join(';'),
  );
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
