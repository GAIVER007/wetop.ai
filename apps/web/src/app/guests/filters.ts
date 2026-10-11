/**
 * «Гости и бронирования» (план guests-bookings-2026-10-09): отбор справочника целиком в адресе. Разбор адреса,
 * запрос к API и ссылки с отбором живут здесь, одним местом для страницы, чипов, плиток и формы. Короткий адрес
 * без умолчаний: «Все» это просто `/guests`.
 *
 * Параметры прежних «Гостей v2» (`last`, `visits`, `sort`) страница больше не читает: у экрана нет под них
 * элементов, а скрытый отбор вводил бы в заблуждение. API их по-прежнему понимает.
 */
export type GuestSection = 'ALL' | 'INHOUSE' | 'EXPECTED' | 'RECENT' | 'NONE';
export type GuestView = 'all' | 'today' | 'inhouse' | 'expected' | 'departures' | 'attention';
export type GuestPeriod = '' | 'today' | '7d' | '30d' | 'range';
export const PAGE_SIZES = [10, 25, 50] as const;
export type GuestPageSize = (typeof PAGE_SIZES)[number];

export interface GuestFilters {
  /** быстрый вид: ряд чипов под полосой поиска */
  view: GuestView;
  /** «Статус»: состояние гостя */
  state: GuestSection;
  /** поиск как введён (края обрезаны); ищется от двух символов */
  q: string;
  /** «Источник»: код источника или название канала продаж, как в «Бронях» */
  source: string;
  /** «Период»: даты основного проживания пересекают окно */
  period: GuestPeriod;
  from: string;
  to: string;
  debt: boolean;
  fresh: boolean;
  nocontact: boolean;
  page: string;
  size: GuestPageSize;
  /** выбранный гость: `id`, пусто (по умолчанию первый в списке) или `none` (панель закрыта) */
  guest: string;
}

export const VIEWS: ReadonlyArray<{ id: GuestView; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'today', label: 'Сегодня' },
  { id: 'inhouse', label: 'Проживают' },
  { id: 'expected', label: 'Ожидают' },
  { id: 'departures', label: 'Выезды' },
  { id: 'attention', label: 'Проблемные' },
];
/** Слова состояния гостя в выпадающем «Статус»; на экране это состояние человека, а не статус брони (ТЗ «Гости v2» §15) */
export const STATES: ReadonlyArray<[GuestSection, string]> = [
  ['ALL', 'Все статусы'],
  ['INHOUSE', 'Проживает'],
  ['EXPECTED', 'Ожидается'],
  ['RECENT', 'Выехал недавно'],
  ['NONE', 'Без активного проживания'],
];
export const PERIODS: ReadonlyArray<[GuestPeriod, string]> = [
  ['', 'Все даты'],
  ['today', 'Сегодня'],
  ['7d', '7 дней'],
  ['30d', '30 дней'],
  ['range', 'Свои даты'],
];
/** Три переключателя под чипами: имя в адресе, подпись, поле отбора */
export const TOGGLES: ReadonlyArray<{ id: 'debt' | 'fresh' | 'nocontact'; label: string }> = [
  { id: 'debt', label: 'Только с долгом' },
  { id: 'fresh', label: 'Только новые' },
  { id: 'nocontact', label: 'Только без контакта' },
];

// 13-й месяц даёт Invalid Date, его toISOString() бросает RangeError: сначала число
const isDay = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(`${v}T00:00:00Z`)) &&
  new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

export const DEFAULT_FILTERS: GuestFilters = {
  view: 'all',
  state: 'ALL',
  q: '',
  source: '',
  period: '',
  from: '',
  to: '',
  debt: false,
  fresh: false,
  nocontact: false,
  page: '1',
  size: 10,
  guest: '',
};

/** Отбор из адреса. Ошибка — слово для страницы; тогда отбор сбрасывается к полному списку */
export function parseGuestFilters(sp: Record<string, string | undefined>): {
  f: GuestFilters;
  error: string | null;
} {
  const size = Number(sp.size || 10);
  const f: GuestFilters = {
    view: (sp.view || 'all') as GuestView,
    state: (sp.state ? sp.state.toUpperCase() : 'ALL') as GuestSection,
    q: (sp.q ?? '').trim(),
    source: (sp.source ?? '').trim(),
    period: (sp.period ?? '') as GuestPeriod,
    from: sp.from ?? '',
    to: sp.to ?? '',
    debt: sp.debt === '1',
    fresh: sp.fresh === '1',
    nocontact: sp.nocontact === '1',
    page: sp.page || '1',
    size: size as GuestPageSize,
    guest: sp.guest ?? '',
  };
  const error = !VIEWS.some((v) => v.id === f.view)
    ? 'Неизвестный вид списка.'
    : !STATES.some(([id]) => id === f.state)
      ? 'Неизвестный статус гостя.'
      : !/^\d+$/.test(f.page) || Number(f.page) < 1 || Number(f.page) > 10000
        ? 'Номер страницы должен быть от 1 до 10000.'
        : !(PAGE_SIZES as readonly number[]).includes(f.size)
          ? 'Размер страницы: 10, 25 или 50.'
          : f.q.length > 120
            ? 'Поиск: не более 120 символов.'
            : f.source.length > 64
              ? 'Источник: не более 64 символов.'
              : !PERIODS.some(([id]) => id === f.period)
                ? 'Неизвестный период.'
                : f.period === 'range' &&
                    !(isDay(f.from) && isDay(f.to) && f.from <= f.to)
                  ? 'Период: укажите даты «с» и «по», «с» не позже «по».'
                  : f.period === 'range' &&
                      Date.parse(f.to) - Date.parse(f.from) > 365 * 86400000
                    ? 'Период: не длиннее 366 дней.'
                    : null;
  if (error) return { f: { ...DEFAULT_FILTERS }, error };
  // даты нужны только своим периодом: в адресе без него они ничего не значат
  if (f.period !== 'range') {
    f.from = '';
    f.to = '';
  }
  return { f, error: null };
}

/** Параметры адреса без значений по умолчанию: ссылки короткие, «Все» это просто /guests */
function params(f: GuestFilters): Record<string, string> {
  return {
    ...(f.view !== 'all' ? { view: f.view } : {}),
    ...(f.state !== 'ALL' ? { state: f.state.toLowerCase() } : {}),
    ...(f.q.length >= 2 ? { q: f.q } : {}),
    ...(f.source ? { source: f.source } : {}),
    ...(f.period ? { period: f.period } : {}),
    ...(f.period === 'range' ? { from: f.from, to: f.to } : {}),
    ...(f.debt ? { debt: '1' } : {}),
    ...(f.fresh ? { fresh: '1' } : {}),
    ...(f.nocontact ? { nocontact: '1' } : {}),
    ...(f.size !== 10 ? { size: String(f.size) } : {}),
    ...(f.page !== '1' ? { page: f.page } : {}),
    ...(f.guest ? { guest: f.guest } : {}),
  };
}

/**
 * Ссылка с тем же отбором и заменой. Смена отбора возвращает на первую страницу и снимает выбранного гостя
 * (по умолчанию выбран первый в новой выдаче); смена одной только страницы или выбора ничего не сбрасывает.
 */
export function guestsHref(f: GuestFilters, over: Partial<GuestFilters> = {}): string {
  const keepsPage = 'page' in over || 'guest' in over;
  const next: GuestFilters = {
    ...f,
    ...(keepsPage ? {} : { page: '1', guest: '' }),
    ...(over.page && !('guest' in over) ? { guest: '' } : {}),
    ...over,
  };
  const tail = new URLSearchParams(params(next)).toString();
  return `/guests${tail ? `?${tail}` : ''}`;
}

/** Скрытые поля формы: отбор, который форма сама не задаёт, едет дальше (выбранный гость и страница сбрасываются) */
export function keptParams(f: GuestFilters, drop: ReadonlyArray<string>): Record<string, string> {
  const all = params({ ...f, page: '1', guest: '' });
  return Object.fromEntries(Object.entries(all).filter(([k]) => !drop.includes(k)));
}

/** Запрос к `GET /guests/directory` */
export function directoryQuery(f: GuestFilters): Record<string, string> {
  return {
    ...(f.state !== 'ALL' ? { state: f.state } : {}),
    ...(f.view !== 'all' ? { view: f.view } : {}),
    ...(f.q.length >= 2 ? { q: f.q } : {}),
    ...(f.source ? { source: f.source } : {}),
    ...(f.debt ? { debt: '1' } : {}),
    ...(f.fresh ? { fresh: '1' } : {}),
    ...(f.nocontact ? { nocontact: '1' } : {}),
    ...(f.period ? { period: f.period } : {}),
    ...(f.period === 'range' ? { periodFrom: f.from, periodTo: f.to } : {}),
    page: f.page,
    pageSize: String(f.size),
  };
}

/** Задан ли какой-то отбор, кроме быстрого вида: «Сбросить фильтры» и число на кнопке «Фильтры» на телефоне */
export const activeSelects = (f: GuestFilters) =>
  [f.state !== 'ALL', f.source, f.period, f.debt, f.fresh, f.nocontact].filter(Boolean).length;

/** Включён ли хоть один отбор, включая вид и поиск */
export const filtersOn = (f: GuestFilters) =>
  f.view !== 'all' || f.q.length >= 2 || activeSelects(f) > 0;

/**
 * Форма и ссылки иногда шлют пустые поля и умолчания (`size=10`, `view=all`): адрес с ними страница чистит одним
 * переходом, чтобы им можно было поделиться. Неизвестные параметры не трогаются.
 */
export function needsCleanup(sp: Record<string, string | undefined>): boolean {
  const idle = (key: string, isDefault: (value: string) => boolean) =>
    sp[key] !== undefined && isDefault(sp[key]!);
  return (
    idle('view', (v) => v === '' || v === 'all') ||
    idle('state', (v) => v === '' || v.toUpperCase() === 'ALL') ||
    idle('q', (v) => v === '') ||
    idle('source', (v) => v === '') ||
    idle('period', (v) => v === '') ||
    idle('from', () => sp.period !== 'range') ||
    idle('to', () => sp.period !== 'range') ||
    idle('debt', (v) => v !== '1') ||
    idle('fresh', (v) => v !== '1') ||
    idle('nocontact', (v) => v !== '1') ||
    idle('size', (v) => v === '' || v === '10') ||
    idle('page', (v) => v === '' || v === '1') ||
    idle('guest', (v) => v === '')
  );
}
