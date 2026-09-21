import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
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
import { nightsBetween, pluralRu } from '../../lib/plural';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import {
  Alert,
  Button,
  Field,
  Input,
  Help,
  Panel,
  Select,
  Stat,
  Stats,
  Table,
} from '../../components/ui';
import '../directory.css';

/**
 * Отчёт по каналам продаж за период по дате заезда. D4 (план владельца 19.09): период назван словами,
 * отказ API не уносит экран — форма и подпись остаются, вместо чисел `LoadError`; пустой отчёт называет
 * условие; на телефоне строки складываются в карточки. Расчёт на сервере не менялся.
 */
export default async function ChannelManagerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = normalizeSearchParams(await searchParams);
  const today = hotelToday();
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
        (e: unknown) => ({ ok: false as const, e }),
      )
    : null;
  const report = loaded?.ok ? loaded.r : null;
  const loadError: unknown = loaded && !loaded.ok ? loaded.e : null;
  const withYear = from.slice(0, 4) !== to.slice(0, 4);
  const periodText = valid
    ? from === to
      ? displayDate(from, 'numeric')
      : `${displayDate(from, withYear ? 'numeric' : 'short')} → ${displayDate(to, withYear ? 'numeric' : 'short')}`
    : '';
  const subtitle = valid
    ? `Брони по дате заезда: ${periodText}, ${pluralRu(nightsBetween(from, to) + 1, ['день', 'дня', 'дней'])}, ${reservationStatuses[status]!.toLowerCase()}`
    : undefined;
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
    <Page
      title="Менеджер каналов"
      subtitle={subtitle}
      actions={
        <Link href="/channels" className="btn btn--secondary">
          Настроить синхронизацию
        </Link>
      }
    >
      <form method="get" className="row toolbar" data-testid="channel-period-form">
        <Field label="Заезд с">
          <Input type="date" name="from" defaultValue={from} required />
        </Field>
        <Field label="Заезд по">
          <Input type="date" name="to" defaultValue={to} required />
        </Field>
        <Field label="Статус брони">
          <Select name="status" defaultValue={status}>
            {Object.entries(reservationStatuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit">Показать</Button>
      </form>
      {!valid && (
        <Alert boxed>Выберите корректные даты, период до 366 дней и статус из списка.</Alert>
      )}
      {loadError !== null && (
        <LoadError testId="channel-report-error" {...loadErrorProps(loadError)} />
      )}
      {report && totals && (
        <>
          <Stats>
            <Stat label="Бронирований" value={totals.count} testId="channel-bookings" />
            <Stat label="Отмен" value={totals.cancelled} />
            <Stat label="Незаездов" value={totals.noShow} />
            <Stat
              label="Источников продаж"
              value={new Set(report.rows.map((r) => JSON.stringify([r.source, r.channel]))).size}
            />
          </Stats>
          <Panel className="channel-value-panel" title="Стоимость выбранных броней">
            <div className="channel-totals">
              {[...money].map(([currency, value]) => (
                <strong key={currency}>{formatMoney(value.toString(), currency)}</strong>
              ))}
              {!money.size && <span className="muted">За этот период бронирований нет</span>}
            </div>
            {status === 'ALL' && <p className="note">Включая отмены и незаезды</p>}
            <Link href={`/finance?from=${from}&to=${to}`}>Фактические оплаты за период</Link>
          </Panel>
          <Table className="dir-table dir-table--channel-report" data-testid="channel-report">
            <thead>
              <tr>
                <th>Источник</th>
                <th className="num">Брони</th>
                <th className="num">Отмены</th>
                <th className="num">Незаезды</th>
                <th className="num">Стоимость броней</th>
                <th>Доля броней</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={JSON.stringify([row.source, row.channel, row.currency])}>
                  <td>
                    <div className="channel-name">
                      <span
                        className={`channel-monogram ${row.source === 'OTA' ? 'channel-monogram--ota' : ''}`}
                      >
                        {(row.channel ?? sourceNames[row.source] ?? row.source).slice(0, 1)}
                      </span>
                      <div>
                        <strong>{row.channel ?? sourceNames[row.source] ?? row.source}</strong>
                        <div className="cell-sub">
                          {sourceNames[row.source] ?? row.source}, {row.currency}
                        </div>
                      </div>
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
                        aria-label={`Доля: ${row.count} из ${totals.count} броней`}
                      />
                      <span>
                        {totals.count ? Math.round((row.count / totals.count) * 100) : 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {!report.rows.length && (
                <tr>
                  <td colSpan={6} className="empty-state" data-testid="channel-report-empty">
                    Нет бронирований с заездом {periodText}
                    {status !== 'ALL' && ` со статусом «${reservationStatuses[status]}»`}.{' '}
                    {status !== 'ALL' ? (
                      <Link href={`/channel-manager?from=${from}&to=${to}&status=ALL`}>
                        Показать все статусы
                      </Link>
                    ) : (
                      'Расширьте период: источники появляются по сохранённым броням.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
          <Help title="Как считаются показатели">
            Одна коммерческая бронь считается один раз, даже если в ней несколько мест. Источники
            появляются по сохранённым броням: наличие строки Booking.com или Trip.com не означает,
            что канал сейчас подключён. Валюты считаются отдельно.
          </Help>
        </>
      )}
    </Page>
  );
}
