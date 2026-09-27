import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import Link from 'next/link';
import {
  hotelApi,
  hotelToday,
  reservationStatuses,
  sourceNames,
  validDate,
} from '../../../lib/hotel-api';
import { formatMoney } from '../../../lib/money';
import { displayDate } from '../../../lib/display-date';
import { nightsBetween, pluralRu } from '../../../lib/plural';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Help,
  Select,
  Stat,
  Stats,
  Table,
} from '../../../components/ui';
import { DateInput } from '../../../components/date-field';
import { Icon } from '../../../components/icon';
import '../../directory.css';

/**
 * Отчёт по источникам продаж за период по дате заезда. До 27.09.2026 жил на `/channel-manager`;
 * перенесён сюда как есть (CH1, ADR-107, `plans/tz-channels-2026-09-27.md` §11) — «Менеджер каналов»
 * стал обзором состояния интеграции, а аналитика источников получила свой раздел. D4 (план владельца
 * 19.09): период назван словами, отказ API не уносит экран — форма и подпись остаются, вместо чисел
 * `LoadError`; пустой отчёт называет условие; на телефоне строки складываются в карточки. Расчёт на
 * сервере не менялся; «Отказы» появятся только после ответа Q-154.
 */
export default async function SalesSourcesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = normalizeSearchParams(await searchParams);
  const today = await hotelToday();
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
    ? `Брони с заездом ${periodText}, ${pluralRu(nightsBetween(from, to) + 1, ['день', 'дня', 'дней'])}, ${reservationStatuses[status]!.toLowerCase()}`
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
      title="Источники продаж"
      subtitle={subtitle ? <span data-testid="channel-period">{subtitle}</span> : undefined}
      actions={
        <Link href="/channel-manager" className="btn btn--secondary">
          Каналы продаж
        </Link>
      }
    >
      <form method="get" className="row toolbar" data-testid="channel-period-form">
        <Field label="Заезд с">
          <DateInput name="from" defaultValue={from} required />
        </Field>
        <Field label="Заезд по">
          <DateInput name="to" rangeFromName="from" defaultValue={to} required />
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
          {/*
           * 21.09: четвёртой плиткой стояло «Источников продаж», повторявшее число строк таблицы, а
           * стоимость занимала отдельную панель на 230 px ради одного числа — до таблицы оставалось
           * 690 px экрана. Стоимость встала в тот же ряд, пояснение и ссылка — подписью под ней.
           */}
          <Stats min={200}>
            <Stat label="Бронирований" value={totals.count} testId="channel-bookings" />
            <Stat label="Отмен" value={totals.cancelled} />
            <Stat label="Незаездов" value={totals.noShow} />
            <Stat
              label="Стоимость броней"
              testId="channel-amount"
              value={
                money.size ? (
                  <span className="channel-amount">
                    {[...money].map(([currency, value]) => (
                      <span key={currency}>{formatMoney(value.toString(), currency)}</span>
                    ))}
                  </span>
                ) : (
                  '—'
                )
              }
              hint={
                <>
                  {status === 'ALL' && money.size ? 'включая отмены и незаезды. ' : ''}
                  <Link href={`/finance?from=${from}&to=${to}`}>Фактические оплаты за период</Link>
                </>
              }
            />
          </Stats>
          {report.rows.length > 0 && (
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
                      {/* Канал различается названием: кружок с первой буквой — тот же аватар, от которого
                        справочники отказались 15.09, а логотипы каналов мы не вставляем (§7) */}
                      <strong>{row.channel ?? sourceNames[row.source] ?? row.source}</strong>
                      <div className="cell-sub">
                        {sourceNames[row.source] ?? row.source}, {row.currency}
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
              </tbody>
            </Table>
          )}
          {!report.rows.length && (
            <EmptyState
              icon={<Icon name="channels" />}
              title={`Нет бронирований с заездом ${periodText}${status !== 'ALL' ? ` со статусом «${reservationStatuses[status]}»` : ''}`}
              data-testid="channel-report-empty"
              actions={
                status !== 'ALL' ? (
                  <Link
                    href={`/analytics/sources?from=${from}&to=${to}&status=ALL`}
                    className="btn btn--secondary"
                  >
                    Показать все статусы
                  </Link>
                ) : undefined
              }
            >
              Расширьте период: источники появляются по сохранённым броням.
            </EmptyState>
          )}
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
