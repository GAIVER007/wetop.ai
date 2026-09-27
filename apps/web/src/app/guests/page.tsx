import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { Alert, Badge, EmptyState, Table } from '../../components/ui';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { guestsApi, messengerLinks, type GuestDirectoryState } from '../../lib/api';
import { hotelToday } from '../../lib/hotel-api';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';
import { GuestsSearch } from './guests-search';
import '../directory.css';
import './guests.css';

/**
 * «Гости v2» (ТЗ владельца 27.09.2026, план plans/guests-v2-2026-09-27.md): одна строка — один
 * человек, а не бронь. Раздел отвечает «кто это, где он сейчас, когда был и когда приедет»;
 * список броней на день — это /reservations. Статус брони («отменена») строку гостя не подписывает.
 */
const SECTIONS: ReadonlyArray<{ id: string; label: string; meta: string }> = [
  { id: 'ALL', label: 'Все', meta: '' },
  { id: 'INHOUSE', label: 'Проживают', meta: 'проживают' },
  { id: 'EXPECTED', label: 'Ожидаются', meta: 'ожидаются' },
  { id: 'RECENT', label: 'Недавние', meta: 'выехали за 30 дней' },
];
/** Слово о госте и тон бейджа; NONE — прочерк, бейджа нет (пустое значение — «—», DESIGN.md §14) */
const STATE_BADGE: Record<GuestDirectoryState, { word: string; tone: 'ok' | 'info' | 'neutral' } | null> = {
  INHOUSE: { word: 'живёт', tone: 'ok' },
  EXPECTED: { word: 'ожидается', tone: 'info' },
  RECENT: { word: 'выехал недавно', tone: 'neutral' },
  NONE: null,
};
/** Старые адреса ?status=CHECKED_IN живут в закладках и тестах — читаются как раздел */
const LEGACY_STATUS: Record<string, string> = {
  ALL: 'ALL',
  CHECKED_IN: 'INHOUSE',
  CONFIRMED: 'EXPECTED',
  TENTATIVE: 'EXPECTED',
  CHECKED_OUT: 'RECENT',
};

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = normalizeSearchParams(await searchParams);
  const stateRaw = sp.state
    ? sp.state.toUpperCase()
    : sp.status
      ? (LEGACY_STATUS[sp.status] ?? sp.status)
      : 'ALL';
  const rawQ = sp.q ?? '';
  const q = rawQ.trim();
  const page = sp.page || '1';
  const error = !SECTIONS.some((s) => s.id === stateRaw)
    ? 'Неизвестный раздел гостей.'
    : !/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 10000
      ? 'Номер страницы должен быть от 1 до 10000.'
      : q.length > 120
        ? 'Поиск: не более 120 символов.'
        : null;
  const state = error ? 'ALL' : stateRaw;
  const searching = q.length >= 2;
  const today = await hotelToday();
  // Отказ API не выглядит как пустая база (B5): заголовок, разделы и поиск остаются
  const loaded = !error
    ? await guestsApi
        .directory({
          ...(state !== 'ALL' ? { state } : {}),
          ...(searching ? { q } : {}),
          page,
          // 100 — потолок API: все ≤92 живущих объекта видны без листания, дальше — страницы (ТЗ §44)
          pageSize: '100',
        })
        .then(
          (r) => ({ ok: true as const, r }),
          (e: unknown) => ({ ok: false as const, e }),
        )
    : null;
  const result = loaded?.ok ? loaded.r : null;
  const loadError = loaded && !loaded.ok ? loaded.e : null;
  const href = (values: Record<string, string>) => {
    const params = new URLSearchParams({
      ...(state !== 'ALL' ? { state: state.toLowerCase() } : {}),
      ...(searching ? { q } : {}),
      ...values,
    });
    if (params.get('state') === 'all') params.delete('state');
    if (params.get('q') === '') params.delete('q');
    if (params.get('page') === '1') params.delete('page');
    const tail = params.toString();
    return `/guests${tail ? `?${tail}` : ''}`;
  };
  const section = SECTIONS.find((s) => s.id === state)!;
  const filtersOn = state !== 'ALL' || searching;
  const emptyBase = result !== null && result.counts.ALL === 0 && !filtersOn;
  const pageOutOfRange = (result?.total ?? 0) > 0 && result?.rows.length === 0;
  const thisYear = today.slice(0, 4);
  return (
    <Page
      title="Гости"
      subtitle="База гостей объекта и история проживаний"
      // Гость заводится вместе с бронью: отдельного «Добавить гостя» нет, пока база не в РК (ADR-072)
      actions={
        <Link className="btn" href="/reservations/new">
          <Icon name="plus" />
          Новая бронь
        </Link>
      }
    >
      <nav className="chips" aria-label="Гости по состоянию">
        {SECTIONS.map((s) => (
          <Link
            key={s.id}
            className={state === s.id ? 'is-active' : ''}
            aria-current={state === s.id ? 'page' : undefined}
            href={
              s.id === 'ALL'
                ? searching
                  ? `/guests?q=${encodeURIComponent(q)}`
                  : '/guests'
                : `/guests?${new URLSearchParams({
                    state: s.id.toLowerCase(),
                    ...(searching ? { q } : {}),
                  })}`
            }
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
      <GuestsSearch q={rawQ} state={state} />
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
      {loadError !== null && <LoadError testId="guests-error" {...loadErrorProps(loadError)} />}
      {result && !emptyBase && (
        <section aria-label="Список гостей">
          <p className="directory-meta" data-testid="guests-meta">
            {pluralRu(result.total, ['гость', 'гостя', 'гостей'])}
            {section.meta ? `, ${section.meta}` : ''}
            {searching ? `, по запросу «${q}»` : ''}
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
                        <Link className="dir-guest" href={`/guests/${encodeURIComponent(g.id)}`}>
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
                        <span className="dir-cell-word">визитов </span>
                        {g.staysCount}
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
                    <Link
                      href={state !== 'ALL' ? `/guests?state=${state.toLowerCase()}` : '/guests'}
                      className="btn btn--secondary"
                    >
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
            <Link href="/reservations/new" className="btn btn--secondary">
              Новая бронь
            </Link>
          }
        >
          Гости появятся после первой брони: гость заводится вместе с ней.
        </EmptyState>
      )}
    </Page>
  );
}
