/**
 * Сквозная проверка слоёв (поручение владельца 14.09.2026: «проект работает как единое целое»).
 * Чистые функции для cli-system-trace.ts: разбор HTML экранов WETOP и сравнение одного и того же факта в слоях
 * Exely → Supabase → API → экран. Без сети и БД — всё приходит аргументами.
 */

/** Подписи статусов на карточке брони (apps/web/src/app/reservations/[number]/page.tsx, STATUS_RU) */
export const STATUS_LABEL: Record<string, string> = {
  TENTATIVE: 'предварительная',
  CONFIRMED: 'подтверждена',
  CHECKED_IN: 'заселён',
  CHECKED_OUT: 'выселен',
  CANCELLED: 'отменена',
  NO_SHOW: 'незаезд',
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
  '#x27': "'",
};

/** Текст фрагмента HTML: без комментариев React (`<!-- -->`), тегов и сущностей, пробелы схлопнуты */
export function htmlText(fragment: string): string {
  return fragment
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, name: string) => {
      const lower = name.toLowerCase();
      if (ENTITIES[lower] !== undefined) return ENTITIES[lower]!;
      if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
      if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10));
      return m;
    })
    .replace(/[\s\u00a0\u202f]+/g, ' ')
    .trim();
}

/** Сумма с экрана («11 508,30 ₸», «−500,00 ₸») → тиыны строкой; null, если цифр нет */
export function minorFromText(text: string): string | null {
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return null;
  const negative = /[−-]\s*\d/.test(text);
  return `${negative ? '-' : ''}${BigInt(digits).toString()}`;
}

/** Текст первого элемента с data-testid (вложенных одноимённых тегов у таких элементов нет) */
export function testIdText(html: string, testId: string): string | null {
  const at = html.indexOf(`data-testid="${testId}"`);
  if (at < 0) return null;
  const open = html.lastIndexOf('<', at);
  const tag = /^<([a-zA-Z0-9]+)/.exec(html.slice(open))?.[1];
  const start = html.indexOf('>', at);
  if (!tag || start < 0) return null;
  const end = html.indexOf(`</${tag}>`, start);
  return end < 0 ? null : htmlText(html.slice(start + 1, end));
}

export interface UiStayRow {
  unitCode: string | null;
  category: string;
  arrivalDate: string;
  departureDate: string;
  statusLabel: string;
  priceMinor: string | null;
}

/** Строки «Проживания» на карточке брони: ячейка, категория, заезд, выезд, статус, цена (гостей не читаем — ПД) */
export function parseStayRows(html: string): UiStayRow[] {
  const rows: UiStayRow[] = [];
  for (const m of html.matchAll(/<tr\b[^>]*data-testid="stay-row"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...m[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((c) => htmlText(c[1]!));
    if (cells.length < 6) continue;
    rows.push({
      unitCode: cells[0]!.includes('не назначена') ? null : cells[0]!,
      category: cells[1]!,
      arrivalDate: cells[2]!,
      departureDate: cells[3]!,
      statusLabel: cells[4]!,
      priceMinor: minorFromText(cells[5]!),
    });
  }
  return rows;
}

export interface UiStayCell {
  number: string;
  itemId: string | null;
  date: string;
  unitCode: string;
}

/** Клетки броней на шахматке: номер брони, проживание, дата и ячейка из атрибутов (подпись с именем не читаем) */
export function parseStayCells(html: string): UiStayCell[] {
  const cells: UiStayCell[] = [];
  for (const m of html.matchAll(/<[a-z]+\b[^>]*data-testid="stay-cell"[^>]*>/g)) {
    const attr = (name: string) => new RegExp(` ${name}="([^"]*)"`).exec(m[0])?.[1] ?? null;
    const number = attr('data-number');
    const date = attr('data-date');
    const unitCode = attr('data-unit-code');
    if (number && date && unitCode)
      cells.push({ number, itemId: attr('data-item-id'), date, unitCode });
  }
  return cells;
}

/** Состояние проживания, одинаково описанное для каждого слоя */
export interface StayState {
  status: string;
  arrivalDate: string;
  departureDate: string;
  categoryCode: string;
  priceMinor: string;
}

const FIELDS: Array<[keyof StayState, string]> = [
  ['status', 'статус'],
  ['arrivalDate', 'заезд'],
  ['departureDate', 'выезд'],
  ['categoryCode', 'категория'],
  ['priceMinor', 'цена'],
];

/** Поля, которые разошлись: «статус CONFIRMED ≠ CHECKED_IN» */
export function stayDiff(expected: StayState, actual: StayState): string[] {
  return FIELDS.filter(([k]) => expected[k] !== actual[k]).map(
    ([k, label]) => `${label} ${expected[k]} ≠ ${actual[k]}`,
  );
}

export type ExelyVerdict = 'ok' | 'pending-sync' | 'mismatch';

/**
 * Exely → база: расхождение по брони, изменённой в Exely после старта последней синхронизации, — не ошибка,
 * а «ещё в пути» (следующий прогон через 5 минут её заберёт). Всё остальное — расхождение.
 */
export function exelyVerdict(
  diffs: readonly string[],
  lastModifiedUtc: string | null,
  lastSyncStartedAtUtc: string | null,
): ExelyVerdict {
  if (diffs.length === 0) return 'ok';
  if (lastModifiedUtc && lastSyncStartedAtUtc && Date.parse(lastModifiedUtc) >= Date.parse(lastSyncStartedAtUtc))
    return 'pending-sync';
  return 'mismatch';
}

export interface DayCounts {
  arrivals: number;
  departures: number;
  inHouse: number;
  toCheckIn: number;
  toCheckOut: number;
}

export interface StayForDay {
  status: string;
  arrivalDate: string;
  departureDate: string;
}

const INACTIVE = new Set(['CANCELLED', 'NO_SHOW']);

/** Счётчики рабочего дня по правилам стойки (apps/api/src/desk: DeskService.today + DeskRepository.stays) */
export function deskCounts(stays: readonly StayForDay[], day: string): DayCounts {
  const active = stays.filter(
    (s) => !INACTIVE.has(s.status) && s.arrivalDate <= day && s.departureDate >= day,
  );
  const arrivals = active.filter((s) => s.arrivalDate === day);
  const departures = active.filter((s) => s.departureDate === day);
  return {
    arrivals: arrivals.length,
    departures: departures.length,
    inHouse: active.filter((s) => s.status === 'CHECKED_IN' && s.departureDate !== day).length,
    toCheckIn: arrivals.filter((s) => s.status === 'CONFIRMED' || s.status === 'TENTATIVE').length,
    toCheckOut: departures.filter((s) => s.status === 'CHECKED_IN').length,
  };
}

/** Строка сравнения одного показателя в нескольких слоях; null — слой этот показатель не показывает */
export interface LayerRow {
  metric: string;
  values: Record<string, number | string | null>;
}

/** Показатели, у которых слои (без null) разошлись */
export function layerMismatches(rows: readonly LayerRow[]): LayerRow[] {
  return rows.filter((r) => {
    const present = Object.values(r.values).filter((v) => v !== null).map(String);
    return new Set(present).size > 1;
  });
}
