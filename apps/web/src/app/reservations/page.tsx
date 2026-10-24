import { requireFeature } from '../../lib/vertical-guard';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { redirect, unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { Alert, Button, Field, Input, Select, StatusBadge, Table } from '../../components/ui';
import { PeriodPicker } from '../../components/period-picker';
import { Chip, ChipGroup } from '../../components/chip';
import { Toolbar } from '../../components/toolbar';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { formatMoney } from '../../lib/money';
import { displayDate } from '../../lib/display-date';
import { nightsBetween } from '../../lib/plural';
import { countLabel, intlLocale, msg } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';
import { DatesToggle } from './dates-toggle';
import { DensityScope } from './density-toggle';
import { FiltersToggle } from './filters-toggle';
import { PreviewRows } from './preview-rows';
import { FinanceLine } from './finance-line';
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
} from '../../lib/hotel-api';
import { placementNote } from './placement-note';

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireFeature('/reservations');
  const t = await serverT();
  const locale = await currentLocale();
  const il = intlLocale(locale);
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
    ? msg('Выберите корректный период до 366 дней.')
    : !Object.hasOwn(reservationStatuses, status)
      ? msg('Неизвестный статус брони.')
      : !/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 10000
        ? msg('Номер страницы должен быть от 1 до 10000.')
        : q.length > 120
          ? msg('Поиск: не более 120 символов.')
          : !Object.hasOwn(reservationViews, f.view) ||
              !Object.hasOwn(dateBases, f.date) ||
              !Object.hasOwn(paymentFilters, f.payment) ||
              !Object.hasOwn(allocationFilters, f.allocation) ||
              !Object.hasOwn(sortOptions, f.sort) ||
              f.source.length > 64 ||
              f.category.length > 64
            ? msg('Неизвестное условие отбора.')
            : null;
  // Отказ API не выглядит как ноль броней (B5): список ловит его сам, заголовок и фильтры остаются
  // Категории — для списка «Категория» и слов в строке выборки; сбой справочника список не ломает
  const [loaded, categories] = await Promise.all([
    !error
      ? reservationDirectory(apiQuery(f)).then(
          (r) => ({ ok: true as const, r }),
          (e: unknown) => {
            unstable_rethrow(e);
            return { ok: false as const, e };
          },
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
      ? displayDate(from, 'short', il)
      : `${displayDate(from, withYear ? 'numeric' : 'short', il)} → ${displayDate(to, withYear ? 'numeric' : 'short', il)}`;
  // Готовые отрезки — обычные вопросы стойки одним щелчком (owner 21.09); ручной период
  // раскрывается кнопкой «Даты» (ADR-106 по ТЗ «Брони v2» §62: «С/По» не занимают место при пресете)
  const periodPresets: [string, { from: string; to: string }][] = [
    [t('Сегодня'), { from: today, to: today }],
    [t('Завтра'), { from: plusDays(today, 1), to: plusDays(today, 1) }],
    [t('{n} дней', { n: 7 }), { from: today, to: plusDays(today, 6) }],
    [t('{n} дней', { n: 30 }), { from: today, to: plusDays(today, 29) }],
  ];
  const isPreset = periodPresets.some(([, p]) => p.from === from && p.to === to);
  // Виды «Будущие», «Проживают», «Требуют внимания» периода не знают (API их отбирает по фактам);
  // «Сегодня» держит день объекта — ручной период и «Дата относится к» есть только у вида «Все»
  const periodView = f.view === 'all';
  // Числа доступны в списке статусов; нулевые значения не перегружают подписи.
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
      ? t(' в виде «{view}»', { view: t(reservationViews[f.view]!) })
      : f.date === 'arrival'
        ? t(' с заездом {period}', { period: periodText })
        : f.date === 'departure'
          ? t(' с выездом {period}', { period: periodText })
          : f.date === 'created'
            ? t(', созданных {period}', { period: periodText })
            : t(' на {period}', { period: periodText });
  const categoryName = categories.find((c) => c.code === f.category)?.name ?? f.category;
  const statusText = status !== 'ALL' ? t(', статус «{status}»', { status: t(reservationStatuses[status]!) }) : '';
  const conditionText = [
    f.payment && t(paymentFilters[f.payment]!).toLowerCase(),
    f.allocation && t(allocationFilters[f.allocation]!).toLowerCase(),
    f.source && t('источник «{source}»', { source: t(sourceLabel(f.source)) }),
    f.category && t('категория «{category}»', { category: categoryName }),
  ]
    .filter(Boolean)
    .map((part) => `, ${part}`)
    .join('');
  const queryText = q ? t(', по запросу «{q}»', { q }) : '';
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
      title={t('Брони')}
      width="full"
      // В шапке один пункт «Гости и бронирования» (09.10.2026): этот список его вторая половина, назад ведёт кнопка
      actions={
        <>
          <Link href="/guests" className="btn btn--secondary">
            {t('Гости')}
          </Link>
          {!readOnly && (
            <Link href="/reservations/new" className="btn">
              <Icon name="plus" />
              {t('Новая бронь')}
            </Link>
          )}
        </>
      }
    >
      <section className="reservations-controls" aria-label={t('Фильтры броней')}>
        <ChipGroup as="nav" label={t('Быстрые виды')} className="reservations-views">
          {Object.entries(reservationViews).map(([id, label]) => (
            <Chip key={id} size="sm" href={href({ view: id, page: '1' })} selected={f.view === id}>
              {id === 'all' ? t('По периоду') : t(label)}
            </Chip>
          ))}
        </ChipGroup>
        <form method="get">
          {!periodView && <input type="hidden" name="view" value={f.view} />}
          <Toolbar
            label={t('Поиск и отбор броней')}
            className="reservations-toolbar"
            search={
              <div className="search-field">
                <Icon name="search" />
                <Input
                  name="q"
                  // key: при переходе по ссылке «Убрать поиск» React переиспользует поле, и defaultValue не
                  // обновился бы — поле показывало бы прежний запрос (CI 20.09)
                  key={`q-${q}`}
                  defaultValue={q}
                  placeholder={t('Гость, телефон или номер брони')}
                  aria-label={t('Поиск броней')}
                />
              </div>
            }
            filters={
              <>
                <Field label={t('Статус')} className="reservations-status-mobile">
                  <Select
                    name="status"
                    key={`status-${status}`}
                    defaultValue={status}
                    aria-label={t('Статус брони')}
                  >
                    {Object.entries(reservationStatuses).map(([id, label]) => (
                      <option key={id} value={id}>
                        {t(label)}
                        {counts && (counts[id] ?? 0) > 0 ? ` (${counts[id]})` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                <FiltersToggle
                  active={
                    [f.source, f.payment, f.allocation, f.category, f.sort].filter(Boolean).length
                  }
                >
                  <Select
                    name="source"
                    key={`source-${sourceValue}`}
                    defaultValue={sourceValue}
                    aria-label={t('Источник')}
                  >
                    <option value="">{t('Все источники')}</option>
                    <optgroup label={t('Каналы продаж')}>
                      <option value="OTA">{t('Все каналы продаж')}</option>
                      {CHANNELS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={t('Напрямую')}>
                      {Object.entries(sourceNames)
                        .filter(([id]) => id !== 'OTA')
                        .map(([id, label]) => (
                          <option key={id} value={id}>
                            {t(label)}
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
                    aria-label={t('Оплата')}
                  >
                    {Object.entries(paymentFilters).map(([id, label]) => (
                      <option key={id} value={id}>
                        {t(label)}
                      </option>
                    ))}
                  </Select>
                  <Select
                    name="allocation"
                    key={`allocation-${f.allocation}`}
                    defaultValue={f.allocation}
                    aria-label={t('Размещение')}
                  >
                    {Object.entries(allocationFilters).map(([id, label]) => (
                      <option key={id} value={id}>
                        {t(label)}
                      </option>
                    ))}
                  </Select>
                  <Select
                    name="category"
                    key={`category-${f.category}`}
                    defaultValue={f.category}
                    aria-label={t('Категория')}
                  >
                    <option value="">{t('Все категории')}</option>
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
                    aria-label={t('Сортировка')}
                  >
                    {Object.entries(sortOptions).map(([id, label]) => (
                      <option key={id} value={id}>
                        {t(label)}
                      </option>
                    ))}
                  </Select>
                </FiltersToggle>
              </>
            }
            period={
              periodView && (
                <DatesToggle defaultOpen={!isPreset || f.date !== 'stay'}>
                  {/* общий PeriodPicker (MV8.5 DS1c): применяет кнопка «Показать», адрес прежний */}
                  <PeriodPicker
                    from={from}
                    to={to}
                    fromName="from"
                    toName="to"
                    presetsClassName="reservations-presets"
                    presets={periodPresets.map(([label, p]) => ({
                      label,
                      href: href({ from: p.from, to: p.to, view: 'all', page: '1' }),
                      selected: periodView && p.from === from && p.to === to,
                    }))}
                  >
                    <Field inline label={t('Дата относится к')}>
                      <Select name="date" key={`date-${f.date}`} defaultValue={f.date}>
                        {Object.entries(dateBases).map(([id, label]) => (
                          <option key={id} value={id}>
                            {t(label)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </PeriodPicker>
                </DatesToggle>
              )
            }
            actions={
              <>
                <Button tone="secondary">{t('Показать')}</Button>
                {/* H11: тот же отбор в Excel; файл уходит из системы, поэтому без имён и контактов гостей */}
                {!error && (result?.total ?? 0) > 0 && (
                  <a
                    href={`/reservations/export?${new URLSearchParams(
                      Object.fromEntries(Object.entries(apiQuery(f)).filter(([k]) => k !== 'page')),
                    )}`}
                    className="btn btn--secondary btn--sm reservations-export"
                    data-testid="reservations-export"
                    download
                  >
                    <Icon name="down" />
                    {t('Скачать CSV')}
                  </a>
                )}
              </>
            }
          />
        </form>
      </section>
      {error && (
        <Alert boxed>
          {t(error)} <Link href="/reservations">{t('Сбросить фильтры')}</Link>
        </Alert>
      )}
      {loadError !== null && (
        <LoadError testId="reservations-error" {...loadErrorProps(loadError)} />
      )}
      {result && (
        <section className="reservations-results" aria-label={t('Список бронирований')}>
          <DensityScope
            showControl={result.rows.length > 0}
            meta={
              <p className="directory-meta" data-testid="directory-meta">
                {countLabel(locale, t, result.total, [msg('бронирование'), 'бронирования', msg('бронирований')]) /* kk-allow: форма склонения */}
                {scopeText}
                {statusText}
                {conditionText}
                {queryText}
                {filtersOn && (
                  <>
                    {' '}
                    <Link href="/reservations" className="reservations-reset">
                      {t('Сбросить фильтры')}
                    </Link>
                  </>
                )}
              </p>
            }
          >
            {/* Иерархия строки (ADR-106): кто и какая бронь → когда → где → откуда → деньги → статус */}
            {result.rows.length > 0 && (
              <Table
                aria-label={t('Бронирования')}
                data-testid="reservations-table"
                className="dir-table dir-table--reservations"
                nowrap
              >
                <thead>
                  <tr>
                    <th>{t('Бронь / гость')}</th>
                    <th>{t('Проживание')}</th>
                    <th>{t('Размещение')}</th>
                    <th>{t('Источник')}</th>
                    <th className="num">{t('Финансы')}</th>
                    <th>{t('Статус')}</th>
                  </tr>
                </thead>
                <PreviewRows>
                  {result.rows.map((r) => {
                    const nights = nightsBetween(r.arrivalDate, r.departureDate);
                    const itemsCount = r.itemsCount ?? (r.unitCodes.length || 1);
                    const note = placementNote(r, today, t);
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
                            aria-label={t('Открыть бронь {number}', { number: r.confirmationNumber })}
                          >
                            <strong>{r.primaryGuest?.label || t('Гость без имени')}</strong>
                            <span className="dir-number">{r.confirmationNumber}</span>
                          </Link>
                        </td>
                        <td className="dir-stay">
                          <span className="reservations-stay-dates">
                            <time dateTime={r.arrivalDate}>{displayDate(r.arrivalDate, 'short', il)}</time>
                            {' → '}
                            <time dateTime={r.departureDate}>{displayDate(r.departureDate, 'short', il)}</time>
                          </span>
                          {nights > 0 && (
                            <small>{countLabel(locale, t, nights, [msg('ночь'), 'ночи', msg('ночей')]) /* kk-allow: форма склонения */}</small>
                          )}
                          {arrivesToday && (
                            <small className="reservations-flag">{t('заезд сегодня')}</small>
                          )}
                          {departsToday && (
                            <small className="reservations-flag">{t('выезд сегодня')}</small>
                          )}
                        </td>
                        <td>
                          {itemsCount > 1 ? (
                            <span className="dir-unit">
                              <Icon name="bed" />
                              {countLabel(locale, t, itemsCount, [msg('размещение'), 'размещения', msg('размещений')]) /* kk-allow: форма склонения */}
                            </span>
                          ) : r.unitCodes.length ? (
                            <span className="dir-unit">
                              <Icon name="bed" />
                              {r.unitCodes.join(', ')}
                            </span>
                          ) : null}
                          {/* у группы предупреждение называет число (формулировка владельца 27.09):
                              «3 размещения» + «⚠ 1 без размещения»; будущей брони «Номер назначим позже» без тревоги,
                              выехавшей и отменённой пометки нет (аудит 22.10.2026 P1-13) */}
                          {note && (
                            <span
                              className={
                                note.warn ? 'warn-text reservations-unassigned' : 'muted reservations-unassigned'
                              }
                            >
                              {note.text}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="source-tag">
                            {r.channel || t(sourceNames[r.source] || r.source)}
                          </span>
                        </td>
                        <td className="num nowrap">
                          <span className="reservations-total">
                            {formatMoney(r.totalAmountMinor, r.currency)}
                          </span>
                          <FinanceLine row={r} />
                        </td>
                        <td>
                          <StatusBadge kind="hospitality" value={r.status} />
                        </td>
                      </tr>
                    );
                  })}
                </PreviewRows>
              </Table>
            )}
            {!result.rows.length && (
              <div className="empty-state" data-testid="reservations-empty">
                <Icon name="booking" />
                <h3>{t('Бронирований не найдено')}</h3>
                {pageOutOfRange ? (
                  <p>
                    {t('На этой странице бронирований нет: страниц меньше, чем номер в адресе.')}{' '}
                    <Link href={href({ page: '1' })}>{t('К первой странице')}</Link>
                  </p>
                ) : (
                  <p>{t('По выбранным условиям броней нет. Измените даты или сбросьте фильтры.')}</p>
                )}
                <div className="empty-state__actions">
                  {q && (
                    <Link href={href({ q: '', page: '1' })} className="btn btn--secondary">
                      {t('Убрать поиск')}
                    </Link>
                  )}
                  {status !== 'ALL' && (
                    <Link href={href({ status: 'ALL', page: '1' })} className="btn btn--secondary">
                      {t('Все статусы')}
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
                      {t('Убрать условия отбора')}
                    </Link>
                  )}
                  <Link href="/reservations" className="btn btn--secondary">
                    {t('Сбросить фильтры')}
                  </Link>
                </div>
              </div>
            )}
            {result.total > result.pageSize && (
              <nav className="pagination" aria-label={t('Страницы броней')}>
                {result.page > 1 && (
                  <Link
                    className="btn btn--secondary"
                    href={href({ page: String(result.page - 1) })}
                  >
                    {t('Назад')}
                  </Link>
                )}
                <span>
                  {t('Страница {page} из {pages}', {
                    page: result.page,
                    pages: Math.max(1, Math.ceil(result.total / result.pageSize)),
                  })}
                </span>
                {result.page * result.pageSize < result.total && (
                  <Link
                    className="btn btn--secondary"
                    href={href({ page: String(result.page + 1) })}
                  >
                    {t('Далее')}
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
