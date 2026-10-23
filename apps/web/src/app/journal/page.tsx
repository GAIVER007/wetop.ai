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
import { pluralRu } from '../../lib/plural';
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
}

const FILTERS: ReadonlyArray<readonly [type: string | null, label: string]> = [
  [null, 'Все'],
  ['Reservation', 'Брони'],
  ['InventoryUnit', 'Номера и места'],
  ['Guest', 'Гости'],
  ['Property', 'Объект и каналы'],
  ['TrackedSite', 'Сайт'],
  ['user', 'Сотрудники'],
  ['organization', 'Организация'],
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
  if (!mayAccess(desk.access, 'journal'))
    return (
      <Page title="История действий">
        <Notice>История действий доступна только владельцу.</Notice>
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
    const t = next.type === undefined ? type : next.type;
    const s = next.q === undefined ? needle : next.q;
    const sys = next.system === undefined ? showSystem : next.system;
    const u = new URLSearchParams({
      ...(actor ? { actor } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(group ? { group } : {}),
      ...(action ? { action } : {}),
      ...(t ? { type: t } : {}),
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
      : FILTERS.filter(([t]) => t === null || t === 'user' || t === 'organization');
  const sectionLabel = FILTERS.find(([t]) => (t ?? undefined) === type)?.[1];
  const conditions = [
    needle ? `по запросу «${needle}»` : '',
    type ? `раздел «${sectionLabel ?? type}»` : '',
    showSystem ? 'со служебными' : '',
    actor
      ? `сотрудник: ${actorResult.actors.find((a) => a.id === actor)?.name ?? (actor === 'system' ? 'система' : actor)}`
      : '',
    from ? `с ${from}` : '',
    to ? `по ${to}` : '',
    group === 'finance' ? 'касса и финансы' : group === 'staff' ? 'действия сотрудников' : '',
    action ? actionLabel(action) : '',
  ].filter(Boolean);
  return (
    <Page
      title="История действий"
      subtitle={`Действия сотрудников и изменения денег. Время: ${zoneLabel(clock.timezone)}.`}
      actions={<RefreshButton />}
    >
      {desk.vertical !== 'BEAUTY' && <TeamNavigation current="journal" owner />}
      {actorResult.failed && (
        <Notice>
          Не удалось загрузить список сотрудников. Журнал доступен, обновите страницу для выбора
          сотрудника.
        </Notice>
      )}
      {/* аудит 21.10.2026 п. 38: поиск по истории виден сразу и ищет только в истории, а не по всему WETOP */}
      <form method="get" className="journal-search" role="search" aria-label="Искать по истории">
        <Field label="Поиск в истории">
          <Input
            key={`q-${needle}`}
            name="q"
            aria-label="Поиск в истории"
            placeholder={desk.vertical === 'HOSPITALITY' ? 'Номер брони' : 'Действие или сотрудник'}
            defaultValue={needle}
          />
        </Field>
        {type && <input name="type" type="hidden" value={type} />}
        <Button tone="secondary">Искать в истории</Button>
        {(needle || type || showSystem || actor || from || to || group || action || cursor) && (
          <Link href="/journal" className="btn btn--ghost">
            Сбросить фильтры
          </Link>
        )}
      </form>
      <details className="journal-filter-panel">
        <summary>Фильтры истории</summary>
        <form method="get" className="control-toolbar control-journal-search">
          <input name="q" type="hidden" value={needle ?? ''} />
          <input name="type" type="hidden" value={type ?? ''} />
          <Field label="Сотрудник">
            <Select
              name="actor"
              defaultValue={actor ?? ''}
              key={`actor-${actor}`}
              aria-label="Сотрудник"
            >
              <option value="">Все сотрудники</option>
              <option value="system">Система</option>
              {actor && actor !== 'system' && !actorResult.actors.some((a) => a.id === actor) && (
                <option value={actor}>{actor}</option>
              )}
              {actorResult.actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || `Сотрудник ${a.id}`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="С даты">
            <Input
              type="date"
              name="from"
              aria-label="С даты"
              defaultValue={from ?? ''}
              key={`from-${from}`}
            />
          </Field>
          <Field label="По дату">
            <Input
              type="date"
              name="to"
              aria-label="По дату"
              defaultValue={to ?? ''}
              key={`to-${to}`}
            />
          </Field>
          <Field label="Раздел">
            <Select
              name="group"
              aria-label="Раздел"
              defaultValue={group ?? ''}
              key={`group-${group}`}
            >
              <option value="">Все разделы</option>
              <option value="finance">Касса и финансы</option>
              <option value="staff">Сотрудники</option>
            </Select>
          </Field>
          <Field label="Действие">
            <Select
              name="action"
              aria-label="Действие"
              defaultValue={action ?? ''}
              key={`action-${action}`}
            >
              <option value="">Все действия</option>
              {Object.entries(ACTION_RU).map(([key, title]) => (
                <option key={key} value={key}>
                  {title}
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
            Служебные события
          </label>
          <Button tone="secondary">Найти</Button>
        </form>
      </details>
      <nav className="chips" aria-label="Раздел истории">
        {filters.map(([t, label]) => (
          <Link
            key={label}
            href={href({ type: t })}
            className={cx((t ?? undefined) === type && 'is-active')}
            aria-current={(t ?? undefined) === type ? 'true' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Suspense
        key={query.toString()}
        fallback={
          <Panel role="status" data-testid="journal-loading">
            Загружаем журнал действий…
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
    ? `${rows.length >= LIMIT && !older ? `Последние ${LIMIT} операций` : filtered || older ? pluralRu(rows.length, ['операция', 'операции', 'операций']) : `Последние ${pluralRu(rows.length, ['операция', 'операции', 'операций'])}`}${conditions.length ? `, ${conditions.join(', ')}` : ''}${searching ? ' (поиск по всей истории)' : ''}`
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
              {['Когда', 'Кто', 'Что сделали', 'Где'].map((h) => (
                <th key={h}>{h}</th>
              ))}
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
                      <th colSpan={4} scope="colgroup" data-testid="journal-day">
                        {dayTitle(r.at, today, clock)}
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
                          {r.authorId ? `Сотрудник ${r.authorId}` : 'система'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div>{actionLabel(r.action)}</div>
                      {(r.after?.amountMinor ?? r.before?.amountMinor) !== undefined && (
                        <strong>
                          {auditValue('amountMinor', r.after?.amountMinor ?? r.before?.amountMinor)}
                        </strong>
                      )}
                      <OperationDetails
                        {...(r.before ? { before: r.before } : {})}
                        {...(r.after ? { after: r.after } : {})}
                      />
                    </td>
                    <td>
                      <span className="muted-2">{entityLabel(r.entityType)}</span>
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
                        r.targetAvailable === false && <span className="muted-2"> (удалена)</span>}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      )}
      {rows && (hasMore || older) && (
        <nav className="journal-pagination" aria-label="Страницы истории">
          {older && (
            <Link href={pageHref} className="btn btn--secondary">
              К новым операциям
            </Link>
          )}
          {hasMore && lastCursor && (
            <Link
              href={`${pageHref}${pageHref.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(lastCursor)}`}
              className="btn btn--secondary"
            >
              Более ранние операции
            </Link>
          )}
        </nav>
      )}
      {rows?.length === 0 && (
        <EmptyState
          icon={<Icon name="journal" />}
          title={conditions.length ? 'По этим условиям операций нет' : 'Операций пока нет'}
          data-testid="journal-empty"
          actions={
            conditions.length ? (
              <Link href="/journal" className="btn btn--secondary">
                Показать последние операции
              </Link>
            ) : undefined
          }
        >
          {conditions.length
            ? `Ничего не нашлось ${conditions.join(', ')}. Поиск идёт по всей истории, а не только по показанным строкам.`
            : 'Журнал заполняется действиями стойки и интеграций: заселение, оплата, брони из каналов.'}
        </EmptyState>
      )}
    </div>
  );
}
