/**
 * Отмены за месяц (PLAN неделя 1, «отчёт по отменам»): чистый разбор без обращения к базе,
 * поэтому проверяется модульными тестами. Считаем по дате заезда: бронь с заездом в месяце
 * либо состоялась, либо была отменена — это тот же знаменатель, что у загрузки.
 * Деньги — целые тиын (ADR-008), долей от денег не берём, только целочисленные проценты штук.
 */

export interface CancelRow {
  /** статус брони: CANCELLED — отменена, NO_SHOW — незаезд, остальное — состоялась */
  status: string;
  source: string;
  channel: string | null;
  arrivalDate: string;
  departureDate: string;
  totalAmount: bigint;
  /** проживания брони: категория и ночи внутри месяца считаются по ним */
  items: Array<{ status: string; category: string; nightsInMonth: number }>;
}

export interface GroupStat {
  name: string;
  total: number;
  cancelled: number;
  noShow: number;
  /** доля отменённых и незаездов от всех броней группы, целые проценты */
  sharePct: number;
  lostAmount: bigint;
  lostNights: number;
}

export interface CancellationsReport {
  month: string;
  total: number;
  cancelled: number;
  noShow: number;
  sharePct: number;
  lostAmount: bigint;
  keptAmount: bigint;
  lostNights: number;
  byChannel: GroupStat[];
  byCategory: Array<{ name: string; cancelled: number; nights: number }>;
}

const isLost = (status: string) => status === 'CANCELLED' || status === 'NO_SHOW';
/** Доля в целых процентах; 0 из 0 — ноль, а не деление на ноль. */
export const pct = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 100);

export function buildCancellations(month: string, rows: CancelRow[]): CancellationsReport {
  const groups = new Map<string, GroupStat>();
  const cats = new Map<string, { cancelled: number; nights: number }>();
  let cancelled = 0;
  let noShow = 0;
  let lostAmount = 0n;
  let keptAmount = 0n;
  let lostNights = 0;

  for (const r of rows) {
    const key = r.channel ? `${r.source} · ${r.channel}` : r.source;
    const g = groups.get(key) ?? {
      name: key,
      total: 0,
      cancelled: 0,
      noShow: 0,
      sharePct: 0,
      lostAmount: 0n,
      lostNights: 0,
    };
    g.total++;
    if (isLost(r.status)) {
      const nights = r.items.reduce((s, i) => s + i.nightsInMonth, 0);
      if (r.status === 'CANCELLED') {
        cancelled++;
        g.cancelled++;
      } else {
        noShow++;
        g.noShow++;
      }
      lostAmount += r.totalAmount;
      lostNights += nights;
      g.lostAmount += r.totalAmount;
      g.lostNights += nights;
      for (const i of r.items) {
        const c = cats.get(i.category) ?? { cancelled: 0, nights: 0 };
        c.cancelled++;
        c.nights += i.nightsInMonth;
        cats.set(i.category, c);
      }
    } else {
      keptAmount += r.totalAmount;
    }
    groups.set(key, g);
  }

  const byChannel = [...groups.values()]
    .map((g) => ({ ...g, sharePct: pct(g.cancelled + g.noShow, g.total) }))
    .sort((a, b) => b.cancelled + b.noShow - (a.cancelled + a.noShow) || b.total - a.total);

  return {
    month,
    total: rows.length,
    cancelled,
    noShow,
    sharePct: pct(cancelled + noShow, rows.length),
    lostAmount,
    keptAmount,
    lostNights,
    byChannel,
    byCategory: [...cats]
      .map(([name, c]) => ({ name, ...c }))
      .sort((a, b) => b.cancelled - a.cancelled),
  };
}

/** Тиын → «15 688 018,00 ₸». Формат тот же, что в сверке балансов. */
export function money(m: bigint): string {
  const neg = m < 0n;
  const d = (neg ? -m : m).toString().padStart(3, '0');
  const whole = d.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '−' : ''}${whole},${d.slice(-2)} ₸`;
}

export function renderCancellations(r: CancellationsReport, note: string): string {
  return [
    `# Отмены за ${r.month}`,
    '',
    note,
    '',
    '| Показатель | Значение |',
    '|---|---:|',
    `| Броней с заездом в месяце | ${r.total} |`,
    `| Отменено | ${r.cancelled} |`,
    `| Незаезды | ${r.noShow} |`,
    `| Доля отменённых и незаездов | ${r.sharePct} % |`,
    `| Не доехало денег | ${money(r.lostAmount)} |`,
    `| Заработано состоявшимися | ${money(r.keptAmount)} |`,
    `| Потеряно единице-суток внутри месяца | ${r.lostNights} |`,
    '',
    '## По источникам',
    '',
    '| Источник | Броней | Отменено | Незаезды | Доля | Не доехало | Единице-суток |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...r.byChannel.map(
      (g) =>
        `| ${g.name} | ${g.total} | ${g.cancelled} | ${g.noShow} | ${g.sharePct} % | ${money(g.lostAmount)} | ${g.lostNights} |`,
    ),
    '',
    '## По категориям (отменённые проживания)',
    '',
    '| Категория | Проживаний | Единице-суток |',
    '|---|---:|---:|',
    ...r.byCategory.map((c) => `| ${c.name} | ${c.cancelled} | ${c.nights} |`),
    '',
  ].join('\n');
}
