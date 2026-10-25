import Link from 'next/link';
import type { UnitStatRow } from '@pms/domain';
import { ApiError, dashboardApi } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import { LoadError } from '../../../../components/load-error';
import { EmptyState, Help, LoadingState, Panel, Skeleton, Table } from '../../../../components/ui';
import { formatInt, formatPercent } from '../../../../lib/dashboard-format';
import { displayDate } from '../../../../lib/display-date';
import { countLabel, msg, type DeskLocale, type Translate } from '../../../../i18n';
import { currentLocale, serverT } from '../../../../i18n/server';
import { analyticsHref, type AnalyticsQuery } from '../params';

const places = (kind: UnitStatRow['kind'], n: number, locale: DeskLocale, t: Translate) =>
  kind === 'BED'
    ? countLabel(locale, t, n, [msg('койка'), 'койки', msg('коек')]) // kk-allow: форма склонения
    : countLabel(locale, t, n, [msg('номер'), 'номера', msg('номеров')]); // kk-allow: форма склонения

/** Загрузка в ячейке: та же полоса с числом, что в таблице категорий «Загрузки» */
function Meter({ percent, t }: { percent: number; t: Translate }) {
  return (
    <span className="occupancy-meter">
      <meter min="0" max="100" value={percent} aria-label={t('Загрузка {percent}', { percent: formatPercent(percent) })} />
      <span>{formatPercent(percent)}</span>
    </span>
  );
}

/**
 * «Аналитика → По номерам» (REP3): те же клетки шахматки, что у «Загрузки», до единицы — по каждому
 * месту ночи занятые, закрытые блоком, загрузка и заезды. Денег в таблице нет (Q-251): проживание
 * может переезжать между местами, и делить его сумму по местам — финансовое правило, которого
 * владелец не принимал. Итог равен «Загрузке» по построению: один и тот же `GET`-расчёт.
 */
export async function UnitsReport({ query }: { query: AnalyticsQuery }) {
  const { period, fund } = query;
  const [t, locale] = await Promise.all([serverT(), currentLocale()]);
  const stats = await dashboardApi
    .units(period.from, period.to, fund)
    .catch((error: unknown) => (error instanceof ApiError ? error : Promise.reject(error)));
  if (stats instanceof ApiError)
    return <LoadError testId="pa-units-error" {...loadErrorProps(stats)} />;
  const single = stats.nights === 1;
  if (stats.totals.units === 0)
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
        {t('Отчёт считается по номерам и койкам из раздела «Номера и койки».')}
      </EmptyState>
    );
  // группы по категории — порядок строк уже «категория, потом код» (домен)
  const groups: Array<{ code: string; name: string; rows: UnitStatRow[] }> = [];
  for (const row of stats.rows) {
    const last = groups[groups.length - 1];
    if (last && last.code === row.categoryCode) last.rows.push(row);
    else groups.push({ code: row.categoryCode, name: row.categoryName, rows: [row] });
  }
  const totals = stats.totals;
  return (
    <>
      <p className="directory-meta pa-meta" data-testid="pa-units-meta">
        <span>
          {single ? (
            <>
              {t('Занятость на')} <time dateTime={stats.from}>{displayDate(stats.from, 'numeric')}</time>{' '}
              {t('по размещениям в календаре')}
            </>
          ) : (
            <>
              {t('Занятость с')} <time dateTime={stats.from}>{displayDate(stats.from, 'numeric')}</time>{' '}
              {t('по')} <time dateTime={stats.to}>{displayDate(stats.to, 'numeric')}</time>{' '}
              {t('по размещениям в календаре, в ночах')}
            </>
          )}
        </span>
      </p>
      <Panel title={t('По номерам')} className="dash-panel dash-panel--table">
        <Table className="dash-table pa-units-table" nowrap data-testid="pa-units-table">
          <thead>
            <tr>
              <th>{t('Место')}</th>
              <th className="num">{t('Занято')}</th>
              <th className="num">{t('Блок')}</th>
              <th>{t('Загрузка')}</th>
              <th className="num">{t('Заезды')}</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.code}>
              <tr className="pa-units-group" data-testid="pa-units-group">
                <th scope="colgroup" colSpan={5}>
                  {g.name}
                  <span>{places(g.rows[0]!.kind, g.rows.length, locale, t)}</span>
                </th>
              </tr>
              {g.rows.map((row) => (
                <tr key={row.code} data-testid="pa-units-row">
                  <td className="dash-table__name">
                    <Link prefetch={false} href={`/units/${encodeURIComponent(row.code)}`}>
                      {row.code}
                    </Link>
                  </td>
                  <td className="num">
                    <span className="dash-cell-word">{t('занято')} </span>
                    {formatInt(row.occupiedNights)}
                  </td>
                  <td className="num">
                    <span className="dash-cell-word">{t('блок')} </span>
                    {formatInt(row.blockedNights)}
                  </td>
                  <td className="dash-table__occupancy">
                    <Meter percent={row.percent} t={t} />
                  </td>
                  <td className="num">
                    <span className="dash-cell-word">{t('заезды')} </span>
                    {formatInt(row.arrivals)}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot>
            <tr className="pa-units-total" data-testid="pa-units-total">
              <th scope="row">
                {t('Итого: {places}', {
                  places: countLabel(locale, t, totals.units, [msg('место'), 'места', msg('мест')]), // kk-allow: форма склонения
                })}
              </th>
              <td className="num">
                <span className="dash-cell-word">{t('занято')} </span>
                {formatInt(totals.occupiedNights)}
              </td>
              <td className="num">
                <span className="dash-cell-word">{t('блок')} </span>
                {formatInt(totals.blockedNights)}
              </td>
              <td className="dash-table__occupancy">
                <Meter percent={totals.percent} t={t} />
              </td>
              <td className="num">
                <span className="dash-cell-word">{t('заезды')} </span>
                {formatInt(totals.arrivals)}
              </td>
            </tr>
          </tfoot>
        </Table>
        {stats.unassignedStays > 0 && (
          <p className="muted dash-note" data-testid="pa-units-unassigned">
            {t('Ещё {stays} без назначенного места — они не входят в строки выше.', {
              stays: countLabel(locale, t, stats.unassignedStays, [
                msg('проживание'),
                'проживания', // kk-allow: форма склонения
                msg('проживаний'),
              ]),
            })}{' '}
            <Link href="/reservations?allocation=missing">{t('Разместить')}</Link>
          </p>
        )}
      </Panel>
      <Help title={msg('Как считается')}>
        {t(
          'Те же клетки календаря, что на вкладке «Загрузка», только по каждому месту: итог этой таблицы равен загрузке фонда. Загрузка места = занятые ночи / ночи периода, закрытое блоком место остаётся в знаменателе. Код места открывает его карточку.',
        )}
      </Help>
    </>
  );
}

/** Ожидание таблицы под полосой периода */
export function UnitsSkeleton() {
  return (
    <LoadingState label={msg('Считаем занятость по местам…')} data-testid="pa-units-loading">
      <Skeleton variant="row" />
      <Skeleton variant="row" />
      <Skeleton variant="row" />
    </LoadingState>
  );
}
