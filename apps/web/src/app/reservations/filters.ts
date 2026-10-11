import { sourceNames } from '../../lib/hotel-api';
import { CHANNELS } from './sources';
import { paymentStatus } from '../../lib/status/payment';

/**
 * Отбор «Броней» в адресе (ADR-106, срез R2). Значения совпадают с параметрами GET /hotel/reservations:
 * страница ничего не фильтрует сама, она только переводит адрес в запрос и обратно.
 */
export const reservationViews: Record<string, string> = {
  all: 'Все',
  today: 'Сегодня',
  future: 'Будущие',
  inhouse: 'Проживают',
  attention: 'Требуют внимания',
};
export const dateBases: Record<string, string> = {
  stay: 'проживание',
  arrival: 'заезд',
  departure: 'выезд',
  created: 'дата создания',
};
/** Отбор по оплате: слова из реестра `lib/status/payment` (DS1a), ключи = параметр API */
export const paymentFilters: Record<string, string> = {
  '': 'Любая оплата',
  ...Object.fromEntries(Object.entries(paymentStatus).map(([k, s]) => [k, s.label])),
};
export const allocationFilters: Record<string, string> = {
  '': 'Любое размещение',
  assigned: 'Размещение назначено',
  missing: 'Без размещения',
  room: 'Номер',
  bed: 'Койко-место',
};
export const sortOptions: Record<string, string> = {
  '': 'Поздний заезд первым',
  arrival: 'Ближайший заезд',
  departure: 'Ближайший выезд',
  new: 'Новые брони',
  amount: 'Сумма',
  debt: 'Долг',
};

/** Условия, которые пишутся в адрес только когда заданы; порядок — порядок в адресе */
const EXTRA = ['view', 'date', 'source', 'payment', 'allocation', 'category', 'sort'] as const;
const DEFAULTS: Record<(typeof EXTRA)[number], string> = {
  view: 'all',
  date: 'stay',
  source: '',
  payment: '',
  allocation: '',
  category: '',
  sort: '',
};

export interface ReservationFilters {
  from: string;
  to: string;
  status: string;
  q: string;
  page: string;
  view: string;
  date: string;
  source: string;
  payment: string;
  allocation: string;
  category: string;
  sort: string;
}

/**
 * Адрес → отбор. Сахар Главной: `arrival=today|YYYY-MM-DD` и `departure=…` — период по дню заезда или
 * выезда; «today» — день объекта в момент открытия, поэтому закладка остаётся относительной.
 */
export function readFilters(
  sp: Record<string, string | undefined>,
  today: string,
): ReservationFilters {
  const day = (value: string) => (value === 'today' ? today : value);
  // «Все брони дня» Главной (desk-strip) издавна шлёт ?date=YYYY-MM-DD — это день, а не основа даты
  const legacyDay = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date! : null;
  const explicit = Boolean(sp.from || sp.to || (sp.date && !legacyDay));
  const sugar = explicit
    ? null
    : legacyDay
      ? { date: 'stay', day: legacyDay }
      : sp.arrival
        ? { date: 'arrival', day: day(sp.arrival) }
        : sp.departure
          ? { date: 'departure', day: day(sp.departure) }
          : null;
  const view = sp.view || 'all';
  const from = view === 'today' ? today : sugar?.day || sp.from || today;
  const to = view === 'today' ? today : sugar?.day || sp.to || from;
  return {
    from,
    to,
    status: sp.status || 'ALL',
    q: sp.q || '',
    page: sp.page || '1',
    view,
    date: sugar?.date || sp.date || 'stay',
    source: (sp.source || '').trim(),
    payment: sp.payment || '',
    allocation: sp.allocation || '',
    category: sp.category || '',
    sort: sp.sort || '',
  };
}

const extras = (f: ReservationFilters) =>
  Object.fromEntries(EXTRA.filter((k) => f[k] && f[k] !== DEFAULTS[k]).map((k) => [k, f[k]]));

/** Запрос к API: прежние from/to/status/q/page и только заданные условия R2 */
export const apiQuery = (f: ReservationFilters): Record<string, string> => ({
  from: f.from,
  to: f.to,
  status: f.status,
  q: f.q,
  page: f.page,
  ...extras(f),
});

/** Ссылка на тот же отбор с правками: чипы видов и статусов, отрезки, страницы */
export function filtersHref(f: ReservationFilters, changes: Partial<ReservationFilters> = {}) {
  const next = { ...f, ...changes };
  const { page } = changes;
  return `/reservations?${new URLSearchParams({
    from: next.from,
    to: next.to,
    ...(next.status !== 'ALL' ? { status: next.status } : {}),
    ...(next.q ? { q: next.q } : {}),
    ...extras(next),
    ...(page ? { page } : {}),
  })}`;
}

/** Форма шлёт и пустые поля, и умолчания — такой адрес страница чистит одним переходом */
export const needsCleanup = (sp: Record<string, string | undefined>) =>
  sp.q === '' ||
  sp.status === 'ALL' ||
  EXTRA.some((k) => sp[k] !== undefined && (sp[k] === '' || sp[k] === DEFAULTS[k]));

/** Тот же адрес без пустых полей и умолчаний — остальное как пришло */
export const cleanHref = (sp: Record<string, string | undefined>) =>
  `/reservations?${new URLSearchParams(
    Object.entries(sp).filter(
      (e): e is [string, string] =>
        e[1] !== undefined &&
        !(e[0] === 'q' && e[1] === '') &&
        !(e[0] === 'status' && e[1] === 'ALL') &&
        (!(EXTRA as readonly string[]).includes(e[0]) ||
          (e[1] !== '' && e[1] !== DEFAULTS[e[0] as (typeof EXTRA)[number]])),
    ),
  )}`;

/** Слово для источника: канал из списка объекта по подстроке, прямой источник — подписью стойки */
export function sourceLabel(source: string): string {
  const code = source.toUpperCase();
  if (Object.hasOwn(sourceNames, code)) return sourceNames[code]!;
  return CHANNELS.find((c) => c.toLowerCase().includes(source.toLowerCase())) ?? source;
}
