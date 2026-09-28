import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { redirect } from 'next/navigation';
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
import { FiltersToggle } from './filters-toggle';
import { financeState } from './finance-state';
import { deskShell } from '../../lib/desk-shell';
import { inventoryEditorApi } from '../../lib/api';
import {
  allocationFilters,
  apiQuery,
  cleanHref,
  dateBases,
  filtersHref,
  needsCleanup,
  paymentFilters,
  readFilters,
  reservationViews,
  sortOptions,
  sourceLabel,
} from './filters';
import { CHANNELS } from './sources';
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

/** Вторая строка колонки «Финансы» (ADR-106): состояние по счетам, слова из DESIGN.md §14 */
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
  // Форма шлёт и пустые поля, и умолчания: адрес после «Показать» чистится одним переходом (R2, ADR-106)
  if (needsCleanup(sp)) redirect(cleanHref(sp));
  // Сегодня по часам объекта (С-13): одно на страницу — и для периода, и для готовых отрезков
  const today = await hotelToday();
  // Отбор целиком в адресе (срез R2): сахар Главной `?arrival=today` читается здесь, фильтрует API
  const f = readFilters(sp, today);
  const { from, to, status, q, page } = f;
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
          : !Object.hasOwn(reservationViews, f.view) ||
              !Object.hasOwn(dateBases, f.date) ||
              !Object.hasOwn(paymentFilters, f.payment) ||
              !Object.hasOwn(allocationFilters, f.allocation) ||
              !Object.hasOwn(sortOptions, f.sort) ||
              f.source.length > 64 ||
              f.category.length > 64
            ? 'Неизвестное условие отбора.'
            : null;
  // Отказ API не выглядит как ноль броней (B5): список ловит его сам, заголовок и фильтры остаются
  // Категории — для списка «Категория» и слов в строке выборки; сбой справочника список не ломает
  const [loaded, categories] = await Promise.all([
    !error
      ? reservationDirectory(apiQuery(f)).then(
          (r) => ({ ok: true as const, r }),
          (e: unknown) => ({ ok: false as const, e }),
        )
      : null,
    inventoryEditorApi.categories().catch(() => []),
  ]);
  const result = loaded?.ok ? loaded.r : null;
  const loadError = loaded && !loaded.ok ? loaded.e : null;
  const href = (values: Partial<typeof f>) => filtersHref(f, values);
  // Выборка названа словами (B1): один день — одна дата, статус и запрос — только когда заданы
  // отрезок — «→», как в строках ниже (§14); через год — обе даты с годом
  const withYear = from.slice(0, 4) !== to.slice(0, 4);
  const periodText =
    from === to
      ? displayDate(from)
      : `${displayDate(from, withYear ? 'numeric' : 'short')} → ${displayDate(to, withYear ? 'numeric' : 'short')}`;
  // Готовые отрезки — обычные вопросы стойки одним щелчком (owner 21.09); ручной период
  // раскрывается кнопкой «Даты» (ADR-106 по ТЗ «Брони v2» §62: «С/По» не занимают место при пресете)
  const periodPresets: [string, { from: string; to: string }][] = [
    ['Сегодня', { from: today, to: today }],
    ['Завтра', { from: plusDays(today, 1), to: plusDays(today, 1) }],
    ['7 дней', { from: today, to: plusDays(today, 6) }],
    ['30 дней', { from: today, to: plusDays(today, 29) }],
  ];
  const isPreset = periodPresets.some(([, p]) => p.from === from && p.to === to);
  // Виды «Будущие», «Проживают», «Требуют внимания» периода не знают (API их отбирает по фактам);
  // «Сегодня» держит день объекта — ручной период и «Дата относится к» есть только у вида «Все»
  const periodView = f.view === 'all';
  // Числа на чипах: видно, сколько предварительных и проживающих, до нажатия. Ряд не
  // перестраивается от периода к периоду — статус с нулём остаётся на месте и приглушён,
  // «Отменены 0» — это тоже ответ, за которым не надо никуда нажимать.
  const counts = result?.counts ?? null;
  const narrowed = Boolean(f.source || f.payment || f.allocation || f.category);
  const filtersOn =
    from !== today ||
    to !== today ||
    status !== 'ALL' ||
    q !== '' ||
    f.view !== 'all' ||
    f.date !== 'stay' ||
    f.sort !== '' ||
    narrowed;
  const pageOutOfRange = (result?.total ?? 0) > 0 && result?.rows.length === 0;
  // Выборка словами (B1): вид или период с основой даты, затем условия — как их назвала форма
  const scopeText =
    f.view === 'future' || f.view === 'inhouse' || f.view === 'attention'
      ? ` в виде «${reservationViews[f.view]}»`
      : f.date === 'arrival'
        ? ` с заездом ${periodText}`
        : f.date === 'departure'
          ? ` с выездом ${periodText}`
          : f.date === 'created'
            ? `, созданных ${periodText}`
            : ` на ${periodText}`;
  const categoryName = categories.find((c) => c.code === f.category)?.name ?? f.category;
  const statusText = status !== 'ALL' ? `, статус «${reservationStatuses[status]}»` : '';
  const conditionText = [
    f.payment && paymentFilters[f.payment]?.toLowerCase(),
    f.allocation && allocationFilters[f.allocation]?.toLowerCase(),
    f.source && `источник «${sourceLabel(f.source)}»`,
    f.category && `категория «${categoryName}»`,
  ]
    .filter(Boolean)
    .map((t) => `, ${t}`)
    .join('');
  const queryText = q ? `, по запросу «${q}»` : '';
  // Значение списка «Источник»: канал из списка объекта по подстроке (`booking` → Booking.com)
  const sourceCode = f.source.toUpperCase();
  const sourceValue = Object.hasOwn(sourceNames, sourceCode)
    ? sourceCode
    : (CHANNELS.find((c) => f.source && c.toLowerCase().includes(f.source.toLowerCase())) ??
      f.source);
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
        <nav className="directory-filters reservations-views" aria-label="Быстрые виды">
          {Object.entries(reservationViews).map(([id, label]) => (
            <Link
              key={id}
              href={href({ view: id, page: '1' })}
              className={f.view === id ? 'is-active' : ''}
              aria-current={f.view === id ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form className="reservations-toolbar" method="get">
          {!periodView && <input type="hidden" name="view" value={f.view} />}
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
            {periodPresets.map(([label, p]) => {
              const current = periodView && p.from === from && p.to === to;
              return (
                <Link
                  key={label}
                  href={href({ from: p.from, to: p.to, view: 'all', page: '1' })}
                  className={current ? 'is-active' : ''}
                  aria-current={current ? 'page' : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          {periodView && (
            <DatesToggle defaultOpen={!isPreset || f.date !== 'stay'}>
              <Field inline label="С">
                <DateInput
                  key={`from-${from}`}
                  name="from"
                  defaultValue={from}
                  aria-label="Период: с"
                />
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
              <Field inline label="Дата относится к">
                <Select name="date" key={`date-${f.date}`} defaultValue={f.date}>
                  {Object.entries(dateBases).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </DatesToggle>
          )}
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
          <span className="reservations-break" aria-hidden="true" />
          <FiltersToggle
            active={[f.source, f.payment, f.allocation, f.category, f.sort].filter(Boolean).length}
          >
            <Select
              name="source"
              key={`source-${sourceValue}`}
              defaultValue={sourceValue}
              aria-label="Источник"
            >
              <option value="">Все источники</option>
              <optgroup label="Каналы продаж">
                <option value="OTA">Все каналы продаж</option>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Напрямую">
                {Object.entries(sourceNames)
                  .filter(([id]) => id !== 'OTA')
                  .map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
              </optgroup>
              {sourceValue &&
                sourceValue !== 'OTA' &&
                !Object.hasOwn(sourceNames, sourceValue) &&
                !CHANNELS.includes(sourceValue) && (
                  <option value={sourceValue}>{sourceValue}</option>
                )}
            </Select>
            <Select
              name="payment"
              key={`payment-${f.payment}`}
              defaultValue={f.payment}
              aria-label="Оплата"
            >
              {Object.entries(paymentFilters).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              name="allocation"
              key={`allocation-${f.allocation}`}
              defaultValue={f.allocation}
              aria-label="Размещение"
            >
              {Object.entries(allocationFilters).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              name="category"
              key={`category-${f.category}`}
              defaultValue={f.category}
              aria-label="Категория"
            >
              <option value="">Все категории</option>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
              {f.category && !categories.some((c) => c.code === f.category) && (
                <option value={f.category}>{f.category}</option>
              )}
            </Select>
            <Select
              name="sort"
              key={`sort-${f.sort}`}
              defaultValue={f.sort}
              aria-label="Сортировка"
            >
              {Object.entries(sortOptions).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </FiltersToggle>
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
                {pluralRu(result.total, ['бронирование', 'бронирования', 'бронирований'])}
                {scopeText}
                {statusText}
                {conditionText}
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
            {/* Иерархия строки (ADR-106): кто и какая бронь → когда → где → откуда → деньги → статус */}
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
                      r.arrivalDate === today &&
                      (r.status === 'CONFIRMED' || r.status === 'TENTATIVE');
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
                          {arrivesToday && (
                            <small className="reservations-flag">заезд сегодня</small>
                          )}
                          {departsToday && (
                            <small className="reservations-flag">выезд сегодня</small>
                          )}
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
                          {/* у группы предупреждение называет число (формулировка владельца 27.09):
                              «3 размещения» + «⚠ 1 без размещения»; одиночная — «⚠ без ячейки» (§9) */}
                          {unassigned && (
                            <span className="warn-text reservations-unassigned">
                              {itemsCount > 1
                                ? `⚠ ${itemsCount - r.unitCodes.length} без размещения`
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
                    Бронирований{scopeText}
                    {statusText}
                    {conditionText}
                    {queryText} нет. Уберите условие или выберите другой день.
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
                  {narrowed && (
                    <Link
                      href={href({
                        source: '',
                        payment: '',
                        allocation: '',
                        category: '',
                        page: '1',
                      })}
                      className="btn btn--secondary"
                    >
                      Убрать условия отбора
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
                  Страница {result.page} из {Math.max(1, Math.ceil(result.total / result.pageSize))}
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
