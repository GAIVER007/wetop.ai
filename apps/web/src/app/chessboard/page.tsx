import { requireVertical } from '../../lib/vertical-guard';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { MAX_CHESSBOARD_DAYS } from '@pms/domain';
import { channelsApi, chessboardApi, deskApi, guardApi } from '../../lib/api';
import { pluralRu } from '../../lib/plural';
import { UnassignedStays } from './unassigned-drawer';
import { Page } from '../../components/page';
import { Alert, Button, Legend, cx } from '../../components/ui';
import { Toolbar } from '../../components/toolbar';
import { DateInput } from '../../components/date-field';
import { PeriodPicker } from '../../components/period-picker';
import { ChessboardGrid } from './board-grid';
import { BoardTodayLink } from './board-today-link';
import { BoardMenu } from './board-menu';
import { BoardZoom } from './board-zoom';
import { displayDate } from '../../lib/display-date';
import { hotelClock, validDate } from '../../lib/hotel-api';
import { Icon } from '../../components/icon';
import { monthPeriod } from './month-period';
import { deskShell } from '../../lib/desk-shell';
import { weekPeriod } from './week-period';
import './board.css';
import { hospitalityStatus } from '../../lib/status/hospitality';
import { housekeepingStatus } from '../../lib/status/housekeeping';
import { statusText } from '../../lib/status/types';

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
  const clock = await hotelClock();
  const today = clock.today();
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
        <form method="get" className="board-invalid-period">
          <Toolbar
            label="Период календаря"
            period={
              <>
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
              </>
            }
            actions={<Button>Показать</Button>}
          />
        </form>
        <Alert boxed>
          Выберите корректный период до {MAX_CHESSBOARD_DAYS} дней.{' '}
          <Link href="/chessboard">Сбросить фильтры</Link>
        </Alert>
      </Page>
    );
  // Плашки конфликтов (срез 7.3, Д3–Д4) — только чтение: сверх мест из открытых неисправностей сторожа,
  // входящие брони, которые PMS не разобрала, — из ленты событий; их отказ шахматку не роняет
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const [board, incidents, events, shell, day, todayBoard, yesterdayBoard] = await Promise.all([
    chessboardApi.board(from, to),
    guardApi.incidents('open').catch(() => null),
    channelsApi.events({ limit: 50, status: 'FAILED' }).catch(() => null),
    // «Только чтение» (ADR-102): предпросмотр брони не предлагает изменений (ТЗ §47)
    deskShell().catch(() => null),
    // Сводка дня над сеткой — та же «На стойке», что на Главной; её отказ календарь не роняет
    deskApi.today().catch(() => null),
    from <= today && today <= to ? null : chessboardApi.board(today, today).catch(() => null),
    // тренд загрузки «к вчерашнему дню» (образец владельца 09.10.2026): тот же расчёт за вчера
    chessboardApi.board(yesterday, yesterday).catch(() => null),
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

  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const monthTitle = (() => {
    const parts = new Intl.DateTimeFormat('ru-RU', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).formatToParts(new Date(`${from}T00:00:00Z`));
    const m = parts.find((x) => x.type === 'month')?.value ?? '';
    const y = parts.find((x) => x.type === 'year')?.value ?? '';
    return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${y}`;
  })();
  /** Подпись кнопки периода: «Октябрь 2026» в пределах месяца, иначе короткий отрезок («28 сент. – 4 окт.») */
  const rangeTitle = sameMonth ? monthTitle : shortPeriodLabel;
  const lengthLabel = pluralRu(board.dates.length, ['день', 'дня', 'дней']);
  const isDay = board.dates.length === 1;
  const dayDate = from <= today && today <= to ? today : from;
  const dayHref = `/chessboard?from=${dayDate}&to=${dayDate}`;
  const current = from <= today && today <= to ? board : todayBoard;
  const todaySummary = current?.summary[today];
  const units = todaySummary
    ? todaySummary.occupied + todaySummary.free + todaySummary.blocked
    : null;
  const occupancy =
    todaySummary && units ? Math.round((todaySummary.occupied / units) * 100) : units === 0 ? 0 : null;
  const dirtyUnits = board.rows.filter((r) => r.unit.housekeepingStatus === 'DIRTY').length;
  const debtStays = new Set(
    board.rows.flatMap((r) =>
      r.cells.flatMap((c) =>
        c.confirmationNumber && c.balanceMinor && /^[1-9]\d*$/.test(c.balanceMinor)
          ? [c.confirmationNumber]
          : [],
      ),
    ),
  ).size;
  // «Требует внимания» по образцу владельца: долги и открытые задачи (брони без места вынесены в
  // отдельную строку над сеткой и в окошко «Фильтры»)
  const attention = debtStays + (day?.counts.tasksOpen ?? 0);
  const yesterdaySummary = yesterdayBoard?.summary[yesterday];
  const yesterdayUnits = yesterdaySummary
    ? yesterdaySummary.occupied + yesterdaySummary.free + yesterdaySummary.blocked
    : 0;
  const trend =
    occupancy !== null && yesterdaySummary && yesterdayUnits
      ? occupancy - Math.round((yesterdaySummary.occupied / yesterdayUnits) * 100)
      : null;
  const availabilityHref = `/rooms/availability?${new URLSearchParams({
    arrival: board.from,
    departure: new Date(Date.parse(`${board.to}T12:00:00Z`) + 86400000).toISOString().slice(0, 10),
    ...(query.category ? { category: query.category } : {}),
  })}`;

  const help = (
    <p className="note">
      <b>Как работать с календарём.</b> В строке категории указано, сколько мест свободно на эту
      ночь. Ночь выезда ячейку не занимает. Клик по занятой клетке открывает бронь, клик по пустой
      открывает форму новой брони на эту дату. Перетащите клетку на другую строку: бронь переселится
      в ту ячейку с даты взятой клетки (в другую категорию только на всё проживание). Фильтры
      статусов считаются на {displayDate(board.from)}. Брони без ячейки на сетке не видны, они в
      строке над сеткой: «Разместить» показывает свободные места и назначает.
    </p>
  );

  const lead = (
    <div className="board-nav" role="group" aria-label="Период календаря">
      <BoardTodayLink />
      <span className="board-nav-arrows">
        <Link
          href={isMonth ? monthHref(-1) : isWeek ? weekHref(-1) : shift(-board.dates.length)}
          className="icon-button"
          aria-label={
            isMonth ? 'Предыдущий месяц' : isWeek ? 'Предыдущая неделя' : 'Предыдущий период'
          }
        >
          <Icon name="chevron" className="rotate-left" />
        </Link>
        <Link
          href={isMonth ? monthHref(1) : isWeek ? weekHref(1) : shift(board.dates.length)}
          className="icon-button"
          aria-label={isMonth ? 'Следующий месяц' : isWeek ? 'Следующая неделя' : 'Следующий период'}
        >
          <Icon name="chevron" />
        </Link>
      </span>
      {/* Образец владельца 09.10.2026: «Октябрь 2026 ▾» раскрывает выбор дат («С» / «По»); ключ по
          периоду: после перехода раскрывашка закрыта, поля несут новые даты. */}
      <BoardMenu
        resetKey={`${board.from}-${board.to}`}
        className="board-period-menu"
        testId="board-period-button"
        title={periodLabel}
        summary={
          <>
            <Icon name="board" className="board-period-icon" />
            <span className="board-period-label">{rangeTitle}</span>
            <Icon name="chevron" className="board-period-caret" />
          </>
        }
      >
        <div className="board-period-pop">
          <form method="get" className="board-period-form">
            <PeriodPicker from={board.from} to={board.to} fromName="from" toName="to" />
            <Button tone="secondary" type="submit">
              Применить
            </Button>
          </form>
        </div>
      </BoardMenu>
      <nav className="seg board-scale" aria-label="Масштаб календаря">
        <Link
          href={dayHref}
          className={cx(isDay && 'is-on')}
          aria-current={isDay ? 'page' : undefined}
        >
          День
        </Link>
        <Link
          href={weekHref()}
          className={cx(isWeek && 'is-on')}
          aria-current={isWeek ? 'page' : undefined}
        >
          Неделя
        </Link>
        <Link
          href={monthHref()}
          className={cx(isMonth && 'is-on')}
          aria-current={isMonth ? 'page' : undefined}
        >
          Месяц
        </Link>
      </nav>
      {/* Длина окна: 7 дней, календарная неделя, 14 и 30, от сегодня (ТЗ «Шахматка v2» §6–7).
          «30 дней» не подсвечивается на месяце из 30 дней: это разные периоды. */}
      <BoardMenu
        resetKey={`${board.from}-${board.to}`}
        className="board-length-menu"
        testId="board-length-button"
        summary={
          <>
            <span>{lengthLabel}</span>
            <Icon name="chevron" className="board-period-caret" />
          </>
        }
      >
        <nav className="board-length-pop" aria-label="Длина периода">
          <Link
            href={weekHref()}
            className={cx(isWeek && 'is-on')}
            aria-current={isWeek ? 'page' : undefined}
          >
            7 дней
          </Link>
          <Link
            href={window(14)}
            className={cx(board.dates.length === 14 && 'is-on')}
            aria-current={board.dates.length === 14 ? 'page' : undefined}
          >
            14 дней
          </Link>
          <Link
            href={window(30)}
            className={cx(board.dates.length === 30 && !isMonth && 'is-on')}
            aria-current={board.dates.length === 30 && !isMonth ? 'page' : undefined}
          >
            30 дней
          </Link>
        </nav>
      </BoardMenu>
    </div>
  );
  const actions = (
    <Link className="btn board-new" href="/reservations/new">
      <Icon name="plus" />
      <span className="board-new__label">Новая бронь</span>
    </Link>
  );
  const kpis = day ? (
    <DayStats
      day={day}
      today={today}
      occupancy={occupancy}
      trend={trend}
      occupied={todaySummary?.occupied ?? null}
      units={units}
      free={todaySummary?.free ?? null}
      dirty={dirtyUnits}
      attention={attention}
      availabilityHref={availabilityHref}
    />
  ) : null;

  return (
    <Page width="full" title="Календарь" className="page--board">
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
        lead={lead}
        actions={actions}
        kpis={kpis}
        help={help}
      />
      <div className="board-footer">
        {/* Нижняя строка по образцу владельца (09.10.2026): цвета плашек словами, «Показать легенду»,
            масштаб «− 100% +». Смысл не держится на цвете: у статуса свой значок на плашке. */}
        <ul className="board-legend-inline" aria-label="Цвета плашек">
          {[
            ['living', statusText(hospitalityStatus, 'CHECKED_IN')],
            ['booked', statusText(hospitalityStatus, 'CONFIRMED')],
            ['tentative', statusText(hospitalityStatus, 'TENTATIVE')],
            ['left', statusText(hospitalityStatus, 'CHECKED_OUT')],
            ['repair', 'ремонт, неисправна'],
            ['block', 'блок'],
          ].map(([plate, label]) => (
            <li key={label}>
              <span className="board-legend-dot" data-plate={plate} aria-hidden="true" />
              {label!.charAt(0).toUpperCase() + label!.slice(1)}
            </li>
          ))}
        </ul>
        <BoardMenu
          className="board-legend-details"
          testId="board-legend-button"
          summary={
            <>
              <Icon name="help" />
              Показать легенду
            </>
          }
        >
          <div className="board-legend-pop">
            <Legend
              data-testid="board-legend"
              items={[
                {
                  color: 'var(--plate-booked)',
                  label: statusText(hospitalityStatus, 'CONFIRMED'),
                  icon: 'booking',
                },
                {
                  color: 'var(--plate-living)',
                  label: statusText(hospitalityStatus, 'CHECKED_IN'),
                  icon: 'guests',
                },
                {
                  color: 'var(--plate-left)',
                  label: statusText(hospitalityStatus, 'CHECKED_OUT'),
                  icon: 'departure',
                },
                {
                  color: 'var(--plate-tentative)',
                  label: statusText(hospitalityStatus, 'TENTATIVE'),
                  icon: 'help',
                },
                { color: 'var(--plate-repair)', label: 'ремонт, неисправна', icon: 'settings' },
                { color: 'var(--plate-block)', label: 'блокировка', icon: 'shield' },
                // уборка (22.09): значок стоит, пока с ячейкой надо что-то делать; проверенная без значка
                {
                  color: 'var(--warning-bg)',
                  label: statusText(housekeepingStatus, 'DIRTY'),
                  icon: 'dirty',
                },
                {
                  color: 'var(--primary-soft)',
                  label: `${statusText(housekeepingStatus, 'CLEAN')}, ждёт проверки`,
                  icon: 'clean',
                },
                { color: 'var(--success)', label: 'зелёная точка у места: проверено, доступно' },
              ]}
            />
            <p className="board-gesture-hint">
              Плашка: переселить. Правый край: продлить. Пустые клетки: протянуть и создать бронь.
            </p>
          </div>
        </BoardMenu>
        <BoardZoom />
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

function DayStats({
  day,
  today,
  occupancy,
  trend,
  occupied,
  units,
  free,
  dirty,
  attention,
  availabilityHref,
}: {
  day: import('../../lib/api').DeskDay;
  today: string;
  occupancy: number | null;
  /** разница загрузки с вчерашним днём, процентных пунктов; без данных за вчера нет */
  trend: number | null;
  occupied: number | null;
  units: number | null;
  free: number | null;
  dirty: number;
  attention: number;
  availabilityHref: string;
}) {
  const dayHref = (date: string) => `/reservations?from=${today}&to=${today}&date=${date}`;
  const n = (value: number | null | undefined) => (value == null ? 'н/д' : String(value));
  const c = day.counts;
  return (
    <section className="board-kpis" role="group" aria-label="Сегодня на объекте">
      <div className="board-kpi board-kpi--occupancy">
        <span className="board-kpi__icon" aria-hidden="true">
          <Icon name="bed" />
        </span>
        <div className="board-kpi__body">
          <span className="board-kpi__row">
            <b className="board-kpi__value" data-testid="day-occupancy">
              {occupancy === null ? 'н/д' : `${occupancy}%`}
            </b>
            {trend !== null && trend !== 0 && (
              <span
                className="board-kpi__trend"
                data-direction={trend > 0 ? 'up' : 'down'}
                data-testid="day-trend"
                title="К вчерашнему дню, процентных пунктов"
              >
                <Icon name="arrow" className={trend > 0 ? 'rotate-up' : 'rotate-down'} />
                {trend > 0 ? `+${trend}%` : `${trend}%`}
              </span>
            )}
          </span>
          <span className="board-kpi__label">
            <span className="sr-only">Загрузка: </span>
            <span data-testid="day-occupied">{n(occupied)}</span>
            {units !== null && <> из {units}</>} мест занято
          </span>
        </div>
      </div>
      <div className="board-kpi board-kpi--arrivals">
        <span className="board-kpi__icon" aria-hidden="true">
          <Icon name="arrival" />
        </span>
        <div className="board-kpi__body">
          <span className="board-kpi__row">
            <b className="board-kpi__value" data-testid="day-arrivals">
              {c.arrivals}
            </b>
            <span className="board-kpi__label">Заезды сегодня</span>
          </span>
          <Link className="board-kpi__more" href={dayHref('arrival')}>
            Подробнее <Icon name="arrow" />
          </Link>
        </div>
      </div>
      <div className="board-kpi board-kpi--departures">
        <span className="board-kpi__icon" aria-hidden="true">
          <Icon name="departure" />
        </span>
        <div className="board-kpi__body">
          <span className="board-kpi__row">
            <b className="board-kpi__value" data-testid="day-departures">
              {c.departures}
            </b>
            <span className="board-kpi__label">Выезды сегодня</span>
          </span>
          <Link className="board-kpi__more" href={dayHref('departure')}>
            Подробнее <Icon name="arrow" />
          </Link>
        </div>
      </div>
      <Link
        className="board-kpi board-kpi--free"
        href={availabilityHref}
        aria-label="Поиск свободных номеров"
      >
        <span className="board-kpi__icon" aria-hidden="true">
          <Icon name="inventory" />
        </span>
        <span className="board-kpi__row">
          <b className="board-kpi__value" data-testid="day-free">
            {n(free)}
          </b>
          <span className="board-kpi__label">
            Свободно
            <br />
            номеров
          </span>
        </span>
      </Link>
      <div className="board-kpi board-kpi--dirty">
        <span className="board-kpi__icon" aria-hidden="true">
          <Icon name="dirty" />
        </span>
        <span className="board-kpi__row">
          <b className="board-kpi__value" data-testid="day-dirty">
            {dirty}
          </b>
          <span className="board-kpi__label">
            Уборка
            <br />
            мест
          </span>
        </span>
      </div>
      <Link className="board-kpi board-kpi--attention" href="/chessboard?stays=debt" aria-label="Неоплаченные">
        <span className="board-kpi__icon" aria-hidden="true">
          <Icon name="incidents" />
        </span>
        <span className="board-kpi__row">
          <b className="board-kpi__value" data-testid="day-attention">
            {attention}
          </b>
          <span className="board-kpi__label">
            Требует внимания
            <br />
            <span className="board-kpi__note">долги и задачи</span>
          </span>
        </span>
      </Link>
    </section>
  );
}
