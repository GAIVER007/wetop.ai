import Link from 'next/link';
import type { ChannelEfficiency, ChannelEfficiencyRow, ChannelEfficiencySort } from '@pms/domain';
import { ApiError, dashboardApi } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import { LoadError } from '../../../../components/load-error';
import { DateInput } from '../../../../components/date-field';
import {
  Button,
  EmptyState,
  Help,
  LoadingState,
  Panel,
  Select,
  Skeleton,
  Table,
} from '../../../../components/ui';
import {
  deltaPercent,
  formatInt,
  formatPercent,
  wholeTenge,
  type Delta,
} from '../../../../lib/dashboard-format';
import { displayDate } from '../../../../lib/display-date';
import { propertyCurrency } from '../../../../lib/hotel-api';
import { DeltaMark } from '../tiles';
import { CHANNELS_PATH, channelLabel, channelsHref, type ChannelsQuery } from './query';
import { msg, type Translate } from '../../../../i18n';
import { serverT } from '../../../../i18n/server';

const SORT_LABEL: Record<ChannelEfficiencySort, string> = {
  revenue: msg('Сортировать по доходу'),
  nights: msg('Сортировать по ночам'),
  adr: msg('Сортировать по средней стоимости'),
};

/** Заголовок колонки: ссылка сортировки; текущая отмечена `aria-sort` */
function SortHead({
  query,
  sort,
  children,
  t,
}: {
  query: ChannelsQuery;
  sort: ChannelEfficiencySort;
  children: React.ReactNode;
  t: Translate;
}) {
  const on = query.sort === sort;
  return (
    <th className="num" aria-sort={on ? 'descending' : 'none'}>
      <Link
        prefetch={false}
        className="pa-sort"
        href={channelsHref(query, { sort })}
        aria-label={t(SORT_LABEL[sort])}
      >
        {children}
        <span aria-hidden="true">{on ? ' ▼' : ''}</span>
      </Link>
    </th>
  );
}

/** Прошлый период под числом строки: значение и изменение к нему; без базы: только значение */
function Before({ value, delta, t }: { value: string; delta: Delta; t: Translate }) {
  return (
    <span className="pa-channels__before">
      {t('было {value}', { value })}
      {delta.direction && (
        <>
          {' '}
          <DeltaMark delta={delta} />
        </>
      )}
    </span>
  );
}

function Cells({
  row,
  prev,
  cur,
  t,
}: {
  row: Pick<ChannelEfficiencyRow, 'revenueMinor' | 'nights' | 'adrMinor'> & {
    revenueShare: number | null;
    nightsShare: number | null;
  };
  prev?: Pick<ChannelEfficiencyRow, 'revenueMinor' | 'nights' | 'adrMinor'> | null | undefined;
  /** валюта объекта: доход и ADR в ней, не всегда тенге */
  cur: string;
  t: Translate;
}) {
  return (
    <>
      <td className="num">
        <span className="dash-cell-word">{t('доход')} </span>
        {wholeTenge(row.revenueMinor, cur)}
        {row.revenueShare !== null && (
          <span className="pa-channels__share">{formatPercent(row.revenueShare)}</span>
        )}
        {prev !== undefined && (
          <Before
            t={t}
            value={prev ? wholeTenge(prev.revenueMinor, cur) : wholeTenge('0', cur)}
            delta={deltaPercent(BigInt(row.revenueMinor), BigInt(prev?.revenueMinor ?? '0'))}
          />
        )}
      </td>
      <td className="num">
        <span className="dash-cell-word">{t('ночи')} </span>
        {formatInt(row.nights)}
        {row.nightsShare !== null && (
          <span className="pa-channels__share">{formatPercent(row.nightsShare)}</span>
        )}
        {prev !== undefined && (
          <Before
            t={t}
            value={formatInt(prev?.nights ?? 0)}
            delta={deltaPercent(row.nights, prev?.nights ?? 0)}
          />
        )}
      </td>
      <td className="num">
        <span className="dash-cell-word">{t('за ночь')} </span>
        {row.adrMinor === null ? '—' : wholeTenge(row.adrMinor, cur)}
        {prev !== undefined && (
          <Before
            t={t}
            value={prev?.adrMinor ? wholeTenge(prev.adrMinor, cur) : '—'}
            delta={deltaPercent(BigInt(row.adrMinor ?? '0'), BigInt(prev?.adrMinor ?? '0'))}
          />
        )}
      </td>
    </>
  );
}

/** Полоса отбора: период заезда, сравнение, канал, каналы без броней; GET-форма, адрес: источник правды */
function Filters({
  query,
  report,
  t,
}: {
  query: ChannelsQuery;
  report: ChannelEfficiency | null;
  t: Translate;
}) {
  const options = report?.channels ?? [];
  const known = options.some((o) => o.label === query.channel);
  return (
    <form method="get" action={CHANNELS_PATH} className="pa-channels__form" data-testid="pa-channels-form">
      <fieldset className="pa-channels__group">
        <legend>{t('Период заезда')}</legend>
        <label>
          {t('С')}
          <DateInput name="from" defaultValue={query.from} aria-label={t('Период заезда: с')} />
        </label>
        <label>
          {t('По')}
          <DateInput
            name="to"
            rangeFromName="from"
            defaultValue={query.to}
            aria-label={t('Период заезда: по')}
          />
        </label>
      </fieldset>
      <fieldset className="pa-channels__group">
        <legend>
          <label className="pa-channels__check">
            <input type="checkbox" name="compare" value="1" defaultChecked={query.compare} />
            {t('Сравнить с периодом')}
          </label>
        </legend>
        <label>
          {t('С')}
          <DateInput name="cfrom" defaultValue={query.compareFrom} aria-label={t('Сравнить: с')} />
        </label>
        <label>
          {t('По')}
          <DateInput
            name="cto"
            rangeFromName="cfrom"
            defaultValue={query.compareTo}
            aria-label={t('Сравнить: по')}
          />
        </label>
      </fieldset>
      <label className="pa-channels__channel">
        {t('Канал')}
        <Select name="channel" defaultValue={query.channel} data-testid="pa-channels-select">
          <option value="">{t('Все')}</option>
          {options.map((o) => (
            <option key={o.label} value={o.label}>
              {t(channelLabel(o))}
            </option>
          ))}
          {query.channel && !known && <option value={query.channel}>{query.channel}</option>}
        </Select>
      </label>
      <label className="pa-channels__check">
        <input type="checkbox" name="empty" value="1" defaultChecked={query.empty} />
        {t('Показать каналы без броней')}
      </label>
      {query.sort !== 'revenue' && <input type="hidden" name="sort" value={query.sort} />}
      <Button type="submit">{t('Применить')}</Button>
    </form>
  );
}

/**
 * «Эффективность каналов» (ADR-141): строка на канал продаж: доход и его доля, ночи и их доля, средняя
 * стоимость ночи; «Итого» внизу. Правило счёта: «Обзора» (Q-208/Q-209): брони с заездом в периоде, без
 * отменённых и незаездов, сумма брони по ночам не делится. Имён гостей в отчёте нет.
 */
export async function ChannelsReport({ query }: { query: ChannelsQuery }) {
  const [cur, t] = await Promise.all([propertyCurrency(), serverT()]);
  const data = await dashboardApi
    .channels({
      from: query.from,
      to: query.to,
      compareFrom: query.compare ? query.compareFrom : undefined,
      compareTo: query.compare ? query.compareTo : undefined,
      channel: query.channel || undefined,
      sort: query.sort,
      empty: query.empty,
    })
    .catch((error: unknown) => (error instanceof ApiError ? error : Promise.reject(error)));
  if (data instanceof ApiError)
    return (
      <>
        <Filters query={query} report={null} t={t} />
        <LoadError testId="pa-channels-error" {...loadErrorProps(data)} />
      </>
    );
  const { current, previous } = data;
  const prevOf = (label: string) =>
    previous ? (previous.rows.find((r) => r.label === label) ?? null) : undefined;
  const totals = current.totals;
  return (
    <>
      <Filters query={query} report={current} t={t} />
      <p className="directory-meta pa-meta" data-testid="pa-channels-meta">
        <span>
          {t('Брони с заездом с')}{' '}
          <time dateTime={current.from}>{displayDate(current.from, 'numeric')}</time> {t('по')}{' '}
          <time dateTime={current.to}>{displayDate(current.to, 'numeric')}</time>
          {previous && (
            <>
              {', '}
              {t('сравнение с')}{' '}
              <time dateTime={previous.from}>{displayDate(previous.from, 'numeric')}</time> {t('по')}{' '}
              <time dateTime={previous.to}>{displayDate(previous.to, 'numeric')}</time>
            </>
          )}
        </span>
        <a
          className="btn btn--secondary btn--sm"
          href={channelsHref(query, {}, `${CHANNELS_PATH}/export`)}
          data-testid="pa-channels-export"
          download
        >
          {t('Скачать CSV')}
        </a>
      </p>
      {current.rows.length === 0 ? (
        <EmptyState
          data-testid="pa-channels-empty"
          title={t('В этом периоде нет броней')}
          actions={
            query.empty ? undefined : (
              <Link className="btn btn--secondary" href={channelsHref(query, { empty: true })}>
                {t('Показать все каналы')}
              </Link>
            )
          }
        >
          {t('Отчёт считает брони с заездом в выбранном периоде, без отменённых и незаездов.')}
        </EmptyState>
      ) : (
        <Panel title={t('Эффективность каналов')} className="dash-panel dash-panel--table">
          <Table className="dash-table pa-channels-table" nowrap data-testid="pa-channels-table">
            <thead>
              <tr>
                <th>{t('Канал')}</th>
                <SortHead query={query} sort="revenue" t={t}>
                  {t('Доход, сумма и доля')}
                </SortHead>
                <SortHead query={query} sort="nights" t={t}>
                  {t('Ночи, количество и доля')}
                </SortHead>
                <SortHead query={query} sort="adr" t={t}>
                  {t('Средняя стоимость ночи')}
                </SortHead>
              </tr>
            </thead>
            <tbody>
              {current.rows.map((row) => (
                <tr
                  key={row.label}
                  data-testid="pa-channels-row"
                  className={row.nights === 0 ? 'pa-channels__row--empty' : undefined}
                >
                  <td className="dash-table__name">
                    {t(channelLabel(row))}
                    <span className="pa-channels__bookings">
                      {row.bookings > 0
                        ? t('броней: {n}', { n: formatInt(row.bookings) })
                        : t('броней нет')}
                    </span>
                  </td>
                  <Cells row={row} prev={prevOf(row.label)} cur={cur} t={t} />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="pa-channels-total" data-testid="pa-channels-total">
                <th scope="row">
                  {t('Итого')}
                  <span className="pa-channels__bookings">
                    {t('броней: {n}', { n: formatInt(totals.bookings) })}
                  </span>
                </th>
                <Cells
                  row={{
                    ...totals,
                    revenueShare: query.channel ? null : totals.revenueMinor === '0' ? 0 : 100,
                    nightsShare: query.channel ? null : totals.nights === 0 ? 0 : 100,
                  }}
                  prev={previous ? previous.totals : undefined}
                  cur={cur}
                  t={t}
                />
              </tr>
            </tfoot>
          </Table>
        </Panel>
      )}
      <Help title={msg('Как считается')}>
        {t(
          'Берутся брони с датой заезда в выбранном периоде, без отменённых и незаездов. Доход брони: её стоимость проживания целиком, по ночам она не делится. Доля: от всех каналов периода. Средняя стоимость ночи = доход канала / его ночи. При сравнении под числом: значение за другой период и изменение к нему.',
        )}
      </Help>
    </>
  );
}

/** Ожидание отчёта под вкладками */
export function ChannelsSkeleton() {
  return (
    <LoadingState label={msg('Считаем доход по каналам…')} data-testid="pa-channels-loading">
      <Skeleton variant="row" />
      <Skeleton variant="row" />
      <Skeleton variant="row" />
    </LoadingState>
  );
}
