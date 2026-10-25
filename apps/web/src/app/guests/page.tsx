import { requireFeature } from '../../lib/vertical-guard';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { redirect, unstable_rethrow } from 'next/navigation';
import { shiftDate } from '@pms/domain';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { Alert, Button, EmptyState } from '../../components/ui';
import { Chip, ChipGroup } from '../../components/chip';
import { Toolbar } from '../../components/toolbar';
import { DateInput } from '../../components/date-field';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { guestsApi } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { hotelToday } from '../../lib/hotel-api';
import { countLabel, msg } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';
import { CHANNELS, SOURCES } from '../reservations/sources';
import { FilterSelect, type FilterOption } from './filter-select';
import { GuestPanel } from './guest-panel';
import { GuestsSearch } from './guests-search';
import { GuestsTable } from './guests-table';
import { PageSize } from './page-size';
import { pageWindow } from './guest-stay';
import { GuestsSummary } from './guests-summary';
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
  await requireFeature('/guests');
  const t = await serverT();
  const locale = await currentLocale();
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
    { value: '', label: t('Все источники'), href: href({ source: '' }) },
    ...SOURCES.filter(([code]) => code !== 'OTA').map(([code, label]) => ({
      value: code,
      label: t(label),
      href: href({ source: code }),
    })),
    { value: 'OTA', label: t('Все каналы продаж'), href: href({ source: 'OTA' }), group: t('Каналы продаж') },
    ...CHANNELS.map((c) => ({ value: c, label: c, href: href({ source: c }), group: t('Каналы продаж') })),
  ];
  // источник из адреса без регистра: «booking» и «Booking.com» одно значение выпадающего списка
  const sourceValue =
    sourceOptions.find((o) => o.value.toLowerCase() === f.source.toLowerCase())?.value ?? '';
  const periodOptions: FilterOption[] = PERIODS.map(([value, label]) => ({
    value,
    label: t(label),
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
        <nav className="gb-pages" aria-label={t('Страницы гостей')}>
          {pageNumber > 1 && (
            <Link
              href={href({ page: String(pageNumber - 1) })}
              scroll={false}
              prefetch={false}
              aria-label={t('Предыдущая страница')}
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
                aria-label={t('Страница {n}', { n })}
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
              aria-label={t('Следующая страница')}
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
      title={t('Клиенты')}
      subtitle={t('Единая база гостей, бронирований и проживаний')}
      width="full"
      className="guests-bookings"
      // «+ Новый гость» макета не рисуем: гость заводится только вместе с бронью (ADR-072, Q-GB-1); на его месте
      // классический список броней. «Только чтение» (ADR-102): бронь создать нельзя, кнопка не рисуется
      actions={
        <>
          <Link className="btn btn--secondary" href="/reservations">
            {t('Список броней')}
          </Link>
          {!readOnly && (
            <Link className="btn" href="/reservations/new">
              <Icon name="plus" />
              {t('Новая бронь')}
            </Link>
          )}
        </>
      }
    >
      {error && (
        <Alert boxed>
          {t(error)} <Link href={reset}>{t('Сбросить фильтры')}</Link>
        </Alert>
      )}
      {loadError !== null && (
        <LoadError
          testId="guests-error"
          title={t('Не удалось загрузить гостей')}
          {...loadErrorProps(loadError)}
        />
      )}
      {result && !emptyBase && (
        <GuestsSummary
          kpi={result.kpi}
          href={(part) =>
            part === 'none'
              ? guestsHref(DEFAULT_FILTERS, { state: 'NONE' })
              : guestsHref(DEFAULT_FILTERS, { view: part })
          }
          t={t}
        />
      )}
      {!emptyBase && (
        <div className="gb-layout" data-panel={selectedId ? 'open' : 'closed'}>
          <section className="gb-list" aria-label={t('Список гостей')}>
            <Toolbar
              label={t('Поиск и отбор гостей')}
              className="gb-toolbar"
              search={<GuestsSearch q={rawQ} keep={keptParams(f, ['q'])} />}
              filters={
                <>
                  <FilterSelect
                    name="state"
                    label={t('Статус')}
                    value={f.state}
                    options={STATES.map(([value, label]) => ({
                      value,
                      label: t(label),
                      href: href({ state: value }),
                    }))}
                  />
                  <FilterSelect name="source" label={t('Источник')} value={sourceValue} options={sourceOptions} />
                </>
              }
              period={
                <>
                  <FilterSelect name="period" label={t('Период')} value={f.period} options={periodOptions} />
                  {f.period === 'range' && (
                    <form method="get" action="/guests" className="gb-range" data-testid="guests-range">
                      {Object.entries(keptParams(f, ['period', 'from', 'to'])).map(([name, value]) => (
                        <input key={name} type="hidden" name={name} value={value} />
                      ))}
                      <input type="hidden" name="period" value="range" />
                      <DateInput key={`from-${f.from}`} name="from" defaultValue={f.from} aria-label={t('Период: с')} />
                      <DateInput
                        key={`to-${f.to}`}
                        name="to"
                        rangeFromName="from"
                        defaultValue={f.to}
                        aria-label={t('Период: по')}
                      />
                      <Button tone="secondary">{t('Показать')}</Button>
                    </form>
                  )}
                </>
              }
            />
            <div className="gb-chips">
              <ChipGroup as="nav" label={t('Быстрые виды')} className="gb-views">
                {VIEWS.map((v) => (
                  <Chip
                    key={v.id}
                    size="sm"
                    href={href({ view: v.id })}
                    selected={f.view === v.id}
                    {...(views ? { count: views[v.id] } : {})}
                  >
                    {t(v.label)}
                  </Chip>
                ))}
              </ChipGroup>
              <ChipGroup as="nav" label={t('Дополнительные отборы')} className="gb-toggles">
                {TOGGLES.map((toggle) => (
                  <Chip
                    key={toggle.id}
                    size="sm"
                    href={href({ [toggle.id]: !f[toggle.id] } as Partial<typeof f>)}
                    selected={f[toggle.id]}
                  >
                    {t(toggle.label)}
                  </Chip>
                ))}
                {(filtersOn(f) || activeSelects(f) > 0) && (
                  <Link href={reset} className="gb-reset">
                    {t('Сбросить фильтры')}
                  </Link>
                )}
              </ChipGroup>
            </div>
            {f.q.length === 1 && (
              <p className="hint" role="status">
                {t('Введите не менее 2 символов для поиска.')}
              </p>
            )}
            {result && (
              // итог выдачи меняют автопоиск и отборы: читалка узнаёт его без перехода фокуса
              <p className="sr-only" data-testid="guests-meta" role="status">
                {[
                  countLabel(locale, t, result.total, [msg('гость'), 'гостя', msg('гостей')]), // kk-allow: форма склонения
                  ...(f.view !== 'all' ? [t(VIEWS.find((v) => v.id === f.view)?.label ?? '').toLowerCase()] : []),
                  ...(f.state !== 'ALL' ? [t(STATES.find(([value]) => value === f.state)?.[1] ?? '').toLowerCase()] : []),
                  ...(f.q.length >= 2 ? [t('по запросу «{q}»', { q: f.q })] : []),
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            {result && result.rows.length > 0 && (
              <GuestsTable
                rows={rows.map((row) =>
                  buildRowView(row, {
                    today,
                    readOnly,
                    selectHref: (id) => href({ guest: id }),
                    lang: { t, locale },
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
                title={t('Ничего не найдено')}
                actions={
                  <>
                    {pageOutOfRange && (
                      <Link href={href({ page: '1' })} className="btn btn--secondary">
                        {t('К первой странице')}
                      </Link>
                    )}
                    {f.q.length >= 2 && (
                      <Link href={href({ q: '' })} className="btn btn--secondary">
                        {t('Убрать поиск')}
                      </Link>
                    )}
                    <Link href={reset} className="btn btn--secondary">
                      {t('Сбросить фильтры')}
                    </Link>
                  </>
                }
              >
                {pageOutOfRange
                  ? t('На этой странице гостей нет: страниц меньше, чем номер в адресе.')
                  : t('Измените запрос или фильтры: проверьте написание или найдите гостя по телефону.')}
              </EmptyState>
            )}
          </section>
          {selectedId && result && result.rows.length > 0 && (
            <aside
              className="gb-panel"
              aria-label={t('Панель гостя')}
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
          title={t('Гостей пока нет')}
          actions={
            readOnly ? undefined : (
              <Link href="/reservations/new" className="btn btn--secondary">
                {t('Новая бронь')}
              </Link>
            )
          }
        >
          {t('Гости появятся после первой брони: гость заводится вместе с ней.')}
        </EmptyState>
      )}
    </Page>
  );
}
