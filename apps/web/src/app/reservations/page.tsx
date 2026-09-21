import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { Alert, Button, Field, Input, Select, StatusBadge, Table } from '../../components/ui';
import { AmountChip } from '../../components/amount-chip';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { messengerLinks } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { displayDate } from '../../lib/display-date';
import { nightsBetween, pluralRu } from '../../lib/plural';
import '../directory.css';
import './reservations.css';
import {
  hotelToday,
  plusDays,
  reservationDirectory,
  validDate,
  sourceNames,
  reservationStatuses,
} from '../../lib/hotel-api';
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = normalizeSearchParams(await searchParams);
  const from = sp.from || sp.date || hotelToday(),
    to = sp.to || from,
    status = sp.status || 'ALL',
    q = sp.q || '';
  const page = sp.page || '1';
  const valid =
    validDate(from) &&
    validDate(to) &&
    from <= to &&
    Date.parse(to) - Date.parse(from) <= 365 * 86400000;
  const error = !valid
    ? 'Выберите корректный период до 366 дней.'
    : !Object.hasOwn(reservationStatuses, status)
      ? 'Неизвестный статус брони.'
      : !/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 10000
        ? 'Номер страницы должен быть от 1 до 10000.'
        : q.length > 120
          ? 'Поиск: не более 120 символов.'
          : null;
  // Отказ API не выглядит как ноль броней (B5): список ловит его сам, заголовок и фильтры остаются
  const loaded = !error
    ? await reservationDirectory({ from, to, status, q, page }).then(
        (r) => ({ ok: true as const, r }),
        (e: unknown) => ({ ok: false as const, e }),
      )
    : null;
  const result = loaded?.ok ? loaded.r : null;
  const loadError = loaded && !loaded.ok ? loaded.e : null;
  const href = (values: Record<string, string>) =>
    `/reservations?${new URLSearchParams({ from, to, status, q, ...values })}`;
  // Выборка названа словами (B1): один день — одна дата, статус и запрос — только когда заданы
  // отрезок — «→», как в строках ниже (§14); через год — обе даты с годом
  const withYear = from.slice(0, 4) !== to.slice(0, 4);
  const periodText =
    from === to
      ? displayDate(from)
      : `${displayDate(from, withYear ? 'numeric' : 'short')} → ${displayDate(to, withYear ? 'numeric' : 'short')}`;
  // Готовые отрезки, как в «Деньгах за период»: обычные вопросы стойки — один щелчок вместо
  // двух календарей (owner 21.09). Поиск и статус сохраняются, страница сбрасывается на первую.
  const today = hotelToday();
  const periodPresets: [string, { from: string; to: string }][] = [
    ['Сегодня', { from: today, to: today }],
    ['Завтра', { from: plusDays(today, 1), to: plusDays(today, 1) }],
    ['7 дней', { from: today, to: plusDays(today, 6) }],
    ['30 дней', { from: today, to: plusDays(today, 29) }],
  ];
  // Числа на чипах: видно, сколько предварительных и проживающих, до нажатия. Ряд не
  // перестраивается от периода к периоду — статус с нулём остаётся на месте и приглушён,
  // «Отменены 0» — это тоже ответ, за которым не надо никуда нажимать.
  const counts = result?.counts ?? null;
  const filtersOn = from !== today || to !== today || status !== 'ALL' || q !== '';
  const pageOutOfRange = (result?.total ?? 0) > 0 && result?.rows.length === 0;
  const statusText = status !== 'ALL' ? `, статус «${reservationStatuses[status]}»` : '';
  const queryText = q ? `, по запросу «${q}»` : '';
  return (
    <Page
      title="Брони"
      width="full"
      actions={
        <Link href="/reservations/new" className="btn">
          <Icon name="plus" />
          Новая бронь
        </Link>
      }
    >
      <section className="reservations-controls" aria-label="Фильтры броней">
        <form className="directory-toolbar" method="get">
          <div className="search-field">
            <Icon name="search" />
            <Input
              name="q"
              // key: при переходе по ссылке «Убрать поиск» React переиспользует поле, и defaultValue не
              // обновился бы — поле показывало бы прежний запрос (CI 20.09)
              key={`q-${q}`}
              defaultValue={q}
              placeholder="Гость, телефон или номер брони"
              aria-label="Поиск броней"
            />
          </div>
          <Field inline label="С">
            <Input
              key={`from-${from}`}
              type="date"
              name="from"
              defaultValue={from}
              aria-label="Период: с"
            />
          </Field>
          <Field inline label="По">
            <Input
              key={`to-${to}`}
              type="date"
              name="to"
              defaultValue={to}
              aria-label="Период: по"
            />
          </Field>
          <Field label="Статус" className="reservations-status-mobile">
            <Select
              name="status"
              key={`status-${status}`}
              defaultValue={status}
              aria-label="Статус брони"
            >
              {Object.entries(reservationStatuses).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Button tone="secondary">Показать</Button>
        </form>
        <div className="reservations-quick">
          <nav className="directory-filters" aria-label="Готовые периоды">
            <span className="reservations-quick__word">Период</span>
            {periodPresets.map(([label, p]) => (
              <Link
                key={label}
                href={href({ from: p.from, to: p.to, page: '1' })}
                className={p.from === from && p.to === to ? 'is-active' : ''}
                aria-current={p.from === from && p.to === to ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <nav className="directory-filters reservations-statuses" aria-label="Статусы броней">
            <span className="reservations-quick__word">Статус</span>
            {Object.entries(reservationStatuses).map(([id, label]) => {
              const count = counts ? (counts[id] ?? 0) : null;
              return (
                <Link
                  key={id}
                  href={href({ status: id, page: '1' })}
                  className={
                    status === id ? 'is-active' : count === 0 ? 'reservations-chip--zero' : ''
                  }
                  aria-current={status === id ? 'page' : undefined}
                >
                  {label}
                  {count !== null && <span className="reservations-count">{count}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </section>
      {error && (
        <Alert boxed>
          {error} <Link href="/reservations">Сбросить фильтры</Link>
        </Alert>
      )}
      {loadError !== null && (
        <LoadError testId="reservations-error" {...loadErrorProps(loadError)} />
      )}
      {result && (
        <section className="reservations-results" aria-label="Список бронирований">
          <p className="directory-meta" data-testid="directory-meta">
            {pluralRu(result.total, ['бронирование', 'бронирования', 'бронирований'])} на{' '}
            {periodText}
            {statusText}
            {queryText}
            {filtersOn && (
              <>
                {' '}
                <Link href="/reservations" className="reservations-reset">
                  Сбросить фильтры
                </Link>
              </>
            )}
          </p>
          {/* Строка в одну линию: гость и номер, откуда, где живёт, когда, статус, деньги, которыми занимается стойка */}
          {result.rows.length > 0 && (
            <Table
              aria-label="Бронирования"
              data-testid="reservations-table"
              className="dir-table dir-table--reservations"
              nowrap
            >
              <thead>
                <tr>
                  <th>Гость</th>
                  <th>Источник</th>
                  <th>Место</th>
                  <th>Проживание</th>
                  <th>Статус</th>
                  <th className="num">Стоимость</th>
                  <th className="num">К оплате</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => {
                  const nights = nightsBetween(r.arrivalDate, r.departureDate);
                  const debt = r.hasFolios && BigInt(r.balanceMinor) > 0n;
                  const wa = messengerLinks(r.primaryGuest?.phone ?? null);
                  return (
                    <tr key={r.confirmationNumber}>
                      <td>
                        {/* Одна ссылка на всю ячейку: два мелких якоря впритык не проходят по размеру цели (axe target-size) */}
                        <div className="dir-guest-cell">
                          <Link
                            className="dir-guest"
                            prefetch={false}
                            href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`}
                            aria-label={`Открыть бронь ${r.confirmationNumber}`}
                          >
                            <strong>{r.primaryGuest?.label || 'Гость без имени'}</strong>
                            <span className="dir-number">{r.confirmationNumber}</span>
                          </Link>
                          {wa && (
                            <a
                              className="dir-wa"
                              href={wa.whatsapp}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`WhatsApp: ${r.primaryGuest?.label ?? ''}`}
                            >
                              WA
                            </a>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="source-tag">
                          {r.channel || sourceNames[r.source] || r.source}
                        </span>
                      </td>
                      <td>
                        {r.unitCodes.length ? (
                          <span className="dir-unit">
                            <Icon name="bed" />
                            {r.unitCodes.join(', ')}
                          </span>
                        ) : (
                          <span className="warn-text">не назначено</span>
                        )}
                      </td>
                      <td className="dir-stay">
                        <span className="reservations-stay-dates">
                          <time dateTime={r.arrivalDate}>{displayDate(r.arrivalDate)}</time>
                          {' → '}
                          <time dateTime={r.departureDate}>{displayDate(r.departureDate)}</time>
                        </span>
                        {nights > 0 && <small>{pluralRu(nights, ['ночь', 'ночи', 'ночей'])}</small>}
                      </td>
                      <td>
                        <StatusBadge
                          status={r.status}
                          label={reservationStatuses[r.status] || r.status}
                        />
                      </td>
                      <td className="num nowrap">
                        <span className="dir-cell-word">стоимость </span>
                        {formatMoney(r.totalAmountMinor, r.currency)}
                      </td>
                      <td className="num nowrap">
                        {!r.hasFolios ? (
                          <span className="muted">—</span>
                        ) : debt ? (
                          <AmountChip tone="due" minor={r.balanceMinor} currency={r.currency} />
                        ) : (
                          <span className="dir-paid">оплачено</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          {!result.rows.length && (
            <div className="empty-state" data-testid="reservations-empty">
              <Icon name="booking" />
              <h3>Бронирований не найдено</h3>
              {pageOutOfRange ? (
                <p>
                  На этой странице бронирований нет: страниц меньше, чем номер в адресе.{' '}
                  <Link href={href({ page: '1' })}>К первой странице</Link>
                </p>
              ) : (
                <p>
                  На {periodText}
                  {statusText}
                  {queryText} бронирований нет. Уберите условие или выберите другой день.
                </p>
              )}
              <div className="empty-state__actions">
                {q && (
                  <Link href={href({ q: '', page: '1' })} className="btn btn--secondary">
                    Убрать поиск
                  </Link>
                )}
                {status !== 'ALL' && (
                  <Link href={href({ status: 'ALL', page: '1' })} className="btn btn--secondary">
                    Все статусы
                  </Link>
                )}
                <Link href="/reservations" className="btn btn--secondary">
                  Сбросить фильтры
                </Link>
              </div>
            </div>
          )}
          {result.total > result.pageSize && (
            <nav className="pagination" aria-label="Страницы броней">
              {result.page > 1 && (
                <Link className="btn btn--secondary" href={href({ page: String(result.page - 1) })}>
                  Назад
                </Link>
              )}
              <span>
                Страница {result.page} из {Math.max(1, Math.ceil(result.total / result.pageSize))}
              </span>
              {result.page * result.pageSize < result.total && (
                <Link className="btn btn--secondary" href={href({ page: String(result.page + 1) })}>
                  Далее
                </Link>
              )}
            </nav>
          )}
        </section>
      )}
    </Page>
  );
}
