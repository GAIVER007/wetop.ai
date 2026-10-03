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
import { DeltaMark } from '../tiles';
import { CHANNELS_PATH, channelLabel, channelsHref, type ChannelsQuery } from './query';

const SORT_LABEL: Record<ChannelEfficiencySort, string> = {
  revenue: 'доходу',
  nights: 'ночам',
  adr: 'средней стоимости',
};

/** Заголовок колонки: ссылка сортировки; текущая отмечена `aria-sort` */
function SortHead({
  query,
  sort,
  children,
}: {
  query: ChannelsQuery;
  sort: ChannelEfficiencySort;
  children: React.ReactNode;
}) {
  const on = query.sort === sort;
  return (
    <th className="num" aria-sort={on ? 'descending' : 'none'}>
      <Link
        prefetch={false}
        className="pa-sort"
        href={channelsHref(query, { sort })}
        aria-label={`Сортировать по ${SORT_LABEL[sort]}`}
      >
        {children}
        <span aria-hidden="true">{on ? ' ▼' : ''}</span>
      </Link>
    </th>
  );
}

/** Прошлый период под числом строки: значение и изменение к нему; без базы: только значение */
function Before({ value, delta }: { value: string; delta: Delta }) {
  return (
    <span className="pa-channels__before">
      было {value}
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
}: {
  row: Pick<ChannelEfficiencyRow, 'revenueMinor' | 'nights' | 'adrMinor'> & {
    revenueShare: number | null;
    nightsShare: number | null;
  };
  prev?: Pick<ChannelEfficiencyRow, 'revenueMinor' | 'nights' | 'adrMinor'> | null | undefined;
}) {
  return (
    <>
      <td className="num">
        <span className="dash-cell-word">доход </span>
        {wholeTenge(row.revenueMinor)}
        {row.revenueShare !== null && (
          <span className="pa-channels__share">{formatPercent(row.revenueShare)}</span>
        )}
        {prev !== undefined && (
          <Before
            value={prev ? wholeTenge(prev.revenueMinor) : wholeTenge('0')}
            delta={deltaPercent(BigInt(row.revenueMinor), BigInt(prev?.revenueMinor ?? '0'))}
          />
        )}
      </td>
      <td className="num">
        <span className="dash-cell-word">ночи </span>
        {formatInt(row.nights)}
        {row.nightsShare !== null && (
          <span className="pa-channels__share">{formatPercent(row.nightsShare)}</span>
        )}
        {prev !== undefined && (
          <Before
            value={formatInt(prev?.nights ?? 0)}
            delta={deltaPercent(row.nights, prev?.nights ?? 0)}
          />
        )}
      </td>
      <td className="num">
        <span className="dash-cell-word">за ночь </span>
        {row.adrMinor === null ? '—' : wholeTenge(row.adrMinor)}
        {prev !== undefined && (
          <Before
            value={prev?.adrMinor ? wholeTenge(prev.adrMinor) : '—'}
            delta={deltaPercent(BigInt(row.adrMinor ?? '0'), BigInt(prev?.adrMinor ?? '0'))}
          />
        )}
      </td>
    </>
  );
}

/** Полоса отбора: период заезда, сравнение, канал, каналы без броней; GET-форма, адрес: источник правды */
function Filters({ query, report }: { query: ChannelsQuery; report: ChannelEfficiency | null }) {
  const options = report?.channels ?? [];
  const known = options.some((o) => o.label === query.channel);
  return (
    <form method="get" action={CHANNELS_PATH} className="pa-channels__form" data-testid="pa-channels-form">
      <fieldset className="pa-channels__group">
        <legend>Период заезда</legend>
        <label>
          С
          <DateInput name="from" defaultValue={query.from} aria-label="Период заезда: с" />
        </label>
        <label>
          По
          <DateInput
            name="to"
            rangeFromName="from"
            defaultValue={query.to}
            aria-label="Период заезда: по"
          />
        </label>
      </fieldset>
      <fieldset className="pa-channels__group">
        <legend>
          <label className="pa-channels__check">
            <input type="checkbox" name="compare" value="1" defaultChecked={query.compare} />
            Сравнить с периодом
          </label>
        </legend>
        <label>
          С
          <DateInput name="cfrom" defaultValue={query.compareFrom} aria-label="Сравнить: с" />
        </label>
        <label>
          По
          <DateInput
            name="cto"
            rangeFromName="cfrom"
            defaultValue={query.compareTo}
            aria-label="Сравнить: по"
          />
        </label>
      </fieldset>
      <label className="pa-channels__channel">
        Канал
        <Select name="channel" defaultValue={query.channel} data-testid="pa-channels-select">
          <option value="">Все</option>
          {options.map((o) => (
            <option key={o.label} value={o.label}>
              {channelLabel(o)}
            </option>
          ))}
          {query.channel && !known && <option value={query.channel}>{query.channel}</option>}
        </Select>
      </label>
      <label className="pa-channels__check">
        <input type="checkbox" name="empty" value="1" defaultChecked={query.empty} />
        Показать каналы без броней
      </label>
      {query.sort !== 'revenue' && <input type="hidden" name="sort" value={query.sort} />}
      <Button type="submit">Применить</Button>
    </form>
  );
}

/**
 * «Эффективность каналов» (ADR-141): строка на канал продаж: доход и его доля, ночи и их доля, средняя
 * стоимость ночи; «Итого» внизу. Правило счёта: «Обзора» (Q-208/Q-209): брони с заездом в периоде, без
 * отменённых и незаездов, сумма брони по ночам не делится. Имён гостей в отчёте нет.
 */
export async function ChannelsReport({ query }: { query: ChannelsQuery }) {
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
        <Filters query={query} report={null} />
        <LoadError testId="pa-channels-error" {...loadErrorProps(data)} />
      </>
    );
  const { current, previous } = data;
  const prevOf = (label: string) =>
    previous ? (previous.rows.find((r) => r.label === label) ?? null) : undefined;
  const t = current.totals;
  return (
    <>
      <Filters query={query} report={current} />
      <p className="directory-meta pa-meta" data-testid="pa-channels-meta">
        <span>
          Брони с заездом с <time dateTime={current.from}>{displayDate(current.from, 'numeric')}</time>{' '}
          по <time dateTime={current.to}>{displayDate(current.to, 'numeric')}</time>
          {previous && (
            <>
              {', '}сравнение с{' '}
              <time dateTime={previous.from}>{displayDate(previous.from, 'numeric')}</time> по{' '}
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
          Скачать CSV
        </a>
      </p>
      {current.rows.length === 0 ? (
        <EmptyState
          data-testid="pa-channels-empty"
          title="В этом периоде нет броней"
          actions={
            query.empty ? undefined : (
              <Link className="btn btn--secondary" href={channelsHref(query, { empty: true })}>
                Показать все каналы
              </Link>
            )
          }
        >
          Отчёт считает брони с заездом в выбранном периоде, без отменённых и незаездов.
        </EmptyState>
      ) : (
        <Panel title="Эффективность каналов" className="dash-panel dash-panel--table">
          <Table className="dash-table pa-channels-table" nowrap data-testid="pa-channels-table">
            <thead>
              <tr>
                <th>Канал</th>
                <SortHead query={query} sort="revenue">
                  Доход, сумма и доля
                </SortHead>
                <SortHead query={query} sort="nights">
                  Ночи, количество и доля
                </SortHead>
                <SortHead query={query} sort="adr">
                  Средняя стоимость ночи
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
                    {channelLabel(row)}
                    <span className="pa-channels__bookings">
                      {row.bookings > 0 ? `броней: ${formatInt(row.bookings)}` : 'броней нет'}
                    </span>
                  </td>
                  <Cells row={row} prev={prevOf(row.label)} />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="pa-channels-total" data-testid="pa-channels-total">
                <th scope="row">
                  Итого
                  <span className="pa-channels__bookings">броней: {formatInt(t.bookings)}</span>
                </th>
                <Cells
                  row={{
                    ...t,
                    revenueShare: query.channel ? null : t.revenueMinor === '0' ? 0 : 100,
                    nightsShare: query.channel ? null : t.nights === 0 ? 0 : 100,
                  }}
                  prev={previous ? previous.totals : undefined}
                />
              </tr>
            </tfoot>
          </Table>
        </Panel>
      )}
      <Help title="Как считается">
        Берутся брони с датой заезда в выбранном периоде, без отменённых и незаездов. Доход брони: её
        стоимость проживания целиком, по ночам она не делится. Доля: от всех каналов периода. Средняя
        стоимость ночи = доход канала / его ночи. При сравнении под числом: значение за другой период
        и изменение к нему.
      </Help>
    </>
  );
}

/** Ожидание отчёта под вкладками */
export function ChannelsSkeleton() {
  return (
    <LoadingState label="Считаем доход по каналам…" data-testid="pa-channels-loading">
      <Skeleton variant="row" />
      <Skeleton variant="row" />
      <Skeleton variant="row" />
    </LoadingState>
  );
}
