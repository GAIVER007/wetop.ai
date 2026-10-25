import Link from 'next/link';
import { MAX_CHESSBOARD_DAYS, type DashboardCategory, type DashboardPeriod } from '@pms/domain';
import { ApiError, dashboardApi } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import { LoadError } from '../../../../components/load-error';
import { EmptyState, Help, LoadingState, Panel, Skeleton, Table } from '../../../../components/ui';
import { deltaPoints, formatInt, formatPercent } from '../../../../lib/dashboard-format';
import { displayDate } from '../../../../lib/display-date';
import { countLabel, intlLocale, msg, type DeskLocale, type Translate } from '../../../../i18n';
import { currentLocale, serverT } from '../../../../i18n/server';
import { analyticsHref, type AnalyticsQuery } from '../params';
import { OccupancyTiles } from '../occupancy-tiles';
import { DeltaMark, NO_BASE, Tile, countDelta } from '../tiles';

const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Шахматка на тот же отрезок (её потолок — 62 дня за раз) с тем же типом фонда и, если задана, категорией.
 * Шахматка читает `category` и `kind` из адреса и открывается уже отфильтрованной.
 */
export function chessboardHref(
  from: string,
  to: string,
  fund: AnalyticsQuery['fund'],
  category?: string,
): string {
  const last = addDays(from, MAX_CHESSBOARD_DAYS - 1);
  const sp = new URLSearchParams({ from, to: to > last ? last : to });
  if (category) sp.set('category', category);
  else if (fund !== 'all') sp.set('kind', fund === 'rooms' ? 'ROOM' : 'BED');
  return `/chessboard?${sp}`;
}

const places = (kind: DashboardCategory['kind'], n: number, locale: DeskLocale, t: Translate) =>
  kind === 'BED'
    ? countLabel(locale, t, n, [msg('койка'), 'койки', msg('коек')]) // kk-allow: форма склонения
    : countLabel(locale, t, n, [msg('номер'), 'номера', msg('номеров')]); // kk-allow: форма склонения

/**
 * Пять плиток «Загрузки» (ТЗ AN2): загрузка, занято, свободно, заблокировано, без размещения. На одном дне
 * числа — места; за период — ночи (место × ночь), как у «Проданных ночей» «Обзора». Блокировки — в фонде.
 */
function OccupancyKpis({ c, p, t }: { c: DashboardPeriod; p: DashboardPeriod | null; t: Translate }) {
  const single = c.nights === 1;
  const prev = p ?? c;
  const compare = p !== null;
  const o = c.occupancy;
  return (
    <section
      className="kpi-grid pa-kpis pa-kpis--occupancy"
      aria-label={t('Загрузка фонда')}
      data-testid="pa-occupancy-kpis"
    >
      <OccupancyTiles
        c={c}
        p={p}
        t={t}
        hint={(k) =>
          single
            ? t('занято {n} из {total} мест, доступных к продаже', {
                n: formatInt(k.occupiedNights),
                total: formatInt(k.sellableNights),
              })
            : t('занято {n} из {total} ночей, доступных к продаже', {
                n: formatInt(k.occupiedNights),
                total: formatInt(k.sellableNights),
              })
        }
      />
      <Tile
        id="occupied"
        label={t('Занято')}
        value={formatInt(o.occupiedNights)}
        hint={single ? t('мест по размещениям в календаре') : t('ночей по размещениям в календаре')}
        delta={countDelta(o.occupiedNights, prev.occupancy.occupiedNights)}
        compare={compare}
      />
      <Tile
        id="free"
        label={t('Свободно')}
        value={formatInt(o.freeNights)}
        hint={single ? t('мест можно продать') : t('ночей можно было продать')}
        delta={countDelta(o.freeNights, prev.occupancy.freeNights)}
        inverse
        compare={compare}
      />
      <Tile
        id="blocked"
        label={t('Заблокировано')}
        value={formatInt(o.blockedNights)}
        hint={t('закрыты для продажи, из загрузки вычтены')}
        delta={countDelta(o.blockedNights, prev.occupancy.blockedNights)}
        inverse
        compare={compare}
      />
      <Tile
        id="unassigned"
        label={t('Без размещения')}
        value={formatInt(c.unassigned)}
        hint={
          c.unassigned > 0 ? (
            <>
              {t('проживаний без номера, в загрузку не входят;')}{' '}
              <Link href="/reservations?allocation=missing" className="pa-kpi-link">
                {t('разместить')}
              </Link>
            </>
          ) : (
            t('все проживания размещены')
          )
        }
        delta={countDelta(c.unassigned, prev.unassigned)}
        inverse
        compare={compare}
      />
    </section>
  );
}

/**
 * Таблица категорий — бывшая таблица «Статистики» на новом расчёте: те же колонки плюс «Без места»,
 * изменение загрузки к прошлому отрезку и ссылка в календарь категории.
 */
function CategoryTable({
  c,
  p,
  query,
  t,
  locale,
}: {
  c: DashboardPeriod;
  p: DashboardPeriod | null;
  query: AnalyticsQuery;
  t: Translate;
  locale: DeskLocale;
}) {
  const single = c.nights === 1;
  const before = new Map((p?.categories ?? []).map((cat) => [cat.code, cat]));
  return (
    <Panel title={t('Загрузка по категориям')} className="dash-panel dash-panel--table">
      <Table
        className="dash-table dash-table--categories pa-occupancy-table"
        nowrap
        data-testid="statistics-table"
      >
        <thead>
          <tr>
            <th>{t('Категория')}</th>
            <th className="num">{single ? t('Мест') : t('Ночей фонда')}</th>
            <th className="num">{t('Занято')}</th>
            <th className="num">{t('Свободно')}</th>
            <th className="num">{t('Блок')}</th>
            <th className="num">{t('Без места')}</th>
            <th>{t('Загрузка')}</th>
            {p && <th>{t('К прошлому')}</th>}
          </tr>
        </thead>
        <tbody>
          {c.categories.map((cat) => {
            const was = before.get(cat.code);
            return (
              <tr key={cat.code}>
                <td className="dash-table__name">
                  <Link href={chessboardHref(c.from, c.to, query.fund, cat.code)}>{cat.name}</Link>
                  <div className="muted">{places(cat.kind, cat.units, locale, t)}</div>
                </td>
                <td className="num">
                  <span className="dash-cell-word">{single ? t('мест') : t('ночей фонда')} </span>
                  {formatInt(cat.unitNights)}
                </td>
                <td className="num">
                  <span className="dash-cell-word">{t('занято')} </span>
                  {formatInt(cat.occupiedNights)}
                </td>
                <td className="num">
                  <span className="dash-cell-word">{t('свободно')} </span>
                  {formatInt(cat.freeNights)}
                </td>
                <td className="num">
                  <span className="dash-cell-word">{t('блок')} </span>
                  {formatInt(cat.blockedNights)}
                </td>
                <td className="num">
                  <span className="dash-cell-word">{t('без места')} </span>
                  {formatInt(cat.unassigned)}
                </td>
                <td className="dash-table__occupancy">
                  <span className="occupancy-meter">
                    <meter
                      min="0"
                      max="100"
                      value={cat.percent}
                      aria-label={t('Загрузка {percent}', { percent: formatPercent(cat.percent) })}
                    />
                    <span>{formatPercent(cat.percent)}</span>
                  </span>
                </td>
                {p && (
                  <td className="pa-occupancy-table__delta">
                    <span className="dash-cell-word">{t('к прошлому')} </span>
                    <DeltaMark
                      delta={
                        was && was.occupiedNights > 0
                          ? deltaPoints(cat.percent, was.percent)
                          : NO_BASE
                      }
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </Table>
      <div className="pa-panel-foot">
        <Link
          className="btn btn--secondary"
          href={chessboardHref(c.from, c.to, query.fund)}
          data-testid="pa-open-chessboard"
        >
          {t('Открыть календарь')}
        </Link>
        <span className="muted">
          {single
            ? t('на этот день')
            : c.nights > MAX_CHESSBOARD_DAYS
              ? t('на первые {n} дней', { n: MAX_CHESSBOARD_DAYS })
              : t('на этот период')}
          {t('; название категории открывает её строки')}
        </span>
      </div>
    </Panel>
  );
}

/**
 * «Сравнение категорий»: категории выбранного фонда по загрузке сверху вниз, черта — средняя по фонду.
 * Число справа — отличие от средней в п.п.; сама загрузка категории — в таблице выше (одно число —
 * один раз на экране). Одной категории сравнивать не с чем — панели нет.
 */
function CategoryComparison({ c, t }: { c: DashboardPeriod; t: Translate }) {
  if (c.categories.length < 2) return null;
  const avg = c.occupancy.percent;
  const ranked = [...c.categories].sort(
    (a, b) => b.percent - a.percent || a.name.localeCompare(b.name, 'ru'),
  );
  return (
    <Panel title={t('Сравнение категорий')} className="dash-panel">
      <ul className="hbars pa-rank" data-testid="pa-category-rank">
        {ranked.map((cat) => {
          const diff = deltaPoints(cat.percent, avg);
          return (
            <li key={cat.code}>
              <span className="hbars__label">{cat.name}</span>
              <span className="hbars__track pa-rank__track">
                <i style={{ width: `${cat.percent}%` }} />
                <b className="pa-rank__avg" style={{ left: `${avg}%` }} aria-hidden="true" />
              </span>
              <span
                className={`hbars__value pa-rank__diff pa-rank__diff--${diff.direction ?? 'flat'}`}
              >
                {diff.direction === 'flat' ? t('как в среднем') : t('{diff} к среднему', { diff: diff.text })}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="muted dash-note">
        {t('Полоса — загрузка категории, черта — средняя по выбранному фонду: {percent}.', {
          percent: formatPercent(avg),
        })}
      </p>
    </Panel>
  );
}

/**
 * «Аналитика → Загрузка» v2 (ADR-114, срез AN2): бывшая «Статистика» на общем расчёте `GET /desk/dashboard` —
 * день или период, «Все / Номера / Койки», сравнение с отрезком той же длины. Знаменатель прежний:
 * с 09.10.2026 закрытые для продажи места вычтены из знаменателя (ADR-155, Q-286); до этого входили в фонд (ADR-047).
 */
export async function Occupancy({ query }: { query: AnalyticsQuery }) {
  const { period, fund } = query;
  const [t, locale] = await Promise.all([serverT(), currentLocale()]);
  const lang = intlLocale(locale);
  const view = await dashboardApi
    .period(period.from, period.to, fund)
    .catch((error: unknown) => (error instanceof ApiError ? error : Promise.reject(error)));
  if (view instanceof ApiError)
    return <LoadError testId="statistics-error" {...loadErrorProps(view)} />;
  const c = view.current;
  const p = query.compare ? view.previous : null;
  const single = c.nights === 1;
  if (c.units === 0)
    return (
      <EmptyState
        data-testid="pa-empty"
        title={
          fund === 'all'
            ? t('В номерном фонде нет мест')
            : fund === 'rooms'
              ? t('В фонде нет номеров')
              : t('В фонде нет коек')
        }
        actions={
          fund === 'all' ? (
            <Link className="btn btn--secondary" href="/inventory">
              {t('Номера и койки')}
            </Link>
          ) : (
            <Link className="btn btn--secondary" href={analyticsHref(query, { fund: 'all' })}>
              {t('Весь фонд')}
            </Link>
          )
        }
      >
        {t('Загрузка считается по номерам и койкам из раздела «Номера и койки».')}
      </EmptyState>
    );
  return (
    <>
      {/* Один <span>: `.directory-meta` — flex со `space-between`, и дата с <time> уезжала на середину строки (21.09) */}
      <p className="directory-meta pa-meta" data-testid="statistics-meta">
        <span>
          {single ? (
            <>
              {t('Загрузка на')} <time dateTime={c.from}>{displayDate(c.from, 'numeric')}</time>{' '}
              {t('по размещениям в календаре')}
            </>
          ) : (
            <>
              {t('Загрузка с')} <time dateTime={c.from}>{displayDate(c.from, 'numeric')}</time>{' '}
              {t('по')} <time dateTime={c.to}>{displayDate(c.to, 'numeric')}</time>{' '}
              {t('по размещениям в календаре, в ночах: место × ночь')}
            </>
          )}
        </span>
      </p>
      <OccupancyKpis c={c} p={p} t={t} />
      {p && (
        <p className="kpi-compare muted" data-testid="pa-compare">
          {t('Сравнение с {range}: тот же расчёт за столько же дней вплотную до начала периода. Где «—», в прошлом периоде данных нет.', {
            range:
              displayDate(p.from, 'short', lang) +
              (p.from !== p.to ? ` — ${displayDate(p.to, 'short', lang)}` : ''),
          })}
        </p>
      )}
      <div className="dash-grid">
        <CategoryTable c={c} p={p} query={query} t={t} locale={locale} />
        <CategoryComparison c={c} t={t} />
      </div>
      <Help title={msg('Расчёт загрузки')}>
        {t(
          'Загрузка = занятые места / места, доступные к продаже: закрытое для продажи место в знаменателе не учитывается и показано отдельной строкой. Номер считается одним местом, койка — одним. За период считаются ночи: место × ночь. Проживания без номера не занимают место в календаре и в загрузку не входят —',
        )}{' '}
        {c.unassigned > 0
          ? t('сейчас их {n}.', { n: formatInt(c.unassigned) })
          : t('сейчас таких нет.')}
      </Help>
    </>
  );
}

/** Ожидание чисел под полосой периода: пять плиток и строки категорий */
export function OccupancySkeleton() {
  return (
    <LoadingState label={msg('Считаем загрузку по календарю…')} data-testid="statistics-loading">
      <div className="kpi-grid pa-kpis pa-kpis--occupancy">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} variant="stat" />
        ))}
      </div>
      <Skeleton variant="row" />
      <Skeleton variant="row" />
      <Skeleton variant="row" />
    </LoadingState>
  );
}
