import Link from 'next/link';
import { groupDaily, type DashboardBucket, type DashboardPeriod } from '@pms/domain';
import { ApiError, dashboardApi } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { LoadError } from '../../../components/load-error';
import { EmptyState, Panel, Skeleton, Table } from '../../../components/ui';
import { DayBars, type DayBar } from '../../../components/day-bars';
import { cx } from '../../../components/ui';
import { formatInt, formatPercent, sourceLabel, wholeTenge } from '../../../lib/dashboard-format';
import { displayDate } from '../../../lib/display-date';
import { pluralRu } from '../../../lib/plural';
import { analyticsHref, type AnalyticsQuery } from './params';
import { Tile, countDelta, moneyDelta, pointsDelta } from './tiles';

const b = (v: string) => BigInt(v);

const shortMonth = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', { month: 'short', timeZone: 'UTC' });

/** Столбик недели или месяца: начало, конец и подпись под ним */
function bucketBar(k: DashboardBucket, g: 'week' | 'month'): Pick<DayBar, 'date' | 'to' | 'label'> {
  return {
    date: k.from,
    to: k.to,
    label: g === 'week' ? `${k.from.slice(8, 10)}.${k.from.slice(5, 7)}` : shortMonth(k.from),
  };
}
const partialNote = (k: DashboardBucket) => (k.partial ? ' (неполный период)' : '');
/** Высота по деньгам: доля от самого денежного столбика, тысячные доли целыми числами */
function bucketHeight(value: string, all: DashboardBucket[]): number {
  const max = all.reduce((m, k) => (b(k.revenueMinor) > m ? b(k.revenueMinor) : m), 0n);
  return max > 0n ? Number((b(value) * 1000n) / max) / 10 : 0;
}

/** Категория и детализация (RPT2.2c-3): ссылки, значения живут в адресе */
function ReportFilters({ c, query }: { c: DashboardPeriod; query: AnalyticsQuery }) {
  const grains = [
    { id: undefined, label: 'По дням' },
    { id: 'week', label: 'По неделям' },
    { id: 'month', label: 'По месяцам' },
  ] as const;
  return (
    <section
      className="pa-toolbar__row pa-filters"
      aria-label="Категория и детализация"
      data-testid="pa-filters"
    >
      {c.categoryOptions.length > 1 && (
        <nav className="seg" aria-label="Категория" data-testid="pa-category">
          <Link
            href={analyticsHref(query, { category: undefined })}
            className={cx(!query.category && 'is-on')}
            aria-current={!query.category ? 'page' : undefined}
          >
            Все категории
          </Link>
          {c.categoryOptions.map((o) => (
            <Link
              key={o.code}
              href={analyticsHref(query, { category: o.code })}
              className={cx(query.category === o.code && 'is-on')}
              aria-current={query.category === o.code ? 'page' : undefined}
            >
              {o.name}
            </Link>
          ))}
        </nav>
      )}
      {c.nights > 1 && (
        <nav className="seg" aria-label="Детализация" data-testid="pa-granularity">
          {grains.map((g) => (
            <Link
              key={g.label}
              href={analyticsHref(query, { granularity: g.id })}
              className={cx(query.granularity === g.id && 'is-on')}
              aria-current={query.granularity === g.id ? 'page' : undefined}
            >
              {g.label}
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}

/** Шесть плиток ТЗ §5: загрузка, выручка проживания, продано ночей, брони, отмены, средний чек */
function KpiRow({
  c,
  p,
  detail = false,
}: {
  c: DashboardPeriod;
  p: DashboardPeriod | null;
  detail?: boolean;
}) {
  const compare = p !== null;
  const prev = p ?? c;
  const single = c.nights === 1;
  return (
    <section
      className="kpi-grid pa-kpis"
      aria-label="Показатели за период"
      data-testid={detail ? 'pa-kpis-detail' : 'pa-kpis'}
    >
      {!detail && (
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
      )}
      {!detail && (
        <Tile
          id="revenue"
          label="Начислено за проживание"
          value={wholeTenge(c.revenue.accommodationMinor)}
          hint="начислено за проживание, по дню заезда"
          delta={moneyDelta(c.revenue.accommodationMinor, prev.revenue.accommodationMinor)}
          compare={compare}
        />
      )}
      {detail && (
        <Tile
          id="nights"
          label="Продано ночей"
          value={formatInt(c.occupancy.occupiedNights)}
          hint={`из ${formatInt(c.occupancy.unitNights)} ночей фонда`}
          delta={countDelta(c.occupancy.occupiedNights, prev.occupancy.occupiedNights)}
          compare={compare}
        />
      )}
      {!detail && (
        <Tile
          id="bookings"
          label="Брони"
          value={formatInt(c.bookings.total)}
          hint={`с заездом в периоде; к заезду ${formatInt(c.bookings.active)}, размещений ${formatInt(c.bookings.stays)}`}
          delta={countDelta(c.bookings.total, prev.bookings.total)}
          compare={compare}
        />
      )}
      {!detail && (
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
      )}
      {detail && (
        <Tile
          id="average"
          label="Средний чек брони"
          value={c.bookings.averageMinor ? wholeTenge(c.bookings.averageMinor) : '—'}
          hint="стоимость броней без отмен и незаездов"
          delta={moneyDelta(c.bookings.averageMinor, prev.bookings.averageMinor)}
          compare={compare}
        />
      )}
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

function OccupancyPanel({
  c,
  today,
  query,
}: {
  c: DashboardPeriod;
  today: string;
  query: AnalyticsQuery;
}) {
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
          Открыть календарь на этот день
        </Link>
      </Panel>
    );
  return (
    <Panel title="Загрузка по дням" className="dash-panel">
      <DayBars
        testId="pa-chart-occupancy"
        today={today}
        days={
          query.granularity
            ? groupDaily(c.daily, query.granularity).map((k) => ({
                ...bucketBar(k, query.granularity!),
                height: k.percent,
                facts: `загрузка ${formatPercent(k.percent)}, занято ночей ${k.occupied}, свободно ${k.free}, заблокировано ${k.blocked}${partialNote(k)}`,
              }))
            : c.daily.map((d) => ({
                date: d.date,
                height: d.percent,
                facts: `загрузка ${formatPercent(d.percent)}, занято ${d.occupied}, свободно ${d.free}, заблокировано ${d.blocked}`,
              }))
        }
      />
      <div className="bars-legend muted">
        <span>
          <i className="bars-legend__past" /> прошедшие дни
        </span>
        <span>
          <i className="bars-legend__future" /> будущие (по броням)
        </span>
        <Link href={chessboard}>Открыть календарь</Link>
      </div>
    </Panel>
  );
}

function RevenuePanel({
  c,
  today,
  query,
}: {
  c: DashboardPeriod;
  today: string;
  query: AnalyticsQuery;
}) {
  const max = c.daily.reduce((m, d) => (b(d.revenueMinor) > m ? b(d.revenueMinor) : m), 0n);
  // высота — доля от самого денежного дня; тысячные доли целочисленно, без float над деньгами
  const height = (v: string) => (max > 0n ? Number((b(v) * 1000n) / max) / 10 : 0);
  return (
    <Panel title="Начисления по заездам" className="dash-panel">
      {c.nights === 1 ? (
        <p className="pa-single">
          <strong data-testid="pa-revenue-day">{wholeTenge(c.revenue.accommodationMinor)}</strong>{' '}
          <span className="muted">начислено за проживания с заездом в этот день</span>
        </p>
      ) : (
        <DayBars
          testId="pa-chart-revenue"
          today={today}
          days={
            query.granularity
              ? groupDaily(c.daily, query.granularity).map((k) => ({
                  ...bucketBar(k, query.granularity!),
                  height: bucketHeight(k.revenueMinor, groupDaily(c.daily, query.granularity!)),
                  facts: `начислено за проживание ${wholeTenge(k.revenueMinor)}, заездов ${k.arrivals}${partialNote(k)}`,
                }))
              : c.daily.map((d) => ({
                  date: d.date,
                  height: height(d.revenueMinor),
                  facts: `начислено за проживание ${wholeTenge(d.revenueMinor)}, заездов ${d.arrivals}`,
                }))
          }
        />
      )}
      <p className="muted dash-note pa-note-links">
        Начисление за проживание датировано днём заезда
        {c.nights > 1
          ? ': столбик — стоимость проживаний, заехавших в этот день, а не проданные в этот день ночи.'
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

/**
 * Таблица категорий. На одном дне колонки «Загрузка» нет: её уже рисуют полосы «Загрузки по категориям»
 * выше — одно число дважды на экране (правило «Плиток главной» 21.09, DESIGN.md §8).
 */
function CategoriesPanel({ c }: { c: DashboardPeriod }) {
  const withOccupancy = c.nights > 1;
  return (
    <Panel title="Категории" className="dash-panel dash-panel--table">
      <Table
        className="dash-table dash-table--categories pa-categories"
        nowrap
        data-testid="pa-categories"
      >
        <thead>
          <tr>
            <th>Категория</th>
            {withOccupancy && <th>Загрузка</th>}
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
              {withOccupancy && (
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
              )}
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
 * «Обзор» за период (ADR-114, срез AN1): одна выборка `GET /desk/dashboard` за текущий и предыдущий отрезок
 * той же длины. Отказ называет себя словами и не уносит полосу периода — она на странице, вне `Suspense`.
 */
export async function Overview({ query, today }: { query: AnalyticsQuery; today: string }) {
  const { period, fund } = query;
  const view = await dashboardApi
    .period(period.from, period.to, fund, query.category)
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
      <ReportFilters c={c} query={query} />
      <KpiRow c={c} p={p} />

      {p && (
        <p className="kpi-compare muted" data-testid="pa-compare">
          Сравнение с {displayDate(p.from)}
          {p.from !== p.to && ` — ${displayDate(p.to)}`}: тот же расчёт за столько же дней вплотную
          до начала периода. Где «—», в прошлом периоде данных нет.
          {c.unassigned > 0 &&
            ` Без ячейки ${pluralRu(c.unassigned, ['проживание', 'проживания', 'проживаний'])} — в загрузку не входят.`}
        </p>
      )}
      <div className="dash-grid dash-grid--chart pa-charts">
        <OccupancyPanel c={c} today={today} query={query} />
        <RevenuePanel c={c} today={today} query={query} />
      </div>
      <details className="pa-details">
        <summary>Подробности: ночи, средний чек, категории и источники</summary>
        <KpiRow c={c} p={p} detail />
        <UnitEconomics c={c} p={p} query={query} />
        <SourcesPanel c={c} />
        <CategoriesPanel c={c} />
      </details>
    </>
  );
}

/** Скелетон плиток и графика (ТЗ §26); ни одного `data-testid` готового экрана */
export function OverviewSkeleton() {
  return (
    <div className="pa-skeleton" aria-busy="true" data-testid="pa-loading">
      <div className="kpi-grid pa-kpis">
        {Array.from({ length: 4 }, (_, i) => (
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
