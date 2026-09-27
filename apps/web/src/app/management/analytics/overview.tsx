import Link from 'next/link';
import type { DashboardPeriod } from '@pms/domain';
import { ApiError, dashboardApi } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { LoadError } from '../../../components/load-error';
import { EmptyState, Panel, Skeleton, Table, cx } from '../../../components/ui';
import { DayBars } from '../../../components/day-bars';
import {
  deltaPercent,
  deltaPoints,
  formatInt,
  formatPercent,
  sourceLabel,
  wholeTenge,
  type Delta,
} from '../../../lib/dashboard-format';
import { displayDate } from '../../../lib/display-date';
import { pluralRu } from '../../../lib/plural';
import { analyticsHref, type AnalyticsQuery } from './params';

const NO_BASE: Delta = { direction: null, text: 'нет данных для сравнения' };
const b = (v: string) => BigInt(v);

/**
 * Сравнение честное (ТЗ §16–17, §27): база — прошлое количество. Ноль в прошлом отрезке — «нет данных для
 * сравнения», а не «+100 %» и не красные «−100 %». Доли сравниваются в процентных пунктах.
 */
function pointsDelta(current: number, previous: number, base: number): Delta {
  return base > 0 ? deltaPoints(current, previous) : NO_BASE;
}
function moneyDelta(current: string | null, previous: string | null): Delta {
  return current !== null && previous !== null ? deltaPercent(b(current), b(previous)) : NO_BASE;
}

function DeltaMark({ delta, inverse }: { delta: Delta; inverse?: boolean }) {
  if (!delta.direction)
    return (
      <span className="kpi-delta kpi-delta--none">
        —<span className="sr-only"> {delta.text}</span>
      </span>
    );
  // у отмен рост — плохо: цвет переворачивается, стрелка — нет
  const tone =
    delta.direction === 'flat' ? 'flat' : (delta.direction === 'up') !== !!inverse ? 'up' : 'down';
  return (
    <span className={cx('kpi-delta', `kpi-delta--${tone}`)}>
      {delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '•'}{' '}
      {delta.text.replace(/^[+−]/, '')}
    </span>
  );
}

function Tile({
  id,
  label,
  value,
  hint,
  delta,
  inverse,
  compare,
}: {
  id: string;
  label: string;
  value: string;
  hint: string;
  delta: Delta;
  inverse?: boolean;
  compare: boolean;
}) {
  return (
    <article className={`kpi kpi--${id}`}>
      <div className="kpi__top">
        <span>{label}</span>
      </div>
      <div className="kpi__body">
        <strong className="kpi__value" data-testid={`pa-kpi-${id}`}>
          {value}
        </strong>
      </div>
      <div className="kpi__hint">{hint}</div>
      {compare && <DeltaMark delta={delta} {...(inverse ? { inverse } : {})} />}
    </article>
  );
}

/** Шесть плиток ТЗ §5: загрузка, выручка проживания, продано ночей, брони, отмены, средний чек */
function KpiRow({ c, p }: { c: DashboardPeriod; p: DashboardPeriod | null }) {
  const compare = p !== null;
  const prev = p ?? c;
  const single = c.nights === 1;
  return (
    <section className="kpi-grid pa-kpis" aria-label="Показатели за период" data-testid="pa-kpis">
      <Tile
        id="occupancy"
        label="Загрузка"
        value={formatPercent(c.occupancy.percent)}
        hint={
          single
            ? `занято ${c.occupancy.occupiedNights} из ${c.units} мест`
            : `блокировки входят в фонд: ${formatInt(c.occupancy.blockedNights)} ночей закрыто`
        }
        delta={pointsDelta(
          c.occupancy.percent,
          prev.occupancy.percent,
          prev.occupancy.occupiedNights,
        )}
        compare={compare}
      />
      <Tile
        id="revenue"
        label="Выручка проживания"
        value={wholeTenge(c.revenue.accommodationMinor)}
        hint="начислено за проживание, по дню заезда"
        delta={moneyDelta(c.revenue.accommodationMinor, prev.revenue.accommodationMinor)}
        compare={compare}
      />
      <Tile
        id="nights"
        label="Продано ночей"
        value={formatInt(c.occupancy.occupiedNights)}
        hint={`из ${formatInt(c.occupancy.unitNights)} ночей фонда`}
        delta={deltaPercent(c.occupancy.occupiedNights, prev.occupancy.occupiedNights)}
        compare={compare}
      />
      <Tile
        id="bookings"
        label="Брони"
        value={formatInt(c.bookings.total)}
        hint={`с заездом в периоде, к заезду ${formatInt(c.bookings.active)}`}
        delta={deltaPercent(c.bookings.total, prev.bookings.total)}
        compare={compare}
      />
      <Tile
        id="cancelled"
        label="Отмены"
        value={formatPercent(c.bookings.cancelledPercent)}
        hint={`${pluralRu(c.bookings.cancelled, ['отмена', 'отмены', 'отмен'])}${
          c.bookings.noShow
            ? `, незаездов ${c.bookings.noShow} (${formatPercent(c.bookings.noShowPercent)})`
            : ''
        }`}
        delta={pointsDelta(
          c.bookings.cancelledPercent,
          prev.bookings.cancelledPercent,
          prev.bookings.total,
        )}
        inverse
        compare={compare}
      />
      <Tile
        id="average"
        label="Средний чек брони"
        value={c.bookings.averageMinor ? wholeTenge(c.bookings.averageMinor) : '—'}
        hint="стоимость броней без отмен и незаездов"
        delta={moneyDelta(c.bookings.averageMinor, prev.bookings.averageMinor)}
        compare={compare}
      />
    </section>
  );
}

/**
 * Средняя цена и доход на единицу — только внутри одного типа фонда (ТЗ §6): номер и койка в одну
 * среднюю не смешиваются. При «Всех» — строка со ссылками на оба типа.
 */
function UnitEconomics({
  c,
  p,
  query,
}: {
  c: DashboardPeriod;
  p: DashboardPeriod | null;
  query: AnalyticsQuery;
}) {
  if (c.fund === 'all') {
    if (!(c.funds.rooms > 0 && c.funds.beds > 0)) return null;
    return (
      <p className="pa-note muted" data-testid="pa-unit-economics">
        Средняя цена за ночь и доход на единицу считаются отдельно:{' '}
        <Link href={analyticsHref(query, { fund: 'rooms' })}>для номеров</Link> и{' '}
        <Link href={analyticsHref(query, { fund: 'beds' })}>для коек</Link>.
      </p>
    );
  }
  const rooms = c.fund === 'rooms';
  return (
    <section
      className="kpi-secondary pa-secondary"
      aria-label={rooms ? 'Номера: цена и доход' : 'Койки: цена и доход'}
      data-testid="pa-unit-economics"
    >
      <Tile
        id="adr"
        label={rooms ? 'Средняя цена номера (ADR)' : 'Средняя цена койки'}
        value={c.adrMinor ? wholeTenge(c.adrMinor) : '—'}
        hint={`выручка проживания на проданную ночь ${rooms ? 'номера' : 'койки'}`}
        delta={moneyDelta(c.adrMinor, p?.adrMinor ?? null)}
        compare={p !== null}
      />
      <Tile
        id="revpar"
        label={rooms ? 'Доход на номер (RevPAR)' : 'Доход на койку'}
        value={c.revparMinor ? wholeTenge(c.revparMinor) : '—'}
        hint={`выручка проживания на ${rooms ? 'каждый номер' : 'каждую койку'} за ночь`}
        delta={moneyDelta(c.revparMinor, p?.revparMinor ?? null)}
        compare={p !== null}
      />
    </section>
  );
}

function OccupancyPanel({ c, today }: { c: DashboardPeriod; today: string }) {
  const chessboard = `/chessboard?from=${c.from}&to=${c.to}`;
  if (c.nights === 1)
    return (
      <Panel title="Загрузка по категориям" className="dash-panel">
        <ul className="hbars" data-testid="pa-chart-categories">
          {c.categories.map((cat) => (
            <li key={cat.code}>
              <span className="hbars__label">{cat.name}</span>
              <span className="hbars__track">
                <i style={{ width: `${cat.percent}%` }} />
              </span>
              <span className="hbars__value">
                {cat.occupiedNights} из {cat.units}, {formatPercent(cat.percent)}
              </span>
            </li>
          ))}
        </ul>
        <Link href={chessboard} className="dash-panel__link">
          Открыть шахматку на этот день
        </Link>
      </Panel>
    );
  return (
    <Panel title="Загрузка по дням" className="dash-panel">
      <DayBars
        testId="pa-chart-occupancy"
        today={today}
        days={c.daily.map((d) => ({
          date: d.date,
          height: d.percent,
          facts: `загрузка ${formatPercent(d.percent)}, занято ${d.occupied}, свободно ${d.free}, заблокировано ${d.blocked}`,
        }))}
      />
      <div className="bars-legend muted">
        <span>
          <i className="bars-legend__past" /> прошедшие дни
        </span>
        <span>
          <i className="bars-legend__future" /> будущие (по броням)
        </span>
        <Link href={chessboard}>Открыть шахматку</Link>
      </div>
    </Panel>
  );
}

function RevenuePanel({ c, today }: { c: DashboardPeriod; today: string }) {
  const max = c.daily.reduce((m, d) => (b(d.revenueMinor) > m ? b(d.revenueMinor) : m), 0n);
  // высота — доля от самого денежного дня; тысячные доли целочисленно, без float над деньгами
  const height = (v: string) => (max > 0n ? Number((b(v) * 1000n) / max) / 10 : 0);
  return (
    <Panel title="Выручка проживания по дням" className="dash-panel">
      {c.nights === 1 ? (
        <p className="pa-single">
          <strong data-testid="pa-revenue-day">{wholeTenge(c.revenue.accommodationMinor)}</strong>{' '}
          <span className="muted">начислено за проживания с заездом в этот день</span>
        </p>
      ) : (
        <DayBars
          testId="pa-chart-revenue"
          today={today}
          days={c.daily.map((d) => ({
            date: d.date,
            height: height(d.revenueMinor),
            facts: `начислено за проживание ${wholeTenge(d.revenueMinor)}, заездов ${d.arrivals}`,
          }))}
        />
      )}
      <p className="muted dash-note pa-note-links">
        Начисление за проживание датировано днём заезда
        {c.nights > 1
          ? ': столбик — стоимость заехавших в этот день проживаний, а не проданные в этот день ночи.'
          : ', а не проданными ночами.'}{' '}
        Оплаты и долги — в разделе <Link href={`/finance?from=${c.from}&to=${c.to}`}>«Оплаты»</Link>
        .
      </p>
    </Panel>
  );
}

function SourcesPanel({ c }: { c: DashboardPeriod }) {
  const top = c.sources.slice(0, 6);
  return (
    <Panel title="Источники броней" className="dash-panel">
      {top.length === 0 ? (
        <p className="muted dash-empty">Заездов за период нет.</p>
      ) : (
        <ul className="sources" data-testid="pa-sources">
          {top.map((s) => (
            <li key={`${s.source}|${s.channel ?? ''}`}>
              <span className="sources__label">{sourceLabel(s.source, s.channel)}</span>
              <span className="sources__count">{formatInt(s.count)}</span>
              <span className="sources__track">
                <i style={{ width: `${s.share}%` }} />
              </span>
              <span className="sources__share">{formatPercent(s.share)}</span>
              <span className="sources__amount">{wholeTenge(s.amountMinor)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted dash-note pa-note-links">
        По дате заезда, без отмен и незаездов; сумма — стоимость броней.{' '}
        {c.sources.length > top.length && `Ещё ${c.sources.length - top.length} источников — `}
        <Link href={`/channel-manager?from=${c.from}&to=${c.to}`}>полный отчёт по каналам</Link>
      </p>
    </Panel>
  );
}

function CategoriesPanel({ c }: { c: DashboardPeriod }) {
  return (
    <Panel title="Категории" className="dash-panel dash-panel--table">
      <Table
        className="dash-table dash-table--categories has-occupancy pa-categories"
        nowrap
        data-testid="pa-categories"
      >
        <thead>
          <tr>
            <th>Категория</th>
            <th>Загрузка</th>
            <th className="num">Продано ночей</th>
            <th className="num">Выручка</th>
            <th className="num">Ср. цена за ночь</th>
          </tr>
        </thead>
        <tbody>
          {c.categories.map((cat) => (
            <tr key={cat.code}>
              <td className="dash-table__name">
                {cat.name}
                <div className="muted">
                  {cat.kind === 'BED'
                    ? pluralRu(cat.units, ['койка', 'койки', 'коек'])
                    : pluralRu(cat.units, ['номер', 'номера', 'номеров'])}
                </div>
              </td>
              <td className="dash-table__occupancy">
                <span className="occupancy-meter">
                  <meter
                    min="0"
                    max="100"
                    value={cat.percent}
                    aria-label={`Загрузка ${formatPercent(cat.percent)}`}
                  />
                  <span>{formatPercent(cat.percent)}</span>
                </span>
              </td>
              <td className="num">
                <span className="dash-cell-word">ночей </span>
                {formatInt(cat.occupiedNights)}
                <span className="muted"> из {formatInt(cat.unitNights)}</span>
              </td>
              <td className="num">
                <span className="dash-cell-word">выручка </span>
                {wholeTenge(cat.revenueMinor)}
              </td>
              <td className="num">
                <span className="dash-cell-word">ср. цена </span>
                {cat.adrMinor ? wholeTenge(cat.adrMinor) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="muted dash-note pa-note-links">
        Средняя цена — выручка проживания категории на её проданную ночь: категория — или номера,
        или койки, поэтому цены не смешиваются.
      </p>
    </Panel>
  );
}

const hasData = (c: DashboardPeriod) =>
  c.occupancy.occupiedNights > 0 || c.bookings.total > 0 || b(c.revenue.accommodationMinor) !== 0n;

/**
 * «Обзор» за период (ADR-108, срез AN1): одна выборка `GET /desk/dashboard` за текущий и предыдущий отрезок
 * той же длины. Отказ называет себя словами и не уносит полосу периода — она на странице, вне `Suspense`.
 */
export async function Overview({ query, today }: { query: AnalyticsQuery; today: string }) {
  const { period, fund } = query;
  const view = await dashboardApi
    .period(period.from, period.to, fund)
    .catch((error: unknown) => (error instanceof ApiError ? error : Promise.reject(error)));
  if (view instanceof ApiError) return <LoadError testId="pa-error" {...loadErrorProps(view)} />;
  const c = view.current;
  const p = query.compare ? view.previous : null;
  if (c.units === 0)
    return (
      <>
        <EmptyState
          data-testid="pa-empty"
          title={
            fund === 'all'
              ? 'В номерном фонде нет мест'
              : `В фонде нет ${fund === 'rooms' ? 'номеров' : 'коек'}`
          }
          actions={
            fund === 'all' ? (
              <Link className="btn btn--secondary" href="/inventory">
                Номера и койки
              </Link>
            ) : (
              <Link className="btn btn--secondary" href={analyticsHref(query, { fund: 'all' })}>
                Весь фонд
              </Link>
            )
          }
        >
          Загрузка и выручка считаются по номерам и койкам фонда.
        </EmptyState>
      </>
    );
  if (!hasData(c))
    return (
      <>
        <EmptyState data-testid="pa-empty" title="Недостаточно данных за выбранный период">
          Выберите другой период: в этом нет ни проданных ночей, ни броней, ни начислений.
        </EmptyState>
      </>
    );
  return (
    <>
      <KpiRow c={c} p={p} />
      <UnitEconomics c={c} p={p} query={query} />
      {p && (
        <p className="kpi-compare muted" data-testid="pa-compare">
          Сравнение с {displayDate(p.from)}
          {p.from !== p.to && ` — ${displayDate(p.to)}`}: тот же расчёт за столько же дней вплотную
          до начала периода. Где «—», в прошлом периоде данных нет.
          {c.unassigned > 0 &&
            ` Без ячейки ${pluralRu(c.unassigned, ['проживание', 'проживания', 'проживаний'])} — в загрузку не входят.`}
        </p>
      )}
      <OccupancyPanel c={c} today={today} />
      <div className="dash-grid dash-grid--chart">
        <RevenuePanel c={c} today={today} />
        <SourcesPanel c={c} />
      </div>
      <CategoriesPanel c={c} />
    </>
  );
}

/** Скелетон плиток и графика (ТЗ §26); ни одного `data-testid` готового экрана */
export function OverviewSkeleton() {
  return (
    <div className="pa-skeleton" aria-busy="true" data-testid="pa-loading">
      <div className="kpi-grid pa-kpis">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} variant="stat" />
        ))}
      </div>
      <Skeleton className="pa-skeleton__chart" />
      <span className="sr-only" role="status">
        Считаем показатели за период…
      </span>
    </div>
  );
}
