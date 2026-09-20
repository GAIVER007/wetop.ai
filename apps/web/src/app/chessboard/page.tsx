import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { MAX_CHESSBOARD_DAYS } from '@pms/domain';
import { channelsApi, chessboardApi, guardApi, type UnassignedStay } from '../../lib/api';
import { ResolveMenu } from './resolve-menu';
import { BoardHelp } from './board-help';
import { nightsBetween, pluralRu } from '../../lib/plural';
import { Page } from '../../components/page';
import { Alert, Button, Input, Legend, cx } from '../../components/ui';
import { ChessboardGrid } from './board-grid';
import { displayDate } from '../../lib/display-date';
import { validDate } from '../../lib/hotel-api';
import { Icon } from '../../components/icon';
import { monthPeriod } from './month-period';
import { weekPeriod } from './week-period';
import './board.css';

const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'предварительная',
  CONFIRMED: 'подтверждена',
  CHECKED_IN: 'заселён',
  CHECKED_OUT: 'выселен',
  CANCELLED: 'отменена',
  NO_SHOW: 'незаезд',
};

/**
 * Slice 2, шаг 2.7: шахматка — 88 ячеек × даты. Страница остаётся server component; сетка вынесена
 * в клиентский компонент ради перетаскивания брони между ячейками (переселение).
 */
export default async function ChessboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = normalizeSearchParams(await searchParams);
  const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  const currentWeek = weekPeriod(today);
  const from = query.from || currentWeek.from;
  const to =
    query.to ||
    (!query.from
      ? currentWeek.to
      : validDate(from)
        ? new Date(Date.parse(`${from}T00:00:00Z`) + 13 * 86400000).toISOString().slice(0, 10)
        : '');
  const invalidPeriod =
    !validDate(from) ||
    !validDate(to) ||
    (from &&
      to &&
      (from > to || Date.parse(to) - Date.parse(from) > (MAX_CHESSBOARD_DAYS - 1) * 86400000));
  if (invalidPeriod)
    return (
      <Page title="Шахматка">
        <form method="get" className="row toolbar">
          <Input type="date" name="from" aria-label="Шахматка: с" defaultValue={from} />
          <Input type="date" name="to" aria-label="Шахматка: по" defaultValue={to} />
          <Button>Показать</Button>
        </form>
        <Alert boxed>
          Выберите корректный период до {MAX_CHESSBOARD_DAYS} дней.{' '}
          <Link href="/chessboard">Сбросить фильтры</Link>
        </Alert>
      </Page>
    );
  // Плашки конфликтов (срез 7.3, Д3–Д4) — только чтение: сверх мест из открытых неисправностей сторожа,
  // входящие брони, которые PMS не разобрала, — из ленты событий; их отказ шахматку не роняет
  const [board, incidents, events] = await Promise.all([
    chessboardApi.board(from, to),
    guardApi.incidents('open').catch(() => null),
    channelsApi.events({ limit: 50, status: 'FAILED' }).catch(() => null),
  ]);
  const overbooked = (incidents ?? []).filter((i) => i.kind === 'stay.overbooked');
  const failedEvents = events?.total ?? 0;
  const month = monthPeriod(from);
  const isMonth = from === month.from && to === month.to;
  const week = weekPeriod(from);
  const isWeek = from === week.from && to === week.to;
  const weekHref = (offset = 0) => {
    const period = weekPeriod(from, offset);
    return `/chessboard?from=${period.from}&to=${period.to}`;
  };
  const monthHref = (offset = 0) => {
    const period = monthPeriod(from, offset);
    return `/chessboard?from=${period.from}&to=${period.to}`;
  };
  const monthLabel = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${from}T00:00:00Z`));
  /** Произвольное окно от сегодня; календарные режимы сохраняют границы недели/месяца. */
  const window = (days: number) => {
    const t = new Date(`${today}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + days - 1);
    return `/chessboard?from=${today}&to=${t.toISOString().slice(0, 10)}`;
  };
  const shift = (days: number) => {
    const f = new Date(`${board.from}T00:00:00Z`);
    f.setUTCDate(f.getUTCDate() + days);
    const t = new Date(`${board.to}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + days);
    return `/chessboard?from=${f.toISOString().slice(0, 10)}&to=${t.toISOString().slice(0, 10)}`;
  };

  return (
    <Page
      width="full"
      title="Шахматка"
      subtitle={`${isMonth ? monthLabel : `${displayDate(board.from)} — ${displayDate(board.to)}`} · Номера и койки · ${board.rows.length} мест`}
      actions={
        <div className="board-period">
          <Link className="btn" href="/reservations/new">
            <Icon name="plus" />
            Новая бронь
          </Link>
          <span className="seg">
            <Link
              href={weekHref()}
              className={cx(isWeek && 'is-on')}
              aria-current={isWeek ? 'true' : undefined}
            >
              Неделя
            </Link>
            <Link href={window(14)} className={cx(board.dates.length === 14 && 'is-on')}>
              14 дней
            </Link>
            <Link
              href={monthHref()}
              className={cx(isMonth && 'is-on')}
              aria-current={isMonth ? 'true' : undefined}
            >
              Месяц
            </Link>
          </span>
          <span className="board-date-nav">
            <Link
              href={isMonth ? monthHref(-1) : isWeek ? weekHref(-1) : shift(-board.dates.length)}
              className="icon-button"
              aria-label={
                isMonth ? 'Предыдущий месяц' : isWeek ? 'Предыдущая неделя' : 'Предыдущий период'
              }
            >
              <Icon name="chevron" className="rotate-left" />
            </Link>
            <Link href="/chessboard" className="btn btn--secondary">
              Сегодня
            </Link>
            <Link
              href={isMonth ? monthHref(1) : isWeek ? weekHref(1) : shift(board.dates.length)}
              className="icon-button"
              aria-label={
                isMonth ? 'Следующий месяц' : isWeek ? 'Следующая неделя' : 'Следующий период'
              }
            >
              <Icon name="chevron" />
            </Link>
          </span>
        </div>
      }
    >
      {/* Одна планка вместо четырёх рядов: период, легенда, «без ячейки», подсказка — сетке остаётся экран */}
      <div className="board-bar">
        <form key={`${board.from}-${board.to}`} method="get" className="board-range-form">
          <label className="field field--inline">
            Период
            <Input type="date" name="from" defaultValue={board.from} aria-label="Шахматка: с" />
          </label>
          <span className="muted">—</span>
          <Input type="date" name="to" defaultValue={board.to} aria-label="Шахматка: по" />
          <Button tone="secondary" type="submit">
            Применить
          </Button>
        </form>
        <Legend
          data-testid="board-legend"
          items={[
            { color: 'var(--st-confirmed)', label: 'подтверждена', glyph: '•' },
            { color: 'var(--st-checked-in)', label: 'заселён', glyph: '✓' },
            { color: 'var(--st-checked-out)', label: 'выселен', glyph: '✕' },
            { color: 'var(--st-tentative)', label: 'не подтверждена', glyph: '?' },
            { color: 'var(--st-blocked)', label: 'блокировка', glyph: '▨' },
          ]}
        />
        {!(board.unassigned ?? []).length && <UnassignedStays stays={[]} />}
        <BoardHelp title="Как работать с шахматкой">
          <p className="note">
            В строке категории — сколько мест свободно на эту ночь; под датой в шапке — свободно и
            занято из {board.rows.length}. Ночь выезда ячейку не занимает. Клик по занятой клетке
            открывает бронь, по пустой — форму новой брони на эту дату. Перетащите клетку на другую
            строку — бронь переселится в ту ячейку с даты взятой клетки (в другую категорию — только
            на всё проживание). Фильтры статусов считаются на {displayDate(board.from)}. Брони без
            ячейки на сетке не видны — они в списке над сеткой; ячейка назначается с карточки брони.
          </p>
        </BoardHelp>
      </div>
      {overbooked.length > 0 && (
        <Alert boxed data-testid="overbooked-callout">
          Продано сверх мест: {overbooked.map((i) => i.title).join('; ')}.{' '}
          <a href="#unassigned-stays">Разрешить</a>
        </Alert>
      )}
      {failedEvents > 0 && (
        <Alert boxed tone="warning" data-testid="review-callout">
          Входящая бронь требует разбора: {pluralRu(failedEvents, ['ревизия', 'ревизии', 'ревизий'])}{' '}
          Channex не разобрана автоматически. <Link href="/channels">Разобрать</Link>
        </Alert>
      )}
      {!!(board.unassigned ?? []).length && <UnassignedStays stays={board.unassigned ?? []} />}
      <ChessboardGrid board={board} today={today} fitMonth={isMonth} />
    </Page>
  );
}

/**
 * Строка «Без ячейки» — как «Без номера» в шахматке Exely: проживания в диапазоне доски, у которых
 * нет назначения (бронь канала, которой не хватило места — Q-107, или снятое назначение). Список
 * приходит отсортированным по категории и заезду, здесь только группируется. Гостей не показываем.
 */
function UnassignedStays({ stays }: { stays: UnassignedStay[] }) {
  const groups: Array<{ code: string; name: string; items: UnassignedStay[] }> = [];
  for (const s of stays) {
    const last = groups[groups.length - 1];
    if (last && last.code === s.categoryCode) last.items.push(s);
    else groups.push({ code: s.categoryCode, name: s.categoryName, items: [s] });
  }
  return (
    <section
      id="unassigned-stays"
      data-testid="unassigned-stays"
      data-count={stays.length}
      className={cx('board-unassigned', !stays.length && 'board-unassigned--empty')}
    >
      <div className={cx('board-unassigned-title', stays.length ? 'warn-text' : 'muted')}>
        <Icon name={stays.length ? 'incidents' : 'check'} />{' '}
        {stays.length ? `Без ячейки: ${stays.length}` : 'Все проживания с ячейкой'}
      </div>
      {groups.map((g) => (
        <div key={g.code}>
          <span className="muted-2">{g.name}</span>
          <ul className="board-unassigned-list">
            {g.items.map((s) => (
              <li
                key={`${s.confirmationNumber}-${s.arrivalDate}`}
                data-testid="unassigned-stay"
                data-number={s.confirmationNumber}
                style={{ lineHeight: '20px' }}
              >
                <Link
                  href={`/reservations/${encodeURIComponent(s.confirmationNumber)}`}
                  className="mono bold"
                >
                  {s.confirmationNumber}
                </Link>{' '}
                <span className="muted">
                  <time dateTime={s.arrivalDate}>{displayDate(s.arrivalDate)}</time> →{' '}
                  <time dateTime={s.departureDate}>{displayDate(s.departureDate)}</time> ·{' '}
                  {pluralRu(nightsBetween(s.arrivalDate, s.departureDate), [
                    'ночь',
                    'ночи',
                    'ночей',
                  ])}{' '}
                  · {STATUS_RU[s.status] ?? s.status}
                </span>{' '}
                <ResolveMenu number={s.confirmationNumber} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
