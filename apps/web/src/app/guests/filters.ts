/**
 * «Гости v2», G7 (ТЗ §28, §30, §31): отбор справочника целиком в адресе. Разбор адреса, запрос к API
 * и ссылки с отбором — здесь, одним местом для страницы, чипов, поиска и «Показать».
 */
export type GuestSection = 'ALL' | 'INHOUSE' | 'EXPECTED' | 'RECENT' | 'NONE';
export interface GuestFilters {
  state: GuestSection;
  /** поиск как введён (края обрезаны); ищется от двух символов */
  q: string;
  last: '' | 'today' | '7d' | '30d' | 'period';
  from: string;
  to: string;
  visits: '' | '1' | '2-5' | '6+';
  sort: 'name' | 'next' | 'last' | 'visits';
  page: string;
}

export const SECTIONS: ReadonlyArray<{ id: GuestSection; label: string; meta: string }> = [
  { id: 'ALL', label: 'Все', meta: '' },
  { id: 'INHOUSE', label: 'Проживают', meta: 'проживают' },
  { id: 'EXPECTED', label: 'Ожидаются', meta: 'ожидаются' },
  { id: 'RECENT', label: 'Недавние', meta: 'выехали за 30 дней' },
  { id: 'NONE', label: 'Без активного проживания', meta: 'без активного проживания' },
];
/** Последний визит — дата выезда последнего состоявшегося визита (колонка «Последний визит») */
export const LAST_VISIT: ReadonlyArray<[GuestFilters['last'], string]> = [
  ['', 'любой'],
  ['today', 'сегодня'],
  ['7d', 'за 7 дней'],
  ['30d', 'за 30 дней'],
  ['period', 'период'],
];
/** В ТЗ «2–5» и «5+» пересекаются на пяти — «больше 5», чтобы гость не попадал в оба отбора */
export const VISITS: ReadonlyArray<[GuestFilters['visits'], string]> = [
  ['', 'любое'],
  ['1', '1'],
  ['2-5', '2–5'],
  ['6+', 'больше 5'],
];
export const SORTS: ReadonlyArray<[GuestFilters['sort'], string]> = [
  ['name', 'по имени'],
  ['next', 'ближайший заезд'],
  ['last', 'последний визит'],
  ['visits', 'больше визитов'],
];

/** Старые адреса ?status=CHECKED_IN живут в закладках и тестах — читаются как раздел */
const LEGACY_STATUS: Record<string, GuestSection> = {
  ALL: 'ALL',
  CHECKED_IN: 'INHOUSE',
  CONFIRMED: 'EXPECTED',
  TENTATIVE: 'EXPECTED',
  CHECKED_OUT: 'RECENT',
};
// 13-й месяц даёт Invalid Date, его toISOString() бросает RangeError: сначала число
const isDay = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(`${v}T00:00:00Z`)) &&
  new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const oneOf = <T extends string>(value: string, options: ReadonlyArray<[T, string]>) =>
  options.some(([id]) => id === value);

/** Отбор из адреса. Ошибка — слово для страницы; тогда отбор сбрасывается к полному списку */
export function parseGuestFilters(sp: Record<string, string | undefined>): {
  f: GuestFilters;
  error: string | null;
} {
  const stateRaw = sp.state
    ? sp.state.toUpperCase()
    : sp.status
      ? (LEGACY_STATUS[sp.status] ?? sp.status)
      : 'ALL';
  const f: GuestFilters = {
    state: stateRaw as GuestSection,
    q: (sp.q ?? '').trim(),
    last: (sp.last ?? '') as GuestFilters['last'],
    from: sp.from ?? '',
    to: sp.to ?? '',
    visits: (sp.visits ?? '') as GuestFilters['visits'],
    sort: (sp.sort || 'name') as GuestFilters['sort'],
    page: sp.page || '1',
  };
  const error = !SECTIONS.some((s) => s.id === f.state)
    ? 'Неизвестный раздел гостей.'
    : !/^\d+$/.test(f.page) || Number(f.page) < 1 || Number(f.page) > 10000
      ? 'Номер страницы должен быть от 1 до 10000.'
      : f.q.length > 120
        ? 'Поиск: не более 120 символов.'
        : !oneOf(f.last, LAST_VISIT)
          ? 'Неизвестный отбор по последнему визиту.'
          : f.last === 'period' && !(isDay(f.from) && isDay(f.to) && f.from <= f.to)
            ? 'Период последнего визита: укажите даты «с» и «по», «с» не позже «по».'
            : !oneOf(f.visits, VISITS)
              ? 'Неизвестный отбор по числу визитов.'
              : !oneOf(f.sort, SORTS)
                ? 'Неизвестный порядок списка.'
                : null;
  if (error)
    return {
      f: { state: 'ALL', q: '', last: '', from: '', to: '', visits: '', sort: 'name', page: '1' },
      error,
    };
  // даты периода нужны только периоду: в адресе без него они ничего не значат
  if (f.last !== 'period') {
    f.from = '';
    f.to = '';
  }
  return { f, error: null };
}

/** Параметры адреса без значений по умолчанию: ссылки короткие, «Все» — просто /guests */
function params(f: GuestFilters): Record<string, string> {
  return {
    ...(f.state !== 'ALL' ? { state: f.state.toLowerCase() } : {}),
    ...(f.q.length >= 2 ? { q: f.q } : {}),
    ...(f.last ? { last: f.last } : {}),
    ...(f.last === 'period' ? { from: f.from, to: f.to } : {}),
    ...(f.visits ? { visits: f.visits } : {}),
    ...(f.sort !== 'name' ? { sort: f.sort } : {}),
    ...(f.page !== '1' ? { page: f.page } : {}),
  };
}

/** Ссылка с тем же отбором и заменой; смена отбора возвращает на первую страницу */
export function guestsHref(f: GuestFilters, over: Partial<GuestFilters> = {}): string {
  const next = { ...f, ...(over.page ? {} : { page: '1' }), ...over };
  const tail = new URLSearchParams(params(next)).toString();
  return `/guests${tail ? `?${tail}` : ''}`;
}

/** Скрытые поля для форм поиска и «Показать»: отбор, который форма сама не задаёт, едет дальше */
export function keptParams(f: GuestFilters, drop: ReadonlyArray<string>): Record<string, string> {
  const all = params({ ...f, page: '1' });
  return Object.fromEntries(Object.entries(all).filter(([k]) => !drop.includes(k)));
}

/** Запрос к `GET /guests/directory` */
export function directoryQuery(f: GuestFilters, pageSize: number): Record<string, string> {
  return {
    ...(f.state !== 'ALL' ? { state: f.state } : {}),
    ...(f.q.length >= 2 ? { q: f.q } : {}),
    ...(f.last ? { last: f.last } : {}),
    ...(f.last === 'period' ? { from: f.from, to: f.to } : {}),
    ...(f.visits ? { visits: f.visits } : {}),
    ...(f.sort !== 'name' ? { sort: f.sort } : {}),
    page: f.page,
    pageSize: String(pageSize),
  };
}

/** Отбор словами для строки над таблицей: «последний визит за 7 дней, 2–5 визитов»; период — §14 */
export function describeFilters(
  f: GuestFilters,
  period: (from: string, to: string) => string,
): string[] {
  const words: string[] = [];
  if (f.last === 'period') words.push(`последний визит ${period(f.from, f.to)}`);
  else if (f.last) words.push(`последний визит ${LAST_VISIT.find(([id]) => id === f.last)![1]}`);
  if (f.visits === '1') words.push('1 визит');
  else if (f.visits === '2-5') words.push('2–5 визитов');
  else if (f.visits === '6+') words.push('больше 5 визитов');
  return words;
}

/** Задан ли какой-то отбор, кроме раздела и поиска (число на кнопке «Фильтры» на телефоне) */
export const activeSelects = (f: GuestFilters) =>
  [f.last, f.visits, f.sort !== 'name' ? f.sort : ''].filter(Boolean).length;
