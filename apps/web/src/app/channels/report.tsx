import Link from 'next/link';
import {
  hotelApi,
  hotelToday,
  reservationStatuses,
  sourceNames,
  validDate,
} from '../../lib/hotel-api';
import { formatMoney } from '../../lib/money';
import { displayDate } from '../../lib/display-date';
import { nightsBetween } from '../../lib/plural';
import { countLabel, intlLocale, msg } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Help,
  SectionTitle,
  Select,
  Table,
} from '../../components/ui';
import { DateInput } from '../../components/date-field';
import { Icon } from '../../components/icon';
import { unstable_rethrow } from 'next/navigation';
import { ChannelTotals } from './channel-totals';

/**
 * Отчёт по источникам броней за период по дате заезда — бывший экран «Менеджер каналов»
 * (D4, план владельца 19.09; сводка одним рядом — 21.09). С 27.09 (ADR-112) живёт на «Обзоре»
 * модуля «Каналы продаж»: расчёт на сервере, форма и подписи не менялись, только адрес формы.
 */
export async function ChannelReport({ sp }: { sp: Record<string, string | undefined> }) {
  const today = await hotelToday();
  const t = await serverT();
  const locale = await currentLocale();
  const il = intlLocale(locale);
  const from = sp.from ?? `${today.slice(0, 7)}-01`;
  const to = sp.to ?? today;
  const status = sp.status ?? 'ALL';
  const valid =
    validDate(from) &&
    validDate(to) &&
    from <= to &&
    (Date.parse(to) - Date.parse(from)) / 86400000 <= 365 &&
    Object.hasOwn(reservationStatuses, status);
  const loaded = valid
    ? await hotelApi.channelReport(from, to, status).then(
        (r) => ({ ok: true as const, r }),
        (e: unknown) => {
          unstable_rethrow(e);
          return { ok: false as const, e };
        },
      )
    : null;
  const report = loaded?.ok ? loaded.r : null;
  const loadError: unknown = loaded && !loaded.ok ? loaded.e : null;
  const withYear = from.slice(0, 4) !== to.slice(0, 4);
  const periodText = valid
    ? from === to
      ? displayDate(from, 'numeric', il)
      : `${displayDate(from, withYear ? 'numeric' : 'short', il)} → ${displayDate(to, withYear ? 'numeric' : 'short', il)}`
    : '';
  const totals = report?.rows.reduce(
    (r, row) => ({
      count: r.count + row.count,
      cancelled: r.cancelled + row.cancelled,
      noShow: r.noShow + row.noShow,
    }),
    { count: 0, cancelled: 0, noShow: 0 },
  );
  const money = new Map<string, bigint>();
  for (const row of report?.rows ?? [])
    money.set(row.currency, (money.get(row.currency) ?? 0n) + BigInt(row.amountMinor));
  return (
    <section className="stack stack--sm channels-report" aria-labelledby="channel-report-title">
      <SectionTitle id="channel-report-title">{t('Брони по источникам')}</SectionTitle>
      {valid && (
        <p className="note" data-testid="channel-period">
          {t('Брони с заездом {period}, {days}, {status}', {
            period: periodText,
            days: countLabel(locale, t, nightsBetween(from, to) + 1, [msg('день'), msg('дня'), msg('дней')]),
            // reservationStatuses из lib/hotel-api: постоянные русские подписи, переводятся при показе
            status: t(reservationStatuses[status]!).toLowerCase(),
          })}
        </p>
      )}
      <form
        method="get"
        action="/channels"
        className="row filter-bar channels-period"
        data-testid="channel-period-form"
      >
        <Field label={t('Заезд с')}>
          <DateInput name="from" defaultValue={from} required />
        </Field>
        <Field label={t('Заезд по')}>
          <DateInput name="to" rangeFromName="from" defaultValue={to} required />
        </Field>
        <Field label={t('Статус брони')}>
          <Select name="status" defaultValue={status}>
            {Object.entries(reservationStatuses).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit">{t('Показать')}</Button>
      </form>
      {!valid && (
        <Alert boxed>{t('Выберите корректные даты, период до 366 дней и статус из списка.')}</Alert>
      )}
      {loadError !== null && (
        <LoadError testId="channel-report-error" {...loadErrorProps(loadError)} />
      )}
      {report && totals && (
        <>
          <ChannelTotals
            count={totals.count}
            cancelled={totals.cancelled}
            noShow={totals.noShow}
            money={money}
            t={t}
          />
          {report.rows.length > 0 && (
            <Table className="dir-table dir-table--channel-report" data-testid="channel-report">
              <thead>
                <tr>
                  <th>{t('Источник')}</th>
                  <th className="num">{t('Брони')}</th>
                  <th className="num">{t('Отмены')}</th>
                  <th className="num">{t('Незаезды')}</th>
                  <th className="num">{t('Стоимость броней')}</th>
                  <th>{t('Доля броней')}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={JSON.stringify([row.source, row.channel, row.currency])}>
                    <td>
                      {/* Канал различается названием: кружок с первой буквой — тот же аватар, от которого
                        справочники отказались 15.09, а логотипы каналов мы не вставляем (§7) */}
                      <strong>{row.channel ?? (sourceNames[row.source] ? t(sourceNames[row.source]!) : row.source)}</strong>
                      <div className="cell-sub">
                        {sourceNames[row.source] ? t(sourceNames[row.source]!) : row.source}, {row.currency}
                      </div>
                    </td>
                    <td className="num">
                      <strong>{row.count}</strong>
                    </td>
                    <td className="num">{row.cancelled}</td>
                    <td className="num">{row.noShow}</td>
                    <td className="num">{formatMoney(row.amountMinor, row.currency)}</td>
                    <td>
                      <div className="occupancy-meter">
                        <meter
                          min="0"
                          max={totals.count || 1}
                          value={row.count}
                          aria-label={t('Доля: {count} из {total} броней', { count: row.count, total: totals.count })}
                        />
                        <span>
                          {totals.count ? Math.round((row.count / totals.count) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {!report.rows.length && (
            <EmptyState
              icon={<Icon name="channels" />}
              title={
                status !== 'ALL'
                  ? t('Нет бронирований с заездом {period} со статусом «{status}»', {
                      period: periodText,
                      status: t(reservationStatuses[status]!),
                    })
                  : t('Нет бронирований с заездом {period}', { period: periodText })
              }
              data-testid="channel-report-empty"
              actions={
                status !== 'ALL' ? (
                  <Link
                    href={`/channels?from=${from}&to=${to}&status=ALL`}
                    className="btn btn--secondary"
                  >
                    {t('Показать все статусы')}
                  </Link>
                ) : undefined
              }
            >
              {t('Расширьте период: источники появляются по сохранённым броням.')}
            </EmptyState>
          )}
          <Help title={t('Как считаются показатели')}>
            {t('Стоимость броней включает отмены и незаезды при выборе всех статусов.')}
            <Link href={`/finance?from=${from}&to=${to}`}>
              {' '}
              {t('Фактические оплаты за период: в финансах.')}
            </Link>{' '}
            {t('Одна коммерческая бронь считается один раз, даже если в ней несколько мест. Источники появляются по сохранённым броням: наличие строки Booking.com или Trip.com не означает, что канал сейчас подключён. Валюты считаются отдельно.')}
          </Help>
        </>
      )}
    </section>
  );
}
