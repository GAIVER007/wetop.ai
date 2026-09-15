import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { MAX_CHESSBOARD_DAYS } from '@pms/domain';
import {
  channelsApi,
  chessboardApi,
  getJsonPublic,
  guardApi,
  type Incident,
  type InboundEvent,
  type UnassignedStay,
} from '../../lib/api';
import { ResolveMenu } from './resolve-menu';
import { Page } from '../../components/page';
import { Alert, Button, Input, cx } from '../../components/ui';
import { AmountBadge } from '../../components/amount-badge';
import { ChessboardGrid } from './board-grid';
import { STAY_STATUS, sourceBadge } from './stay-status';
import { displayDay, displayPeriod } from '../../lib/display-date';
import { validDate } from '../../lib/hotel-api';
import './board.css';
import { Icon } from '../../components/icon';
import { monthPeriod } from './month-period';
import { weekPeriod } from './week-period';

/** Очередь Channex: плашка над сеткой, когда отправки падают — каналы продают по старому остатку */
interface Freshness {
  channex: { outboxPending: number; outboxFailed: number };
}
async function channexQueue(): Promise<Freshness['channex'] | null> {
  try {
    return (await getJsonPublic<Freshness>('/system/freshness')).channex;
  } catch {
    return null; // сторож и /channels покажут сами; шахматка без плашки, но не без сетки
  }
}

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
  const [board, queue, incidents, failedEvents] = await Promise.all([
    chessboardApi.board(from, to),
    channexQueue(),
    // Д3: ночь категории сверх мест — открытая неисправность сторожа; только чтение
    guardApi.incidents('open').catch((): Incident[] | null => null),
    // Д4: ревизия канала, которую не удалось сопоставить, — плашка «требует разбора»
    channelsApi
      .events({ status: 'FAILED', limit: 1 })
      .then((r) => r.rows)
      .catch((): InboundEvent[] | null => null),
  ]);
  const overbooked = (incidents ?? []).filter((i) => i.kind === 'stay.overbooked');
  const needsReview = failedEvents?.[0] ?? null;
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
      subtitle={`${isMonth ? monthLabel : displayPeriod(board.from, board.to)}, номера и койки, ${board.rows.length} мест`}
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
        <BoardLegend />
        {!(board.unassigned ?? []).length && <UnassignedStays stays={[]} />}
        <details className="board-help">
          <summary>Как работать с шахматкой</summary>
          <p className="note">
            В строке категории и под датой в шапке — сколько мест свободно на эту ночь из{' '}
            {board.rows.length}. Полоса брони начинается с середины клетки заезда и кончается на
            середине клетки выезда: ночь выезда ячейку не занимает. Клик по полосе открывает бронь,
            по пустой клетке — форму новой брони на эту дату. Меню на полосе: переселить в свободную
            ячейку той же категории, продлить на ночь, отменить; перетаскивание клетки на другую
            строку тоже переселяет — с даты взятой клетки (в другую категорию — только на всё
            проживание). Фильтры статусов считаются на {displayDay(board.from)}. Брони без ячейки —
            строкой над сеткой; ячейка назначается с карточки брони.
          </p>
        </details>
      </div>
      {queue && queue.outboxFailed > 0 && (
        <Alert boxed role="alert" data-testid="channex-warning" className="board-channex-alert">
          <Icon name="incidents" width={16} height={16} />
          <span>
            <b>Каналы могут не знать об остатках:</b> ошибок отправки {queue.outboxFailed}, в
            очереди {queue.outboxPending}. Пока очередь не разошлась, каналы продают по старому
            остатку.
          </span>
          <Link href="/channels" className="btn btn--secondary">
            Открыть каналы
          </Link>
        </Alert>
      )}
      {overbooked.map((i) => (
        <div key={i.id} className="callout callout--warn" data-testid="overbooked-callout">
          <Icon name="incidents" width={16} height={16} />
          <span>
            <b>Продано сверх мест.</b> {i.title} Место второй раз не продаётся: остаток категории
            уже учитывает проживание без ячейки.
          </span>
          <a href="#unassigned-stays" className="btn btn--secondary btn--sm">
            Разрешить
          </a>
        </div>
      ))}
      {needsReview && (
        <div className="callout callout--warn" data-testid="review-callout">
          <Icon name="incidents" width={16} height={16} />
          <span>
            <b>Входящая бронь требует разбора.</b>{' '}
            {needsReview.lastError ?? 'Ревизия канала не обработана.'}
          </span>
          <Link href="/channels?status=FAILED" className="btn btn--secondary btn--sm">
            Разобрать
          </Link>
        </div>
      )}
      {!!(board.unassigned ?? []).length && <UnassignedStays stays={board.unassigned ?? []} />}
      <ChessboardGrid board={board} today={today} fitMonth={isMonth} />
    </Page>
  );
}

/** Легенда статусов: значок, слово и цвет — смысл не только цветом (DESIGN.md §1 п. 4, §9) */
function BoardLegend() {
  return (
    <div className="legend board-legend" aria-label="Статусы на шахматке">
      {Object.entries(STAY_STATUS).map(([status, { word, icon, token }]) => (
        <span key={status} className="board-legend__item" data-status={status}>
          <span className="legend__swatch" style={{ background: `var(--st-${token})` }} />
          <Icon name={icon} width={16} height={16} />
          {word}
        </span>
      ))}
      <span className="board-legend__item" data-status="BLOCKED">
        <span className="legend__swatch" style={{ background: 'var(--st-blocked)' }} />
        <Icon name="incidents" width={16} height={16} />
        блокировка
      </span>
    </div>
  );
}

/**
 * Строка «Без ячейки» — как «Без номера» в шахматке Exely: проживания в диапазоне доски, у которых
 * нет назначения (бронь канала, которой не хватило места — Q-107, или снятое назначение). По макету
 * (срез 7.1): одной строкой над сеткой — заказчик, категория, номер брони, период, статус, остаток,
 * кнопка «Назначить» ведёт на карточку брони, где ячейка и назначается.
 */
function UnassignedStays({ stays }: { stays: UnassignedStay[] }) {
  return (
    <section
      id="unassigned-stays"
      data-testid="unassigned-stays"
      data-count={stays.length}
      className={cx(
        'board-unassigned',
        stays.length > 0 ? 'board-unassigned--warn' : 'board-unassigned--empty',
      )}
    >
      <div className={cx('board-unassigned__title', stays.length ? 'warn-text' : 'muted')}>
        <Icon name={stays.length ? 'incidents' : 'check'} width={16} height={16} />{' '}
        {stays.length ? `Без ячейки: ${stays.length}` : 'Все проживания с ячейкой'}
      </div>
      {stays.map((s) => {
        const status = STAY_STATUS[s.status];
        const source = sourceBadge(s);
        const due = s.balanceMinor && /^[1-9]\d*$/.test(s.balanceMinor) ? s.balanceMinor : null;
        return (
          <div
            key={`${s.confirmationNumber}-${s.arrivalDate}`}
            data-testid="unassigned-stay"
            data-number={s.confirmationNumber}
            className="board-unassigned__item"
          >
            <b className="board-unassigned__guest">{s.guestLabel || '—'}</b>
            <span className="muted-2">{s.categoryName}</span>
            <Link
              href={`/reservations/${encodeURIComponent(s.confirmationNumber)}`}
              className="bold"
            >
              {s.confirmationNumber}
            </Link>
            <span>{displayPeriod(s.arrivalDate, s.departureDate)}</span>
            <span className="muted">
              {status ? (
                <>
                  <Icon name={status.icon} width={16} height={16} /> {status.word}
                </>
              ) : (
                s.status
              )}
            </span>
            {source && <span className="badge">{source}</span>}
            {due && <AmountBadge amountMinor={due} kind="due" />}
            <ResolveMenu number={s.confirmationNumber} />
          </div>
        );
      })}
    </section>
  );
}
