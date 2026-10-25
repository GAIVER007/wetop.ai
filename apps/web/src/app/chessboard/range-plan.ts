/**
 * Создание брони выделением и щелчок по пустой клетке (ТЗ «Шахматка v2» §31–32). Чистая часть: какие
 * ночи выделены и что написать в окошке. Команд здесь нет — окошко ведёт на существующие формы брони
 * и блокировки, уже заполненные; проверку доступности делает форма и сервер, как и раньше.
 */
import { nightsBetween } from '../../lib/plural';
import { nightsLabel, RU, shortDate, type Lang } from './lang';

/**
 * Выделение от клетки, где прижали мышь, до клетки под мышью — только по свободным ночам подряд: на
 * занятую или закрытую ночь оно не заходит. С занятой клетки не начинается (`null`).
 */
export function selectRange(
  cells: ReadonlyArray<{ state: string }>,
  anchor: number,
  hover: number,
): { from: number; to: number } | null {
  if (cells[anchor]?.state !== 'FREE') return null;
  const target = Math.max(0, Math.min(cells.length - 1, hover));
  const step = target >= anchor ? 1 : -1;
  let end = anchor;
  while (end !== target && cells[end + step]?.state === 'FREE') end += step;
  return { from: Math.min(anchor, end), to: Math.max(anchor, end) };
}

export interface FreeMenu {
  /** Одна клетка (щелчок, §32) или период (выделение, §31) */
  single: boolean;
  /** «Номер R07» / «Койка M03» */
  title: string;
  category: string;
  /** «27 сент. → 30 сент., 3 ночи»; для одной клетки — «27 сент.» */
  dates: string;
  /** «Свободен» / «Свободна» — только у одной клетки (§32) */
  state: string | null;
  createLabel: string;
  blockLabel: string;
  /** Форма брони с ячейкой и датами; категорию форма берёт по ячейке */
  newHref: string;
  /** Карточка ячейки с периодом блокировки; «по» не включается, как у API (`dateTo > dateFrom`) */
  blockHref: string;
}

const nextDay = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Окошко свободного периода: первая и последняя выделенные ночи */
export function freeMenuModel(
  unit: { code: string; kind: 'ROOM' | 'BED'; categoryName: string },
  fromDate: string,
  lastDate: string,
  lang: Lang = RU,
): FreeMenu {
  const { t } = lang;
  const departure = nextDay(lastDate);
  const single = fromDate === lastDate;
  const bed = unit.kind === 'BED';
  const code = encodeURIComponent(unit.code);
  return {
    single,
    title: bed ? t('Койка {code}', { code: unit.code }) : t('Номер {code}', { code: unit.code }),
    category: unit.categoryName,
    dates: single
      ? shortDate(lang, fromDate)
      : `${shortDate(lang, fromDate)} → ${shortDate(lang, departure)}, ${nightsLabel(lang, nightsBetween(fromDate, departure))}`,
    state: single ? (bed ? t('Свободна') : t('Свободен')) : null,
    createLabel: single ? t('Новая бронь') : t('Создать бронь'),
    blockLabel: single ? t('Блокировка') : t('Заблокировать'),
    newHref: `/reservations/new?arrival=${fromDate}&departure=${departure}&unit=${code}`,
    blockHref: `/units/${code}?blockFrom=${fromDate}&blockTo=${departure}#block-form`,
  };
}
