import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { Alert, Button, Field, Input, Select, StatusBadge, Table } from '../../components/ui';
import { DateInput } from '../../components/date-field';
import { AmountChip } from '../../components/amount-chip';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { formatMoney } from '../../lib/money';
import { displayDate } from '../../lib/display-date';
import { nightsBetween, pluralRu } from '../../lib/plural';
import { DatesToggle } from './dates-toggle';
import { DensityScope } from './density-toggle';
import { financeState } from './finance-state';
import { deskShell } from '../../lib/desk-shell';
import '../directory.css';
import './reservations.css';
import {
  hotelToday,
  plusDays,
  reservationDirectory,
  validDate,
  sourceNames,
  reservationStatuses,
  reservationStatusWords,
  type ReservationListRow,
} from '../../lib/hotel-api';

/** Вторая строка колонки «Финансы» (ADR-104): состояние по счетам, слова из DESIGN.md §14 */
function FinanceLine({ row }: { row: ReservationListRow }) {
  const state = financeState(row);
  switch (state.kind) {
    case 'unpaid':
      return <span className="warn-text reservations-fin">не оплачено</span>;
    case 'due':
      return (
        <AmountChip
          className="reservations-fin"
          tone="due"
          minor={state.minor}
          currency={row.currency}
        />
      );
    case 'refund-due':
      return (
        <AmountChip
          className="reservations-fin"
          tone="refund"
          label="к возврату"
          minor={state.minor}
          currency={row.currency}
        />
      );
    case 'refunded':
      return <span className="muted reservations-fin">возвращено</span>;
    case 'paid':
      return <span className="dir-paid reservations-fin">оплачено</span>;
    default:
      return <span className="muted reservations-fin">—</span>;
  }
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = normalizeSearchParams(await searchParams);
  // Сегодня по часам объекта (С-13): одно на страницу — и для периода, и для готовых отрезков
  const today = await hotelToday();
  const from = sp.from || sp.date || today,
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
  // Готовые отрезки — обычные вопросы стойки одним щелчком (owner 21.09); ручной период
  // раскрывается кнопкой «Даты» (ADR-104 по ТЗ «Брони v2» §62: «С/По» не занимают место при пресете)
  const periodPresets: [string, { from: string; to: string }][] = [
    ['Сегодня', { from: today, to: today }],
    ['Завтра', { from: plusDays(today, 1), to: plusDays(today, 1) }],
    ['7 дней', { from: today, to: plusDays(today, 6) }],
    ['30 дней', { from: today, to: plusDays(today, 29) }],
  ];
  const isPreset = periodPresets.some(([, p]) => p.from === from && p.to === to);
  // Числа на чипах: видно, сколько предварительных и проживающих, до нажатия. Ряд не
  // перестраивается от периода к периоду — статус с нулём остаётся на месте и приглушён,
  // «Отменены 0» — это тоже ответ, за которым не надо никуда нажимать.
  const counts = result?.counts ?? null;
  const filtersOn = from !== today || to !== today || status !== 'ALL' || q !== '';
  const pageOutOfRange = (result?.total ?? 0) > 0 && result?.rows.length === 0;
  const statusText = status !== 'ALL' ? `, статус «${reservationStatuses[status]}»` : '';
  const queryText = q ? `, по запросу «${q}»` : '';
  // «Только чтение» (ADR-102): запись держит API, полосу — оболочка; страница лишь не показывает
  // «Новую бронь» — действие, которого нельзя, не рисуется вовсе (приём ИИ-продавца, DESIGN.md §8)
  const { readOnly } = await deskShell();
  return (
    <Page
      title="Брони"
      width="full"
      actions={
        readOnly ? undefined : (
          <Link href="/reservations/new" className="btn">
            <Icon name="plus" />
            Новая бронь
          </Link>
        )
      }
    >
      <section className="reservations-controls" aria-label="Фильтры броней">
        <form className="reservations-toolbar" method="get">
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
          <nav className="directory-filters reservations-presets" aria-label="Готовые периоды">
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
          <DatesToggle defaultOpen={!isPreset}>
            <Field inline label="С">
              <DateInput key={`from-${from}`} name="from" defaultValue={from} aria-label="Период: с" />
            </Field>
            <Field inline label="По">
              <DateInput
                key={`to-${to}`}
                name="to"
                rangeFromName="from"
                defaultValue={to}
                aria-label="Период: по"
              />
            </Field>
          </DatesToggle>
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
        <nav className="directory-filters reservations-statuses" aria-label="Статусы броней">
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
          <DensityScope
            showControl={result.rows.length > 0}
            meta={
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
            }
          >
            {/* Иерархия строки (ADR-104): кто и какая бронь → когда → где → откуда → деньги → статус */}
            {result.rows.length > 0 && (
              <Table
                aria-label="Бронирования"
                data-testid="reservations-table"
                className="dir-table dir-table--reservations"
                nowrap
              >
                <thead>
                  <tr>
                    <th>Бронь / гость</th>
                    <th>Проживание</th>
                    <th>Размещение</th>
                    <th>Источник</th>
                    <th className="num">Финансы</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => {
                    const nights = nightsBetween(r.arrivalDate, r.departureDate);
                    const itemsCount = r.itemsCount ?? (r.unitCodes.length || 1);
                    const unassigned = r.unitCodes.length < itemsCount;
                    // Вычисляемые пометки дня (§12 ТЗ): не статус в модели, а взгляд стойки на дату
                    const arrivesToday =
                      r.arrivalDate === today && (r.status === 'CONFIRMED' || r.status === 'TENTATIVE');
                    const departsToday = r.departureDate === today && r.status === 'CHECKED_IN';
                    return (
                      <tr key={r.confirmationNumber}>
                        <td>
                          {/* Одна ссылка на всю ячейку: два мелких якоря впритык не проходят по размеру цели (axe target-size) */}
                          <Link
                            className="dir-guest"
                            prefetch={false}
                            href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`}
                            aria-label={`Открыть бронь ${r.confirmationNumber}`}
                          >
                            <strong>{r.primaryGuest?.label || 'Гость без имени'}</strong>
                            <span className="dir-number">{r.confirmationNumber}</span>
                          </Link>
                        </td>
                        <td className="dir-stay">
                          <span className="reservations-stay-dates">
                            <time dateTime={r.arrivalDate}>{displayDate(r.arrivalDate)}</time>
                            {' → '}
                            <time dateTime={r.departureDate}>{displayDate(r.departureDate)}</time>
                          </span>
                          {nights > 0 && (
                            <small>{pluralRu(nights, ['ночь', 'ночи', 'ночей'])}</small>
                          )}
                          {arrivesToday && <small className="reservations-flag">заезд сегодня</small>}
                          {departsToday && <small className="reservations-flag">выезд сегодня</small>}
                        </td>
                        <td>
                          {itemsCount > 1 ? (
                            <span className="dir-unit">
                              <Icon name="bed" />
                              {pluralRu(itemsCount, ['размещение', 'размещения', 'размещений'])}
                            </span>
                          ) : r.unitCodes.length ? (
                            <span className="dir-unit">
                              <Icon name="bed" />
                              {r.unitCodes.join(', ')}
                            </span>
                          ) : null}
                          {/* у группы предупреждение называет число: «3 размещения» + «⚠ 1 без ячейки» */}
                          {unassigned && (
                            <span className="warn-text reservations-unassigned">
                              {itemsCount > 1
                                ? `⚠ ${itemsCount - r.unitCodes.length} без ячейки`
                                : '⚠ без ячейки'}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="source-tag">
                            {r.channel || sourceNames[r.source] || r.source}
                          </span>
                        </td>
                        <td className="num nowrap">
                          <span className="reservations-total">
                            {formatMoney(r.totalAmountMinor, r.currency)}
                          </span>
                          <FinanceLine row={r} />
                        </td>
                        <td>
                          <StatusBadge
                            status={r.status}
                            label={reservationStatusWords[r.status] || r.status}
                          />
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
                  <Link
                    className="btn btn--secondary"
                    href={href({ page: String(result.page - 1) })}
                  >
                    Назад
                  </Link>
                )}
                <span>
                  Страница {result.page} из{' '}
                  {Math.max(1, Math.ceil(result.total / result.pageSize))}
                </span>
                {result.page * result.pageSize < result.total && (
                  <Link
                    className="btn btn--secondary"
                    href={href({ page: String(result.page + 1) })}
                  >
                    Далее
                  </Link>
                )}
              </nav>
            )}
          </DensityScope>
        </section>
      )}
    </Page>
  );
}
