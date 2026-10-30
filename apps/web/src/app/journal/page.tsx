import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { Fragment } from 'react';
import Link from 'next/link';
import { Suspense } from 'react';
import { TeamNavigation } from '../../components/team-navigation';
import { deskShell } from '../../lib/desk-shell';
import { mayAccess } from '../../lib/navigation';
import { OperationDetails, auditValue } from './operation-details';
import './journal.css';
import { RefreshButton } from '../../components/refresh-button';
import { workspaceTimezone } from '../../lib/workspace-context';
import { propertyClock } from '../../lib/property-time';
import { zoneLabel } from '../../lib/human-period';
import { dayTitle } from './journal-view';
import { getJsonPublic } from '../../lib/api';
import { countLabel, msg } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import {
  Table,
  Input,
  Button,
  Field,
  EmptyState,
  Panel,
  Notice,
  Select,
  cx,
} from '../../components/ui';
import { Icon } from '../../components/icon';
import { unstable_rethrow } from 'next/navigation';
import '../directory.css';
import { ACTION_RU, actionLabel, entityLabel } from './labels';
import { JournalPeriod } from './journal-period';
import { formatMoney } from '../../lib/money';
import { RISK_TABS, RISK_TAG, RISK_TILES, riskChange, riskComment, type AuditSummary, type RiskKey } from './journal-risk';

interface AuditRow {
  id: string;
  at: string;
  entityType: string;
  entityId: string;
  action: string;
  subject: string | null;
  /** false означает, что audit trail сохранён, но сама бронь уже удалена */
  targetAvailable: boolean | null;
  /** Имя вошедшего; null — система: импорт, сторож, скрипт сверки (ADR-023, ADR-046) */
  author: string | null;
  authorId?: string | null;
  cursor?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  risk?: RiskKey | null;
}

const FILTERS: ReadonlyArray<readonly [type: string | null, label: string]> = [
  [null, msg('Все')],
  ['Reservation', msg('Брони')],
  ['InventoryUnit', 'Номера и места'], // kk-allow: labels.test.ts сверяет эту строку исходника, перевод t(label) при показе
  ['Guest', msg('Гости')],
  ['Property', msg('Объект и каналы')],
  ['TrackedSite', msg('Сайт')],
  ['user', msg('Сотрудники')],
  ['organization', msg('Организация')],
];
/** Сколько строк просим у API: поиск и отбор идут по всей истории, наружу — не больше этого */
const LIMIT = 50;

/**
 * Журнал действий администратора и интеграций (SECURITY §6). Без ПД.
 * D4 (план владельца 19.09): выборка названа словами, разделы — чипами как в «Бронях», отказ API не уносит
 * экран (форма и раздел остаются, вместо строк `LoadError`), пустой результат называет условие и путь к «все»,
 * время в `<time>`, на телефоне строка складывается в карточку. Сам запрос к API и его пределы не менялись.
 */
export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const desk = await deskShell();
  const t = await serverT();
  if (!mayAccess(desk.access, 'journal'))
    return (
      <Page title={t('История действий')}>
        <Notice>{t('История действий доступна только владельцу.')}</Notice>
      </Page>
    );
  const { type, q, system, actor, from, to, group, action, cursor } = normalizeSearchParams(
    await searchParams,
  );
  const clock = propertyClock(await workspaceTimezone());
  const actorResult = await getJsonPublic<Array<{ id: string; name: string | null }>>(
    '/audit/actors',
  ).then(
    (actors) => ({ actors, failed: false }),
    (e: unknown) => {
      unstable_rethrow(e);
      return { actors: [], failed: true };
    },
  );
  const showSystem = system === '1';
  // сводка рисков периода (владелец 30.10.2026): число и сумма скидок, отмен, удалений, возвратов и входов
  // без выбранного периода цифры и подпись за текущий месяц: «за всё время» владельцу ничего не говорит
  const periodFrom = from ?? `${clock.today().slice(0, 8)}01`;
  const periodTo = to ?? clock.today();
  const summaryQuery = new URLSearchParams({ timezone: clock.timezone, ...(actor ? { actor } : {}), from: periodFrom, to: periodTo }).toString();
  const groupHref = (g: string | null) => {
    const u = new URLSearchParams({
      ...(actor ? { actor } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(g ? { group: g } : {}),
    });
    const str = u.toString();
    return str ? `/journal?${str}` : '/journal';
  };
  const needle = q?.trim() ?? '';
  // Поиск и фильтр выполняются в API по всей истории, наружу возвращается ограниченная выборка.
  const query = new URLSearchParams({
    limit: String(LIMIT + 1),
    timezone: clock.timezone,
    ...(actor ? { actor } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(group ? { group } : {}),
    ...(action ? { action } : {}),
    ...(cursor ? { cursor } : {}),
    ...(type ? { entityType: type } : {}),
    ...(needle ? { q: needle } : {}),
    ...(showSystem ? { system: '1' } : {}),
  });
  const href = (next: { type?: string | null; q?: string; system?: boolean }) => {
    const nextType = next.type === undefined ? type : next.type;
    const s = next.q === undefined ? needle : next.q;
    const sys = next.system === undefined ? showSystem : next.system;
    const u = new URLSearchParams({
      ...(actor ? { actor } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(group ? { group } : {}),
      ...(action ? { action } : {}),
      ...(nextType ? { type: nextType } : {}),
      ...(s ? { q: s } : {}),
      ...(sys ? { system: '1' } : {}),
    });
    const str = u.toString();
    return str ? `/journal?${str}` : '/journal';
  };
  // разделы журнала по сущностям гостиницы (брони, ячейки, гости, объект) у салона и ресторана пусты
  const filters =
    desk.vertical === 'HOSPITALITY'
      ? FILTERS
      : FILTERS.filter(([f]) => f === null || f === 'user' || f === 'organization');
  const sectionLabel = FILTERS.find(([f]) => (f ?? undefined) === type)?.[1];
  const conditions = [
    needle ? t('по запросу «{q}»', { q: needle }) : '',
    type ? t('раздел «{section}»', { section: sectionLabel ? t(sectionLabel) : type }) : '',
    showSystem ? t('со служебными') : '',
    actor
      ? t('сотрудник: {name}', {
          name: actorResult.actors.find((a) => a.id === actor)?.name ?? (actor === 'system' ? t('система') : actor),
        })
      : '',
    from ? t('с {date}', { date: from }) : '',
    to ? t('по {date}', { date: to }) : '',
    group === 'finance'
      ? t('касса и финансы')
      : group === 'staff'
        ? t('действия сотрудников')
        : group
          ? t(RISK_TABS.find((x) => x.key === group)?.label ?? group).toLocaleLowerCase('ru-RU')
          : '',
    action ? actionLabel(action, t) : '',
  ].filter(Boolean);
  return (
    <Page
      title={t('История действий')}
      subtitle={t('Действия сотрудников и изменения денег. Время: {zone}.', { zone: zoneLabel(clock.timezone, t) })}
      actions={<RefreshButton />}
    >
      {desk.vertical !== 'BEAUTY' && <TeamNavigation current="journal" owner />}
      {actorResult.failed && (
        <Notice>
          {t('Не удалось загрузить список сотрудников. Журнал доступен, обновите страницу для выбора сотрудника.')}
        </Notice>
      )}
      {/* владелец 30.10.2026: компактно и по центру, сверху риски периода, вкладки разделов, период как в Журнале */}
      <div className="journal-wrap">
      {/* сводка рисков отдельным потоком: медленный ответ API не держит поиск и переходы (control-design) */}
      <Suspense key={summaryQuery} fallback={<div className="journal-risk-tiles" aria-busy="true" />}>
        <RiskTiles query={summaryQuery} hrefFor={RISK_TILES.map((x) => [x.key, groupHref(x.key)] as const)} active={group ?? null} />
      </Suspense>
      <div className="journal-toolbar">
        <nav className="journal-tabs" aria-label={t('Раздел рисков')}>
          <Link href={groupHref(null)} className={cx(!group && 'is-active')} aria-current={!group ? 'true' : undefined}>{t('Все')}</Link>
          {RISK_TABS.map((tab) => (
            <Link key={tab.key} href={groupHref(tab.key)} className={cx(group === tab.key && 'is-active')} aria-current={group === tab.key ? 'true' : undefined}>
              {t(tab.label)}
            </Link>
          ))}
        </nav>
        <JournalPeriod from={periodFrom} to={periodTo} today={clock.today()} />
      </div>
      {/* аудит 21.10.2026 п. 38: поиск по истории виден сразу и ищет только в истории, а не по всему WETOP */}
      <div className="journal-search-row">
      <form method="get" className="journal-search" role="search" aria-label={t('Искать по истории')}>
        <Field label={t('Поиск в истории')}>
          <Input
            key={`q-${needle}`}
            name="q"
            aria-label={t('Поиск в истории')}
            placeholder={desk.vertical === 'HOSPITALITY' ? t('Номер брони') : t('Действие или сотрудник')}
            defaultValue={needle}
          />
        </Field>
        {type && <input name="type" type="hidden" value={type} />}
        <Button tone="secondary">{t('Искать в истории')}</Button>
        {(needle || type || showSystem || actor || from || to || group || action || cursor) && (
          <Link href="/journal" className="btn btn--ghost">
            {t('Сбросить фильтры')}
          </Link>
        )}
      </form>
      <details className="journal-filter-panel">
        <summary>{t('Фильтры истории')}</summary>
        <form method="get" className="control-toolbar control-journal-search">
          <input name="q" type="hidden" value={needle ?? ''} />
          <input name="type" type="hidden" value={type ?? ''} />
          <Field label={t('Сотрудник')}>
            <Select
              name="actor"
              defaultValue={actor ?? ''}
              key={`actor-${actor}`}
              aria-label={t('Сотрудник')}
            >
              <option value="">{t('Все сотрудники')}</option>
              <option value="system">{t('Система')}</option>
              {actor && actor !== 'system' && !actorResult.actors.some((a) => a.id === actor) && (
                <option value={actor}>{actor}</option>
              )}
              {actorResult.actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || t('Сотрудник {id}', { id: a.id })}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('С даты')}>
            <Input
              type="date"
              name="from"
              aria-label={t('С даты')}
              defaultValue={from ?? ''}
              key={`from-${from}`}
            />
          </Field>
          <Field label={t('По дату')}>
            <Input
              type="date"
              name="to"
              aria-label={t('По дату')}
              defaultValue={to ?? ''}
              key={`to-${to}`}
            />
          </Field>
          <Field label={t('Раздел')}>
            <Select
              name="group"
              aria-label={t('Раздел')}
              defaultValue={group ?? ''}
              key={`group-${group}`}
            >
              <option value="">{t('Все разделы')}</option>
              <option value="finance">{t('Касса и финансы')}</option>
              <option value="staff">{t('Сотрудники')}</option>
            </Select>
          </Field>
          <Field label={t('Действие')}>
            <Select
              name="action"
              aria-label={t('Действие')}
              defaultValue={action ?? ''}
              key={`action-${action}`}
            >
              <option value="">{t('Все действия')}</option>
              {Object.entries(ACTION_RU).map(([key, title]) => (
                <option key={key} value={key}>
                  {t(title)}
                </option>
              ))}
            </Select>
          </Field>
          <label className="check">
            <input
              key={`system-${showSystem}`}
              type="checkbox"
              name="system"
              value="1"
              defaultChecked={showSystem}
            />{' '}
            {t('Служебные события')}
          </label>
          <Button tone="secondary">{t('Найти')}</Button>
        </form>
      </details>
      </div>
      {desk.vertical === 'HOSPITALITY' && (
      <nav className="chips" aria-label={t('Раздел истории')}>
        {filters.map(([f, label]) => (
          <Link
            key={label}
            href={href({ type: f })}
            className={cx((f ?? undefined) === type && 'is-active')}
            aria-current={(f ?? undefined) === type ? 'true' : undefined}
          >
            {t(label)}
          </Link>
        ))}
      </nav>
      )}
      <Suspense
        key={query.toString()}
        fallback={
          <Panel role="status" data-testid="journal-loading">
            {t('Загружаем журнал действий…')}
          </Panel>
        }
      >
        <JournalEntries
          query={query.toString()}
          conditions={conditions}
          filtered={!!needle || !!type || !!actor || !!from || !!to || !!group || !!action}
          pageHref={href({})}
          older={!!cursor}
          searching={!!needle}
        />
      </Suspense>
      </div>
    </Page>
  );
}

async function JournalEntries({
  query,
  conditions,
  filtered,
  searching,
  pageHref,
  older,
}: {
  query: string;
  conditions: string[];
  filtered: boolean;
  searching: boolean;
  pageHref: string;
  older: boolean;
}) {
  // день «сегодня» считает сервер по часам объекта: страница серверная, расхождения гидрации нет
  const clock = propertyClock(await workspaceTimezone());
  const today = clock.today();
  const locale = await currentLocale();
  const t = await serverT();
  const count = (n: number) => countLabel(locale, t, n, [msg('операция'), 'операции', msg('операций')]); // kk-allow: форма склонения
  const loaded = await getJsonPublic<AuditRow[]>(`/audit?${query}`).then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => {
      unstable_rethrow(e);
      return { ok: false as const, e };
    },
  );
  const rows = loaded.ok ? loaded.r.slice(0, LIMIT) : null;
  const hasMore = loaded.ok && loaded.r.length > LIMIT;
  const lastCursor = rows?.at(-1)?.cursor;
  const meta = rows
    ? `${rows.length >= LIMIT && !older ? t('Последние {n} операций', { n: LIMIT }) : filtered || older ? count(rows.length) : t('Последние {list}', { list: count(rows.length) })}${conditions.length ? `, ${conditions.join(', ')}` : ''}${searching ? ` ${t('(поиск по всей истории)')}` : ''}`
    : null;
  return (
    <div className="control-page">
      {meta && (
        <p className="directory-meta" data-testid="journal-meta">
          {meta}
        </p>
      )}
      {!loaded.ok && <LoadError testId="journal-error" {...loadErrorProps(loaded.e)} />}
      {rows && rows.length > 0 && (
        <Table
          size="sm"
          nowrap
          className="dir-table dir-table--journal control-table"
          data-testid="journal-table"
        >
          <thead>
            <tr>
              {[msg('Когда'), msg('Кто'), msg('Что сделали'), msg('Где')].map((h) => (
                <th key={h}>{t(h)}</th>
              ))}
              <th className="num">{t('Было → стало')}</th>
              <th>{t('Комментарий')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              // день пишем один раз на группу: до 21.09 полная дата с годом стояла в каждой строке и
              // делала «Когда» самой широкой колонкой экрана
              const newDay = i === 0 || clock.date(r.at) !== clock.date(rows[i - 1]!.at);
              return (
                <Fragment key={r.id}>
                  {newDay && (
                    <tr className="journal-day">
                      <th colSpan={6} scope="colgroup" data-testid="journal-day">
                        {dayTitle(r.at, today, clock, locale, t)}
                      </th>
                    </tr>
                  )}
                  <tr data-testid="journal-row">
                    <td className="journal-time">
                      <time dateTime={r.at}>{clock.clock(r.at)}</time>
                    </td>
                    <td>
                      {r.author ?? (
                        <span className="muted-2">
                          {r.authorId ? t('Сотрудник {id}', { id: r.authorId }) : t('система')}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="journal-action">
                        {r.risk && (
                          <span className={`journal-tag journal-tag--${r.risk}`}>{t(RISK_TAG[r.risk])}</span>
                        )}
                        {actionLabel(r.action, t)}
                      </div>
                      {!riskChange(r.before, r.after) && (r.after?.amountMinor ?? r.before?.amountMinor) !== undefined && (
                        <strong>
                          {auditValue('amountMinor', r.after?.amountMinor ?? r.before?.amountMinor, t)}
                        </strong>
                      )}
                      {!r.risk && (
                        <OperationDetails
                          {...(r.before ? { before: r.before } : {})}
                          {...(r.after ? { after: r.after } : {})}
                          t={t}
                        />
                      )}
                    </td>
                    <td>
                      <span className="muted-2">{entityLabel(r.entityType, t)}</span>
                      {r.subject && ' '}
                      {r.subject &&
                        (r.entityType === 'Reservation' && r.targetAvailable !== false ? (
                          <Link href={`/reservations/${encodeURIComponent(r.subject)}`}>
                            {r.subject}
                          </Link>
                        ) : (
                          r.subject
                        ))}
                      {r.entityType === 'Reservation' &&
                        r.subject &&
                        r.targetAvailable === false && <span className="muted-2"> {t('(удалена)')}</span>}
                    </td>
                    <td className="num journal-change-cell">
                      {(() => {
                        const c = riskChange(r.before, r.after);
                        if (!c) return null;
                        const m = (v: string) => formatMoney(v, c.currency ?? undefined);
                        return c.before ? (
                          <span><s className="muted-2">{m(c.before)}</s> → <b>{m(c.after)}</b></span>
                        ) : (
                          <b>{m(c.after)}</b>
                        );
                      })()}
                    </td>
                    <td className="journal-comment">
                      {(() => {
                        const note = riskComment(r.before, r.after);
                        if (note) return <span title={note}>«{note}»</span>;
                        return r.risk && r.risk !== 'access' ? (
                          <span className="journal-no-comment" data-testid="journal-no-comment">{t('Нет комментария')}</span>
                        ) : null;
                      })()}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      )}
      {rows && (hasMore || older) && (
        <nav className="journal-pagination" aria-label={t('Страницы истории')}>
          {older && (
            <Link href={pageHref} className="btn btn--secondary">
              {t('К новым операциям')}
            </Link>
          )}
          {hasMore && lastCursor && (
            <Link
              href={`${pageHref}${pageHref.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(lastCursor)}`}
              className="btn btn--secondary"
            >
              {t('Более ранние операции')}
            </Link>
          )}
        </nav>
      )}
      {rows?.length === 0 && (
        <EmptyState
          icon={<Icon name="journal" />}
          title={conditions.length ? t('По этим условиям операций нет') : t('Операций пока нет')}
          data-testid="journal-empty"
          actions={
            conditions.length ? (
              <Link href="/journal" className="btn btn--secondary">
                {t('Показать последние операции')}
              </Link>
            ) : undefined
          }
        >
          {conditions.length
            ? t('Ничего не нашлось {conditions}. Поиск идёт по всей истории, а не только по показанным строкам.', {
                conditions: conditions.join(', '),
              })
            : t('Журнал заполняется действиями стойки и интеграций: заселение, оплата, брони из каналов.')}
        </EmptyState>
      )}
    </div>
  );
}

async function RiskTiles({
  query,
  hrefFor,
  active,
}: {
  query: string;
  hrefFor: ReadonlyArray<readonly [RiskKey, string]>;
  active: string | null;
}) {
  const t = await serverT();
  const summary = await getJsonPublic<AuditSummary>(`/audit/summary?${query}`).catch((e: unknown) => {
    unstable_rethrow(e);
    return null;
  });
  if (!summary) return null;
  const href = new Map(hrefFor);
  return (
    <section className="journal-risk-tiles" aria-label={t('Риски за период')} data-testid="journal-risk-tiles">
      {RISK_TILES.map((tile) => (
        <Link
          key={tile.key}
          href={href.get(tile.key) ?? '/journal'}
          className={cx('journal-risk-tile', `journal-risk-tile--${tile.tone}`, active === tile.key && 'is-active')}
          aria-current={active === tile.key ? 'true' : undefined}
          data-testid={`journal-risk-${tile.key}`}
        >
          <span>{t(tile.label)}</span>
          <b>{summary[tile.key].count}</b>
          <small>{tile.key === 'access' ? t('событий') : formatMoney(summary[tile.key].minor, summary.currency ?? undefined)}</small>
        </Link>
      ))}
    </section>
  );
}
