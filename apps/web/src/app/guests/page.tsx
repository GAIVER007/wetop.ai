import { requireVertical } from '../../lib/vertical-guard';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { redirect, unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { Alert, Badge, Button, EmptyState, Field, Select, Table } from '../../components/ui';
import { DateInput } from '../../components/date-field';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { guestsApi, messengerLinks } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { hotelToday } from '../../lib/hotel-api';
import { displayDate, displayPeriod } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';
import { GuestsSearch } from './guests-search';
import { STATE_BADGE } from './guest-state';
import {
  LAST_VISIT,
  SECTIONS,
  SORTS,
  VISITS,
  activeSelects,
  describeFilters,
  directoryQuery,
  guestsHref,
  keptParams,
  parseGuestFilters,
} from './filters';
import { FiltersToggle } from '../reservations/filters-toggle';
import { SectionTabs } from '../reservations/section-tabs';
import '../directory.css';
import '../reservations/reservations.css';
import './guests.css';

/**
 * «Гости v2» (ТЗ владельца 27.09.2026, план plans/guests-v2-2026-09-27.md): одна строка — один
 * человек, а не бронь. Раздел отвечает «кто это, где он сейчас, когда был и когда приедет»;
 * список броней на день — это /reservations. Статус брони («отменена») строку гостя не подписывает.
 */
export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireVertical(['HOSPITALITY']);
  const sp = normalizeSearchParams(await searchParams);
  // отбор целиком в адресе (G7, ТЗ §31): раздел, поиск, последний визит, визиты, порядок, страница
  const { f, error } = parseGuestFilters(sp);
  // «Показать» — обычная GET-форма: она шлёт и пустые, и умолчательные поля (`from=&sort=name`).
  // Короткий адрес — тот, что пересылают ссылкой (§31), поэтому такой запрос уводится на него
  const noisy =
    Object.values(sp).some((v) => v === '') ||
    sp.sort === 'name' ||
    (Boolean(sp.from || sp.to) && sp.last !== 'period');
  if (!error && noisy) redirect(guestsHref(f, { page: f.page }));
  const rawQ = error ? '' : (sp.q ?? '');
  const { state, q } = f;
  const searching = q.length >= 2;
  const [today, { readOnly }] = await Promise.all([hotelToday(), deskShell()]);
  // Отказ API не выглядит как пустая база (B5): заголовок, разделы и поиск остаются
  const loaded = !error
    ? await guestsApi
        // 100 — потолок API: все ≤92 живущих объекта видны без листания, дальше — страницы (ТЗ §44)
        .directory(directoryQuery(f, 100))
        .then(
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
  const section = SECTIONS.find((s) => s.id === state)!;
  const filtersOn = state !== 'ALL' || searching || activeSelects(f) > 0;
  const filterWords = describeFilters(f, displayPeriod);
  const emptyBase = result !== null && result.counts.ALL === 0 && !filtersOn;
  const pageOutOfRange = (result?.total ?? 0) > 0 && result?.rows.length === 0;
  const thisYear = today.slice(0, 4);
  return (
    <Page
      title="Гости"
      subtitle="База гостей объекта и история проживаний"
      // Гость заводится вместе с бронью: отдельного «Добавить гостя» нет, пока база не в РК (ADR-072).
      // «Только чтение» (ADR-102, ТЗ §40): бронь создать нельзя — действие не рисуется, как на «Бронях»
      actions={
        readOnly ? undefined : (
          <Link className="btn" href="/reservations/new">
            <Icon name="plus" />
            Новая бронь
          </Link>
        )
      }
    >
      {/* «Гости» теперь вкладка раздела «Брони» (09.10.2026): в шапке пункта «Гости» больше нет */}
      <SectionTabs current="/guests" />
      <nav className="chips" aria-label="Гости по состоянию">
        {SECTIONS.map((s) => (
          <Link
            key={s.id}
            className={state === s.id ? 'is-active' : ''}
            aria-current={state === s.id ? 'page' : undefined}
            // смена раздела держит остальной отбор (поиск, визит, визиты, порядок)
            href={href({ state: s.id })}
          >
            {s.label}
            {result && (
              <span className="chips__count">
                {result.counts[s.id as keyof typeof result.counts]}
              </span>
            )}
          </Link>
        ))}
      </nav>
      {/* §47: поиск и отборы — одна строка («🔎 Поиск… [Фильтры]»), таблица сразу под ней */}
      <div className="guests-bar">
        <GuestsSearch q={rawQ} keep={keptParams(f, ['q'])} />
        {/* Отборы G7 (ТЗ §28, §30): как «Брони» (R2) — GET-форма и «Показать», на телефоне — за
            «Фильтрами». Период с–по виден, когда выбран «период» (CSS :has, без скрипта) */}
        <form method="get" action="/guests" className="guests-filters" data-testid="guests-filters">
          {Object.entries(keptParams(f, ['last', 'from', 'to', 'visits', 'sort'])).map(
            ([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ),
          )}
          <FiltersToggle active={activeSelects(f)}>
            <Field inline label="Последний визит">
              <Select name="last" key={`last-${f.last}`} defaultValue={f.last}>
                {LAST_VISIT.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <span className="guests-period">
              <Field inline label="С">
                <DateInput
                  key={`from-${f.from}`}
                  name="from"
                  defaultValue={f.from}
                  aria-label="Последний визит: с"
                />
              </Field>
              <Field inline label="По">
                <DateInput
                  key={`to-${f.to}`}
                  name="to"
                  rangeFromName="from"
                  defaultValue={f.to}
                  aria-label="Последний визит: по"
                />
              </Field>
            </span>
            <Field inline label="Визитов">
              <Select name="visits" key={`visits-${f.visits}`} defaultValue={f.visits}>
                {VISITS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field inline label="Порядок">
              <Select name="sort" key={`sort-${f.sort}`} defaultValue={f.sort}>
                {SORTS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </FiltersToggle>
          <Button tone="secondary">Показать</Button>
        </form>
      </div>
      {q.length === 1 && (
        <p className="hint" role="status">
          Введите не менее 2 символов для поиска.
        </p>
      )}
      {error && (
        <Alert boxed>
          {error} <Link href="/guests">Сбросить фильтры</Link>
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
        <section aria-label="Список гостей">
          {/* итог выдачи меняют автопоиск и отборы — читалка узнаёт его без перехода фокуса */}
          <p className="directory-meta" data-testid="guests-meta" role="status">
            {pluralRu(result.total, ['гость', 'гостя', 'гостей'])}
            {section.meta ? `, ${section.meta}` : ''}
            {searching ? `, по запросу «${q}»` : ''}
            {filterWords.map((w) => `, ${w}`).join('')}
            {filtersOn && (
              <>
                {' '}
                <Link href="/guests" className="guests-reset">
                  Сбросить фильтры
                </Link>
              </>
            )}
          </p>
          {result.rows.length > 0 && (
            <Table
              aria-label="Гости"
              data-testid="guests-table"
              className="dir-table dir-table--guests"
              nowrap
            >
              <thead>
                <tr>
                  <th>Гость</th>
                  <th>Контакты</th>
                  <th>Сейчас / ближайший визит</th>
                  <th>Последний визит</th>
                  <th className="num">Визитов</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((g) => {
                  const wa = messengerLinks(g.phone);
                  const badge = STATE_BADGE[g.state];
                  const lastWithYear =
                    g.last !== null && g.last.departureDate.slice(0, 4) !== thisYear;
                  return (
                    <tr key={g.id} data-testid="guest-row">
                      <td>
                        {/* G3: щелчок по гостю — панель предпросмотра поверх списка (ТЗ §17);
                            без JavaScript адрес ведёт на карточку. prefetch выключен: сто строк —
                            сто панелей загодя не нужны */}
                        <Link
                          className="dir-guest"
                          prefetch={false}
                          href={`/guests/${encodeURIComponent(g.id)}/preview`}
                        >
                          <strong>
                            {g.lastName} {g.firstName} {g.middleName ?? ''}
                          </strong>
                        </Link>
                      </td>
                      <td className="dir-contacts">
                        <span className="dir-phone">
                          <span>{g.phone ?? '—'}</span>
                          {wa && (
                            <a
                              className="dir-wa"
                              href={wa.whatsapp}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`WhatsApp: ${g.lastName} ${g.firstName}`}
                            >
                              WA
                            </a>
                          )}
                        </span>
                        {g.email && <small className="dir-sub">{g.email}</small>}
                      </td>
                      <td className="dir-now">
                        {g.current ? (
                          <>
                            {g.current.unitCode ? (
                              <span className="dir-unit">
                                <Icon name="bed" />
                                {g.current.unitCode}
                              </span>
                            ) : (
                              <span className="warn-text">без ячейки</span>
                            )}
                            <small className="dir-sub">
                              до{' '}
                              <time dateTime={g.current.departureDate}>
                                {displayDate(g.current.departureDate)}
                              </time>
                            </small>
                          </>
                        ) : g.next ? (
                          <>
                            <span>
                              {g.next.arrivalDate < today ? 'заезд был' : 'заезд'}{' '}
                              <time dateTime={g.next.arrivalDate}>
                                {displayDate(g.next.arrivalDate)}
                              </time>
                            </span>
                            <small className="dir-sub">{g.next.accommodationTypeName}</small>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="dir-stay">
                        {g.last ? (
                          <>
                            <time dateTime={g.last.arrivalDate}>
                              {displayDate(g.last.arrivalDate, lastWithYear ? 'numeric' : 'short')}
                            </time>
                            {' → '}
                            <time dateTime={g.last.departureDate}>
                              {displayDate(
                                g.last.departureDate,
                                lastWithYear ? 'numeric' : 'short',
                              )}
                            </time>
                          </>
                        ) : g.lastCancelledAt ? (
                          // §16 ТЗ: «отменена» — про бронь, не про человека, поэтому подписью, не бейджем
                          <small className="dir-sub">
                            бронь на{' '}
                            <time dateTime={g.lastCancelledAt}>
                              {displayDate(g.lastCancelledAt)}
                            </time>{' '}
                            отменена
                          </small>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="num">
                        {/* на широком экране — число под шапкой «Визитов», в карточке телефона — словом */}
                        <span className="guests-visits__num">{g.staysCount}</span>
                        <span className="dir-cell-word">
                          {pluralRu(g.staysCount, ['визит', 'визита', 'визитов'])}
                        </span>
                      </td>
                      <td>
                        {badge ? (
                          <Badge tone={badge.tone}>{badge.word}</Badge>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          {!result.rows.length && (
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
                  {searching && (
                    <Link href={href({ q: '' })} className="btn btn--secondary">
                      Убрать поиск
                    </Link>
                  )}
                  <Link href="/guests" className="btn btn--secondary">
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
          {result.total > result.pageSize && (
            <nav className="pagination" aria-label="Страницы гостей">
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
