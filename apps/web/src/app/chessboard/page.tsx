import { requireVertical } from '../../lib/vertical-guard';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import type React from 'react';
import { MAX_CHESSBOARD_DAYS } from '@pms/domain';
import { channelsApi, chessboardApi, deskApi, guardApi } from '../../lib/api';
import { pluralRu } from '../../lib/plural';
import { UnassignedStays } from './unassigned-drawer';
import { Page } from '../../components/page';
import { Alert, Button, Legend, cx } from '../../components/ui';
import { DateInput } from '../../components/date-field';
import { ChessboardGrid } from './board-grid';
import { BoardTodayLink } from './board-today-link';
import { BoardHelp } from './board-help';
import { BoardDateRange } from './board-date-range';
import { displayDate } from '../../lib/display-date';
import { hotelToday, validDate, reservationDirectory } from '../../lib/hotel-api';
import { Icon } from '../../components/icon';
import { monthPeriod } from './month-period';
import { deskShell } from '../../lib/desk-shell';
import { weekPeriod } from './week-period';
import './board.css';

/**
 * Slice 2, шаг 2.7: шахматка — 88 ячеек × даты. Страница остаётся server component; сетка вынесена
 * в клиентский компонент ради перетаскивания брони между ячейками (переселение).
 */
export default async function ChessboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireVertical(['HOSPITALITY']);
  const query = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
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
      <Page title="Календарь">
        <form method="get" className="row toolbar">
          <label className="field">
            С<DateInput name="from" aria-label="Календарь: с" defaultValue={from} />
          </label>
          <label className="field">
            По
            <DateInput
              name="to"
              rangeFromName="from"
              aria-label="Календарь: по"
              defaultValue={to}
            />
          </label>
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
  const [board, incidents, events, shell, day, todayBoard, noShows, hotBookings] =
    await Promise.all([
      chessboardApi.board(from, to),
      guardApi.incidents('open').catch(() => null),
      channelsApi.events({ limit: 50, status: 'FAILED' }).catch(() => null),
      // «Только чтение» (ADR-102): предпросмотр брони не предлагает изменений (ТЗ §47)
      deskShell().catch(() => null),
      // Полоса дня над сеткой — та же «На стойке», что на Главной; её отказ календарь не роняет
      deskApi.today().catch(() => null),
      from <= today && today <= to ? null : chessboardApi.board(today, today).catch(() => null),
      reservationDirectory({
        from: today,
        to: today,
        date: 'arrival',
        status: 'NO_SHOW',
        pageSize: '1',
      })
        .then((result) => result.total)
        .catch(() => null),
      hotBookingsToday(today).catch(() => null),
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
  const periodLabel = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatRange(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`));
  const shortPeriodLabel = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).formatRange(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`));
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
      title="Календарь"
      actions={
        <>
          <Link
            className="btn btn--secondary"
            href={`/rooms/availability?${new URLSearchParams({
              arrival: board.from,
              departure: new Date(Date.parse(`${board.to}T12:00:00Z`) + 86400000)
                .toISOString()
                .slice(0, 10),
              ...(query.category ? { category: query.category } : {}),
            })}`}
          >
            Поиск свободных номеров
          </Link>
          {/* существующий фильтр «С долгом» (PR 7) — ссылкой, сетка читает stays= из адреса */}
          <Link className="btn btn--secondary" href="/chessboard?stays=debt">
            Неоплаченные
          </Link>
          <Link className="btn" href="/reservations/new">
            <Icon name="plus" />
            Новая бронь
          </Link>
        </>
      }
    >
      <div className="board-top">
        {/* Полоса дня на всю ширину, под ней строка управления (замечание владельца 06.10:
            два столбика рядом с управлением читались плохо) */}
        {day && (
          <DayPanel
            day={day}
            board={from <= today && today <= to ? board : todayBoard}
            today={today}
            noShows={noShows}
            hotBookings={hotBookings}
          />
        )}
        <div className="board-controls">
          <div className="board-period">
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
              <span className="board-period-label" title={periodLabel}>
                <span className="board-period-full">{periodLabel}</span>
                <span className="board-period-short">{shortPeriodLabel}</span>
              </span>
              <Link
                href={isMonth ? monthHref(1) : isWeek ? weekHref(1) : shift(board.dates.length)}
                className="icon-button"
                aria-label={
                  isMonth ? 'Следующий месяц' : isWeek ? 'Следующая неделя' : 'Следующий период'
                }
              >
                <Icon name="chevron" />
              </Link>
              <BoardTodayLink />
            </span>{' '}
            {/* Сегмент — rolling 7/14/30 (ТЗ «Шахматка v2» §6–7); календарный месяц живёт в «Датах».
              «30 дней» не подсвечивается на месяце из 30 дней: это разные периоды. */}
            <span className="seg" role="group" aria-label="Вид календаря">
              <Link
                href={weekHref()}
                className={cx(isWeek && 'is-on')}
                aria-current={isWeek ? 'true' : undefined}
              >
                7 дней
              </Link>
              <Link
                href={window(14)}
                className={cx(board.dates.length === 14 && 'is-on')}
                aria-current={board.dates.length === 14 ? 'true' : undefined}
              >
                14 дней
              </Link>
              <Link
                href={window(30)}
                className={cx(board.dates.length === 30 && !isMonth && 'is-on')}
                aria-current={board.dates.length === 30 && !isMonth ? 'true' : undefined}
              >
                30 дней
              </Link>
            </span>
          </div>
          <div className="board-bar">
            <BoardDateRange
              key={`${board.from}-${board.to}`}
              from={board.from}
              to={board.to}
              monthHref={monthHref()}
              monthCurrent={isMonth}
            />
            <BoardHelp title="Помощь">
              <div className="board-help-content">
                <p className="note">
                  <b>Как работать с календарём.</b> В строке категории указано, сколько мест
                  свободно на эту ночь. Ночь выезда ячейку не занимает. Клик по занятой клетке
                  открывает бронь, по пустой — форму новой брони на эту дату. Перетащите клетку на
                  другую строку — бронь переселится в ту ячейку с даты взятой клетки (в другую
                  категорию — только на всё проживание). Фильтры статусов считаются на{' '}
                  {displayDate(board.from)}. Брони без ячейки на сетке не видны — они в строке над
                  сеткой: «Разместить» показывает свободные места и назначает.
                </p>
              </div>
            </BoardHelp>
          </div>
        </div>
      </div>
      {overbooked.length > 0 && (
        <Alert boxed data-testid="overbooked-callout">
          Продано сверх мест: {overbooked.map((i) => i.title).join('; ')}.{' '}
          <a href="#unassigned-stays">Разрешить</a>
        </Alert>
      )}
      {failedEvents > 0 && (
        <Alert boxed tone="warning" data-testid="review-callout">
          Входящая бронь требует разбора:{' '}
          {pluralRu(failedEvents, ['ревизия', 'ревизии', 'ревизий'])} из каналов не разобрана
          автоматически. <Link href="/channels/events?status=FAILED">Разобрать</Link>
        </Alert>
      )}
      <UnassignedStays
        stays={board.unassigned ?? []}
        critical={overbooked.length > 0}
        categories={categoriesOf(board.rows)}
        readOnly={shell?.readOnly ?? false}
      />
      <ChessboardGrid
        board={board}
        today={today}
        fitMonth={isMonth}
        readOnly={shell?.readOnly ?? false}
      />
      <div className="board-footer">
        <details className="board-legend-details">
          <summary>Обозначения</summary>
          <Legend
            data-testid="board-legend"
            items={[
              { color: 'var(--st-confirmed)', label: 'подтверждена', glyph: '•' },
              { color: 'var(--st-checked-in)', label: 'заселён', glyph: '✓' },
              { color: 'var(--st-checked-out)', label: 'выселен', glyph: '✕' },
              { color: 'var(--st-tentative)', label: 'не подтверждена', glyph: '?' },
              { color: 'var(--st-blocked)', label: 'блокировка', glyph: '▨' },
              // уборка (22.09): значок стоит, пока с ячейкой надо что-то делать; проверенная — без значка
              { color: 'var(--warning-bg)', label: 'требует уборки', icon: 'dirty' },
              { color: 'var(--primary-soft)', label: 'убрано, ждёт проверки', icon: 'clean' },
              { label: 'без значка — проверена, доступна' },
            ]}
          />
        </details>
        <span className="board-gesture-hint">
          Плашка — переселить, правый край — продлить, пустые клетки — протянуть и создать бронь
        </span>
      </div>
    </Page>
  );
}

/** Категории в порядке строк сетки — ящик «Брони без размещения» показывает чужие места в том же порядке */
function categoriesOf(
  rows: Array<{ unit: { accommodationTypeCode: string; accommodationTypeName: string } }>,
) {
  const seen = new Map<string, string>();
  for (const r of rows)
    if (!seen.has(r.unit.accommodationTypeCode))
      seen.set(r.unit.accommodationTypeCode, r.unit.accommodationTypeName);
  return [...seen].map(([code, name]) => ({ code, name }));
}

/** Read-only projection: bookings created on the property day with arrival on that day. */
async function hotBookingsToday(today: string) {
  let count = 0;
  for (let page = 1; ; page++) {
    const result = await reservationDirectory({
      from: today,
      to: today,
      date: 'created',
      page: String(page),
      pageSize: '200',
    });
    count += result.rows.filter(
      (r) => r.arrivalDate === today && ['TENTATIVE', 'CONFIRMED', 'CHECKED_IN'].includes(r.status),
    ).length;
    if (page * result.pageSize >= result.total) return count;
  }
}

function DayPanel({
  day,
  board,
  today,
  noShows,
  hotBookings,
}: {
  day: import('../../lib/api').DeskDay;
  board: import('../../lib/api').Chessboard | null;
  today: string;
  noShows: number | null;
  hotBookings: number | null;
}) {
  const s = board?.summary[today];
  const units = s ? s.occupied + s.free + s.blocked : null;
  const occupancy = s && units ? Math.round((s.occupied / units) * 100) : units === 0 ? 0 : null;
  const rows = board?.rows ?? [];
  const count = (kind: 'ROOM' | 'BED', freeOnly: boolean) =>
    rows.filter(
      (r) =>
        r.unit.kind === kind &&
        (!freeOnly || r.cells.some((c) => c.date === today && c.state === 'FREE')),
    ).length;
  const rooms = count('ROOM', false);
  const beds = count('BED', false);
  const freeRooms = board ? count('ROOM', true) : null;
  const freeBeds = board ? count('BED', true) : null;
  // Фонд из одних коек (хостел без отдельных номеров): главное число — свободные койки
  const onlyBeds = rooms === 0;
  const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const dayHref = (date: string, status?: string) =>
    `/reservations?from=${today}&to=${today}&date=${date}${status ? `&status=${status}` : ''}`;
  const n = (value: number | null | undefined) => (value == null ? 'н/д' : String(value));
  const c = day.counts;
  const availability = `/rooms/availability?arrival=${today}&departure=${tomorrow}`;
  return (
    <div className="board-day-panel" role="group" aria-label="Сегодня на объекте">
      <div className="board-stat board-stat--occupancy">
        <span className="board-stat__label">Загрузка</span>
        <span className="board-stat__value">
          <b data-testid="day-occupancy">{occupancy === null ? 'н/д' : `${occupancy}%`}</b>
          <small>
            <span data-testid="day-occupied">{n(s?.occupied)}</span> из{' '}
            <span data-testid="day-units">{n(units)}</span>
            {s && s.blocked > 0 && <>, блок {s.blocked}</>}
          </small>
        </span>
        {occupancy !== null && (
          <span
            className="board-stat__meter"
            role="meter"
            aria-label="Загрузка на сегодня"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={occupancy}
            aria-valuetext={`${occupancy}%`}
          >
            <span style={{ width: `${occupancy}%` }} />
          </span>
        )}
      </div>
      <Tile
        id="arrivals"
        label="Заезды"
        value={n(c.arrivals)}
        href={dayHref('arrival')}
        note={
          <>
            {c.toCheckIn > 0 && <>ждут {c.toCheckIn}, </>}
            <span title="Созданы сегодня с заездом сегодня">
              новых <span data-testid="day-hot">{n(hotBookings)}</span>
            </span>
          </>
        }
      />
      <Tile
        id="departures"
        label="Выезды"
        value={n(c.departures)}
        href={dayHref('departure')}
        note={c.toCheckOut > 0 ? `ждут ${c.toCheckOut}` : undefined}
      />
      <Tile id="inhouse" label="Проживают" value={n(c.inHouse)} href="/reservations?view=inhouse" />
      <Tile
        id="noshow"
        label="Незаезды"
        value={n(noShows)}
        href={dayHref('arrival', 'NO_SHOW')}
        note={c.overdueArrivals > 0 ? `не заехали ${c.overdueArrivals}` : undefined}
      />
      {/* Отдельно номера и отдельно койки: одно число «16» без слова «из каких 88» читалось
          как ошибка (замечание владельца 06.10); фонд из одних коек — одна плитка */}
      <Tile
        id="free"
        label={onlyBeds ? 'Свободно коек' : 'Свободно номеров'}
        value={n(onlyBeds ? freeBeds : freeRooms)}
        href={availability}
        note={`из ${onlyBeds ? beds : rooms}`}
      />
      {!onlyBeds && beds > 0 && (
        <Tile
          id="free-beds"
          label="Свободно коек"
          value={n(freeBeds)}
          href={availability}
          note={`из ${beds}`}
        />
      )}
    </div>
  );
}

/** Показатель дня: подпись, число и короткая оговорка одной строкой; весь блок — ссылка в список */
function Tile({
  id,
  label,
  value,
  href,
  note,
}: {
  id: string;
  label: string;
  value: string;
  href: string;
  note?: React.ReactNode | undefined;
}) {
  return (
    <Link className={`board-stat board-stat--${id}`} href={href}>
      <span className="board-stat__label">{label}</span>
      <span className="board-stat__value">
        <b data-testid={`day-${id}`}>{value}</b>
        {note && <small>{note}</small>}
      </span>
    </Link>
  );
}
