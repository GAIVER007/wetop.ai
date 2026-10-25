import { requireFeature } from '../../lib/vertical-guard';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { MAX_CHESSBOARD_DAYS } from '@pms/domain';
import { channelsApi, chessboardApi, deskApi, guardApi } from '../../lib/api';
import { countLabel, intlLocale, msg } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';
import { UnassignedStays } from './unassigned-drawer';
import { DayLine } from './day-line';
import { Page } from '../../components/page';
import { Alert, Button, Legend } from '../../components/ui';
import { Toolbar } from '../../components/toolbar';
import { DateInput } from '../../components/date-field';
import { DateRangePopover } from '../../components/date-range-popover';
import { ChessboardGrid } from './board-grid';
import { BoardMenu } from './board-menu';
import { BoardZoom } from './board-zoom';
import { displayDate } from '../../lib/display-date';
import { hotelClock, propertyCurrency, validDate } from '../../lib/hotel-api';
import { CalendarWorkspace, CalendarExpandButton } from './calendar-workspace';
import { HotelQuickReport } from './quick-report';
import { Icon } from '../../components/icon';
import { monthPeriod } from './month-period';
import { deskShell } from '../../lib/desk-shell';
import { mayAccess } from '../../lib/navigation';
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
  await requireFeature('/chessboard');
  const t = await serverT();
  const locale = await currentLocale();
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
      <Page title={t('Журнал')}>
        <form method="get" className="board-invalid-period">
          <Toolbar
            label={t('Период календаря')}
            period={
              <>
                <label className="field">
                  {t('С')}<DateInput name="from" aria-label={t('Календарь: с')} defaultValue={from} />
                </label>
                <label className="field">
                  {t('По')}
                  <DateInput
                    name="to"
                    rangeFromName="from"
                    aria-label={t('Календарь: по')}
                    defaultValue={to}
                  />
                </label>
              </>
            }
            actions={<Button>{t('Показать')}</Button>}
          />
        </form>
        <Alert boxed>
          {t('Выберите корректный период до {n} дней.', { n: MAX_CHESSBOARD_DAYS })}{' '}
          <Link href="/chessboard">{t('Сбросить фильтры')}</Link>
        </Alert>
      </Page>
    );
  // Плашки конфликтов (срез 7.3, Д3–Д4) — только чтение: сверх мест из открытых неисправностей сторожа,
  // входящие брони, которые PMS не разобрала, — из ленты событий; их отказ шахматку не роняет
  const [board, incidents, events, shell, day, todayBoard, currency] = await Promise.all([
    chessboardApi.board(from, to),
    guardApi.incidents('open').catch(() => null),
    channelsApi.events({ limit: 50, status: 'FAILED' }).catch(() => null),
    // «Только чтение» (ADR-102): предпросмотр брони не предлагает изменений (ТЗ §47)
    deskShell().catch(() => null),
    // Сводка дня над сеткой — та же «На стойке», что на Главной; её отказ календарь не роняет
    deskApi.today().catch(() => null),
    from <= today && today <= to ? null : chessboardApi.board(today, today).catch(() => null),
    propertyCurrency().catch(() => 'KZT'),
  ]);
  const overbooked = (incidents ?? []).filter((i) => i.kind === 'stay.overbooked');
  const failedEvents = events?.total ?? 0;
  const canMutate = !!shell && mayAccess(shell.access, 'desk') && !shell.readOnly;
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
  const shift = (days: number) => {
    const f = new Date(`${board.from}T00:00:00Z`);
    f.setUTCDate(f.getUTCDate() + days);
    const end = new Date(`${board.to}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + days);
    return `/chessboard?from=${f.toISOString().slice(0, 10)}&to=${end.toISOString().slice(0, 10)}`;
  };

  const current = from <= today && today <= to ? board : todayBoard;
  const todaySummary = current?.summary[today];
  const units = todaySummary
    ? todaySummary.occupied + todaySummary.free + todaySummary.blocked
    : null;
  const occupancy =
    todaySummary && units
      ? Math.round((todaySummary.occupied / units) * 100)
      : units === 0
        ? 0
        : null;
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
  const availabilityHref = `/rooms/availability?${new URLSearchParams({
    arrival: board.from,
    departure: new Date(Date.parse(`${board.to}T12:00:00Z`) + 86400000).toISOString().slice(0, 10),
    ...(query.category ? { category: query.category } : {}),
  })}`;

  const help = (
    <p className="note">
      <b>{t('Как работать с календарём.')}</b>{' '}
      {t(
        'В строке категории указано, сколько мест свободно на эту ночь. Ночь выезда номер не занимает. Клик по занятой клетке открывает бронь, клик по пустой открывает форму новой брони на эту дату. Перетащите клетку на другую строку: бронь переселится в тот номер с даты взятой клетки (в другую категорию только на всё проживание). Фильтры статусов считаются на {date}. Брони без номера на сетке не видны, они в строке над сеткой: «Разместить» показывает свободные места и назначает.',
        { date: displayDate(board.from, 'short', intlLocale(locale)) },
      )}
    </p>
  );

  const prevHref = isMonth ? monthHref(-1) : isWeek ? weekHref(-1) : shift(-board.dates.length);
  const nextHref = isMonth ? monthHref(1) : isWeek ? weekHref(1) : shift(board.dates.length);
  // UI4.2, решение владельца 13.10.2026 (Q-DES-1): один контрол периода с пресетами и календарём,
  // стрелки сдвигают тот же отрезок; «День / Неделя / Месяц» и второго выбора длины нет.
  const lead = (
    <div className="board-nav" role="group" aria-label={t('Период календаря')}>
      <div className="board-period" data-testid="board-period">
        <DateRangePopover
          from={board.from}
          to={board.to}
          today={today}
          maxDays={MAX_CHESSBOARD_DAYS}
          action="/chessboard"
          triggerTestId="board-period-button"
          compact
        />
        <Link
          href={prevHref}
          className="icon-button"
          aria-label={
            isMonth ? t('Предыдущий месяц') : isWeek ? t('Предыдущая неделя') : t('Предыдущий период')
          }
        >
          <Icon name="chevron" className="rotate-left" />
        </Link>
        <Link
          href={nextHref}
          className="icon-button"
          aria-label={
            isMonth ? t('Следующий месяц') : isWeek ? t('Следующая неделя') : t('Следующий период')
          }
        >
          <Icon name="chevron" />
        </Link>
      </div>
    </div>
  );
  const actions = (
    <>
      <CalendarExpandButton compact />
      <HotelQuickReport
        rows={(todayBoard ?? board).rows}
        date={today}
        currency={currency}
        propertyName={t('Гостиница')}
      />
      {canMutate && (
        <Link className="btn board-new" href="/reservations/new">
          <Icon name="plus" />
          <span className="board-new__label">{t('Новая бронь')}</span>
        </Link>
      )}
    </>
  );
  const kpis = day ? (
    <DayLine
      today={today}
      counts={day.counts}
      occupancy={occupancy}
      occupied={todaySummary?.occupied ?? null}
      units={units}
      free={todaySummary?.free ?? null}
      attention={attention}
      availabilityHref={availabilityHref}
      t={t}
    />
  ) : null;

  return (
    <CalendarWorkspace summary={null} nativeLayout>
      <Page
        width="full"
        title={
          <>
            <Icon name="board" className="calendar-page__icon" />
            {t('Журнал')}
          </>
        }
        subtitle={t('Размещение и бронирования по дням')}
        actions={
          <>
            {lead}
            {actions}
          </>
        }
        className="page--board calendar-page"
      >
        {overbooked.length > 0 && (
          <Alert boxed data-testid="overbooked-callout">
            {t('Продано сверх мест: {list}.', { list: overbooked.map((i) => i.title).join('; ') })}{' '}
            <a href="#unassigned-stays">{t('Разрешить')}</a>
          </Alert>
        )}
        {failedEvents > 0 && (
          <Alert boxed tone="warning" data-testid="review-callout">
            {t('Входящая бронь требует разбора: {count} из каналов не разобрана автоматически.', {
              count: countLabel(locale, t, failedEvents, [msg('ревизия'), 'ревизии', msg('ревизий')]), // kk-allow: форма склонения
            })}{' '}
            <Link href="/channels/events?status=FAILED">{t('Разобрать')}</Link>
          </Alert>
        )}
        <UnassignedStays
          stays={board.unassigned ?? []}
          critical={overbooked.length > 0}
          categories={categoriesOf(board.rows)}
          readOnly={!canMutate}
        />
        <ChessboardGrid
          board={board}
          today={today}
          fitMonth={isMonth}
          readOnly={!canMutate}
          kpis={kpis}
          help={help}
        />
        <div className="board-footer">
          {/* Нижняя строка по образцу владельца (09.10.2026): цвета плашек словами, «Показать легенду»,
            масштаб «− 100% +». Смысл не держится на цвете: у статуса свой значок на плашке. */}
          <span className="board-legend-title" aria-hidden="true">
            {t('Легенда:')}
          </span>
          <ul
            className="board-legend-inline"
            aria-label={t('Цвета плашек')}
            data-testid="board-status-legend"
          >
            {[
              ['living', statusText(hospitalityStatus, 'CHECKED_IN')],
              ['booked', statusText(hospitalityStatus, 'CONFIRMED')],
              ['tentative', statusText(hospitalityStatus, 'TENTATIVE')],
              ['left', statusText(hospitalityStatus, 'CHECKED_OUT')],
              ['repair', msg('ремонт, неисправна')],
              ['block', msg('блок')],
            ].map(([plate, label]) => (
              <li key={label}>
                <span className="board-legend-dot" data-plate={plate} aria-hidden="true" />
                {t(label!).charAt(0).toUpperCase() + t(label!).slice(1)}
              </li>
            ))}
          </ul>
          <BoardMenu
            className="board-legend-details"
            testId="board-legend-button"
            summary={
              <>
                <Icon name="help" />
                {t('Показать легенду')}
              </>
            }
          >
            <div className="board-legend-pop">
              <Legend
                data-testid="board-legend"
                items={[
                  {
                    color: 'var(--plate-booked)',
                    label: t(statusText(hospitalityStatus, 'CONFIRMED')),
                    icon: 'booking',
                  },
                  {
                    color: 'var(--plate-living)',
                    label: t(statusText(hospitalityStatus, 'CHECKED_IN')),
                    icon: 'guests',
                  },
                  {
                    color: 'var(--plate-left)',
                    label: t(statusText(hospitalityStatus, 'CHECKED_OUT')),
                    icon: 'departure',
                  },
                  {
                    color: 'var(--plate-tentative)',
                    label: t(statusText(hospitalityStatus, 'TENTATIVE')),
                    icon: 'help',
                  },
                  { color: 'var(--plate-repair)', label: t('ремонт, неисправна'), icon: 'settings' },
                  { color: 'var(--plate-block)', label: t('блокировка'), icon: 'shield' },
                  // уборка (22.09): значок стоит, пока с ячейкой надо что-то делать; проверенная без значка
                  {
                    color: 'var(--warning-bg)',
                    label: t(statusText(housekeepingStatus, 'DIRTY')),
                    icon: 'dirty',
                  },
                  {
                    color: 'var(--primary-soft)',
                    label: t('{state}, ждёт проверки', { state: t(statusText(housekeepingStatus, 'CLEAN')) }),
                    icon: 'clean',
                  },
                  { color: 'var(--success)', label: t('зелёная точка у места: проверено, доступно') },
                ]}
              />
              <p className="board-gesture-hint">
                {t('Плашка: переселить. Правый край: продлить. Пустые клетки: протянуть и создать бронь.')}
              </p>
            </div>
          </BoardMenu>
          <BoardZoom />
        </div>
      </Page>
    </CalendarWorkspace>
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
