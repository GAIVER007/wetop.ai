import { requireVertical } from '../../lib/vertical-guard';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { redirect, unstable_rethrow } from 'next/navigation';
import { shiftDate } from '@pms/domain';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { Alert, Button, EmptyState, Stat } from '../../components/ui';
import { Chip, ChipGroup } from '../../components/chip';
import { Toolbar } from '../../components/toolbar';
import { DateInput } from '../../components/date-field';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { guestsApi } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { hotelToday } from '../../lib/hotel-api';
import { pluralRu } from '../../lib/plural';
import { CHANNELS, SOURCES } from '../reservations/sources';
import { FilterSelect, type FilterOption } from './filter-select';
import { GuestPanel } from './guest-panel';
import { GuestsSearch } from './guests-search';
import { GuestsTable } from './guests-table';
import { PageSize } from './page-size';
import { pageWindow, vsYesterday } from './guest-stay';
import { buildRowView } from './row-view';
import {
  DEFAULT_FILTERS,
  PAGE_SIZES,
  PERIODS,
  STATES,
  TOGGLES,
  VIEWS,
  activeSelects,
  directoryQuery,
  filtersOn,
  guestsHref,
  keptParams,
  needsCleanup,
  parseGuestFilters,
} from './filters';
import './guests-bookings.css';

/**
 * «Гости и бронирования» (поручение владельца 09.10.2026 по макету, план plans/guests-bookings-2026-10-09.md): один
 * экран вместо двух вкладок «Брони» и «Гости». Одна строка таблицы это гость и его основное проживание (заселён сейчас,
 * иначе ближайшее, иначе последнее); справа панель выбранного гостя. Классический список броней с экспортом и всеми
 * отборами остаётся: кнопка «Список броней» в шапке. Отбор целиком в адресе (`filters.ts`).
 */
export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireVertical(['HOSPITALITY']);
  const sp = normalizeSearchParams(await searchParams);
  const { f, error } = parseGuestFilters(sp);
  // Форма и ссылки шлют пустые поля и умолчания: такой адрес чистится одним переходом, им можно делиться
  if (!error && needsCleanup(sp)) redirect(guestsHref(f, { page: f.page, guest: f.guest }));
  const rawQ = error ? '' : (sp.q ?? '');
  const [today, { readOnly }] = await Promise.all([hotelToday(), deskShell()]);
  // Отказ API не выглядит как пустая база (B5): заголовок, поиск и отборы остаются
  const loaded = !error
    ? await guestsApi.directory(directoryQuery(f)).then(
        (r) => ({ ok: true as const, r }),
        (e: unknown) => {
          unstable_rethrow(e);
          return { ok: false as const, e };
        },
      )
    : null;
  const result = loaded?.ok ? loaded.r : null;
  const loadError = loaded && !loaded.ok ? loaded.e : null;
  const href = (over: Partial<typeof f>) => guestsHref(f, over);
  const reset = guestsHref(DEFAULT_FILTERS);
  const emptyBase = result !== null && result.kpi.all === 0 && !filtersOn(f);
  const pageOutOfRange = (result?.total ?? 0) > 0 && result?.rows.length === 0;
  const rows = result?.rows ?? [];
  // панель: выбранный гость, по умолчанию первый в выдаче; `guest=none` закрывает её
  const selectedId = f.guest === 'none' ? null : f.guest || rows[0]?.id || null;
  const views = result?.views;

  const sourceOptions: FilterOption[] = [
    { value: '', label: 'Все источники', href: href({ source: '' }) },
    ...SOURCES.filter(([code]) => code !== 'OTA').map(([code, label]) => ({
      value: code,
      label,
      href: href({ source: code }),
    })),
    { value: 'OTA', label: 'Все каналы продаж', href: href({ source: 'OTA' }), group: 'Каналы продаж' },
    ...CHANNELS.map((c) => ({ value: c, label: c, href: href({ source: c }), group: 'Каналы продаж' })),
  ];
  // источник из адреса без регистра: «booking» и «Booking.com» одно значение выпадающего списка
  const sourceValue =
    sourceOptions.find((o) => o.value.toLowerCase() === f.source.toLowerCase())?.value ?? '';
  const periodOptions: FilterOption[] = PERIODS.map(([value, label]) => ({
    value,
    label,
    href:
      value === 'range'
        ? href({ period: 'range', from: today, to: shiftDate(today, 6) })
        : href({ period: value, from: '', to: '' }),
  }));
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const pageNumber = result?.page ?? 1;

  const pager = result && (
    <div className="gb-pager">
      <PageSize
        value={f.size}
        hrefs={Object.fromEntries(PAGE_SIZES.map((n) => [n, href({ size: n, page: '1' })]))}
      />
      {pages > 1 && (
        <nav className="gb-pages" aria-label="Страницы гостей">
          {pageNumber > 1 && (
            <Link
              href={href({ page: String(pageNumber - 1) })}
              scroll={false}
              prefetch={false}
              aria-label="Предыдущая страница"
            >
              <Icon name="back" width={16} height={16} />
            </Link>
          )}
          {pageWindow(pageNumber, pages).map((n, i) =>
            n === 'gap' ? (
              <span key={`gap-${i}`} aria-hidden="true">
                …
              </span>
            ) : (
              <Link
                key={n}
                href={href({ page: String(n) })}
                scroll={false}
                prefetch={false}
                aria-current={n === pageNumber ? 'page' : undefined}
                aria-label={`Страница ${n}`}
              >
                {n}
              </Link>
            ),
          )}
          {pageNumber < pages && (
            <Link
              href={href({ page: String(pageNumber + 1) })}
              scroll={false}
              prefetch={false}
              aria-label="Следующая страница"
            >
              <Icon name="arrow" width={16} height={16} />
            </Link>
          )}
        </nav>
      )}
    </div>
  );

  return (
    <Page
      title="Гости и бронирования"
      subtitle="Единая база гостей, бронирований и проживаний"
      width="full"
      className="guests-bookings"
      // «+ Новый гость» макета не рисуем: гость заводится только вместе с бронью (ADR-072, Q-GB-1); на его месте
      // классический список броней. «Только чтение» (ADR-102): бронь создать нельзя, кнопка не рисуется
      actions={
        <>
          <Link className="btn btn--secondary" href="/reservations">
            Список броней
          </Link>
          {!readOnly && (
            <Link className="btn" href="/reservations/new">
              <Icon name="plus" />
              Новая бронь
            </Link>
          )}
        </>
      }
    >
      {error && (
        <Alert boxed>
          {error} <Link href={reset}>Сбросить фильтры</Link>
        </Alert>
      )}
      {loadError !== null && (
        <LoadError
          testId="guests-error"
          title="Не удалось загрузить гостей"
          {...loadErrorProps(loadError)}
        />
      )}
      {result && !emptyBase && (
        <section className="gb-kpis" aria-label="Показатели гостей" data-testid="guests-kpis">
          <Stat
            icon={<Icon name="guests" />}
            tone="success"
            label="Проживают"
            value={result.kpi.inhouse}
            hint="Сейчас в доме"
            href={guestsHref(DEFAULT_FILTERS, { view: 'inhouse' })}
            testId="kpi-inhouse"
          />
          <Stat
            icon={<Icon name="arrival" />}
            tone="info"
            label="Заезды сегодня"
            value={result.kpi.arrivalsToday}
            delta={vsYesterday(result.kpi.arrivalsToday, result.kpi.arrivalsYesterday)}
            href={guestsHref(DEFAULT_FILTERS, { view: 'today' })}
            testId="kpi-arrivals"
          />
          <Stat
            icon={<Icon name="departure" />}
            tone="warning"
            label="Выезды сегодня"
            value={result.kpi.departuresToday}
            delta={vsYesterday(result.kpi.departuresToday, result.kpi.departuresYesterday)}
            href={guestsHref(DEFAULT_FILTERS, { view: 'departures' })}
            testId="kpi-departures"
          />
          <Stat
            icon={<Icon name="clock" />}
            tone="info"
            label="Ожидают заезд"
            value={result.kpi.expected}
            hint="В ближайшие дни"
            href={guestsHref(DEFAULT_FILTERS, { view: 'expected' })}
            testId="kpi-expected"
          />
          <Stat
            icon={<Icon name="incidents" />}
            tone="danger"
            label="Требуют внимания"
            value={result.kpi.attention}
            hint="Долг, без номера, не заехал"
            href={guestsHref(DEFAULT_FILTERS, { view: 'attention' })}
            testId="kpi-attention"
          />
          <Stat
            icon={<Icon name="bed" />}
            label="Без активного проживания"
            value={result.kpi.none}
            hint={`Всего гостей в базе: ${result.kpi.all}`}
            href={guestsHref(DEFAULT_FILTERS, { state: 'NONE' })}
            testId="kpi-none"
          />
        </section>
      )}
      {!emptyBase && (
        <div className="gb-layout" data-panel={selectedId ? 'open' : 'closed'}>
          <section className="gb-list" aria-label="Список гостей">
            <Toolbar
              label="Поиск и отбор гостей"
              className="gb-toolbar"
              search={<GuestsSearch q={rawQ} keep={keptParams(f, ['q'])} />}
              filters={
                <>
                  <FilterSelect
                    name="state"
                    label="Статус"
                    value={f.state}
                    options={STATES.map(([value, label]) => ({
                      value,
                      label,
                      href: href({ state: value }),
                    }))}
                  />
                  <FilterSelect name="source" label="Источник" value={sourceValue} options={sourceOptions} />
                </>
              }
              period={
                <>
                  <FilterSelect name="period" label="Период" value={f.period} options={periodOptions} />
                  {f.period === 'range' && (
                    <form method="get" action="/guests" className="gb-range" data-testid="guests-range">
                      {Object.entries(keptParams(f, ['period', 'from', 'to'])).map(([name, value]) => (
                        <input key={name} type="hidden" name={name} value={value} />
                      ))}
                      <input type="hidden" name="period" value="range" />
                      <DateInput key={`from-${f.from}`} name="from" defaultValue={f.from} aria-label="Период: с" />
                      <DateInput
                        key={`to-${f.to}`}
                        name="to"
                        rangeFromName="from"
                        defaultValue={f.to}
                        aria-label="Период: по"
                      />
                      <Button tone="secondary">Показать</Button>
                    </form>
                  )}
                </>
              }
            />
            <div className="gb-chips">
              <ChipGroup as="nav" label="Быстрые виды" className="gb-views">
                {VIEWS.map((v) => (
                  <Chip
                    key={v.id}
                    size="sm"
                    href={href({ view: v.id })}
                    selected={f.view === v.id}
                    {...(views ? { count: views[v.id] } : {})}
                  >
                    {v.label}
                  </Chip>
                ))}
              </ChipGroup>
              <ChipGroup as="nav" label="Дополнительные отборы" className="gb-toggles">
                {TOGGLES.map((t) => (
                  <Chip key={t.id} size="sm" href={href({ [t.id]: !f[t.id] } as Partial<typeof f>)} selected={f[t.id]}>
                    {t.label}
                  </Chip>
                ))}
                {(filtersOn(f) || activeSelects(f) > 0) && (
                  <Link href={reset} className="gb-reset">
                    Сбросить фильтры
                  </Link>
                )}
              </ChipGroup>
            </div>
            {f.q.length === 0 && rawQ.trim().length === 1 && (
              <p className="hint" role="status">
                Введите не менее 2 символов для поиска.
              </p>
            )}
            {result && (
              // итог выдачи меняют автопоиск и отборы: читалка узнаёт его без перехода фокуса
              <p className="sr-only" data-testid="guests-meta" role="status">
                {pluralRu(result.total, ['гость', 'гостя', 'гостей'])}
                {f.q.length >= 2 ? `, по запросу «${f.q}»` : ''}
              </p>
            )}
            {result && result.rows.length > 0 && (
              <GuestsTable
                rows={rows.map((row) =>
                  buildRowView(row, {
                    today,
                    readOnly,
                    selectHref: (id) => href({ guest: id }),
                  }),
                )}
                selectedId={selectedId}
                total={result.total}
                editable={!readOnly}
              >
                {pager}
              </GuestsTable>
            )}
            {result && !result.rows.length && (
              <EmptyState
                data-testid="guests-empty"
                icon={<Icon name="guests" />}
                title="Ничего не найдено"
                actions={
                  <>
                    {pageOutOfRange && (
                      <Link href={href({ page: '1' })} className="btn btn--secondary">
                        К первой странице
                      </Link>
                    )}
                    {f.q.length >= 2 && (
                      <Link href={href({ q: '' })} className="btn btn--secondary">
                        Убрать поиск
                      </Link>
                    )}
                    <Link href={reset} className="btn btn--secondary">
                      Сбросить фильтры
                    </Link>
                  </>
                }
              >
                {pageOutOfRange
                  ? 'На этой странице гостей нет: страниц меньше, чем номер в адресе.'
                  : 'Измените запрос или фильтры: проверьте написание или найдите гостя по телефону.'}
              </EmptyState>
            )}
          </section>
          {selectedId && result && result.rows.length > 0 && (
            <aside
              className="gb-panel"
              aria-label="Панель гостя"
              data-explicit={f.guest && f.guest !== 'none' ? 'true' : 'false'}
            >
              <GuestPanel id={selectedId} closeHref={href({ guest: 'none' })} />
            </aside>
          )}
        </div>
      )}
      {result && emptyBase && (
        <EmptyState
          data-testid="guests-none"
          icon={<Icon name="guests" />}
          title="Гостей пока нет"
          actions={
            readOnly ? undefined : (
              <Link href="/reservations/new" className="btn btn--secondary">
                Новая бронь
              </Link>
            )
          }
        >
          Гости появятся после первой брони: гость заводится вместе с ней.
        </EmptyState>
      )}
    </Page>
  );
}
