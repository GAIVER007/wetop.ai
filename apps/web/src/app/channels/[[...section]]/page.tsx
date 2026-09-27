import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  type OutboxRow,
  type OutboxRowStatus,
  type OutboxSummary,
  api,
  channelsApi,
} from '../../../lib/api';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { Page } from '../../../components/page';
import { RefreshButton } from '../../../components/refresh-button';
import {
  Alert,
  Badge,
  Fact,
  Grid,
  Panel,
  SectionTitle,
  StateBar,
  StateFact,
  Table,
} from '../../../components/ui';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { ChannelButtons } from '../buttons';
import { OutboxTable } from '../outbox-table';
import { EVENTS_PAGE, EventsTable, type EventsFilter } from '../events-table';
import { hotelClock } from '../../../lib/hotel-api';
import type { PropertyClock } from '../../../lib/property-time';
import { currentMe } from '../../../lib/desk-shell';
import { eventTime } from '../format';
import { ChannelReport } from '../report';
import '../../directory.css';

/**
 * Модуль «Каналы продаж» (ADR-107, поручение владельца 27.09.2026): один вход вместо пунктов
 * «Менеджер каналов» и «Синхронизация каналов». Обзор отвечает управляющему («обмен работает?
 * сколько броней принесли каналы?»), технический слой — очередь, payload, попытки, внутренние ID —
 * раскрывается «Техническими деталями» и живёт на вкладках «Синхронизация» и «События»; опасные
 * ручные команды — в «Настройке подключения» на вкладке «Подключения», только владельцу.
 * Вкладки — как у «Настроек гостиницы» (`.settings-tabs`); команды, их `data-testid` и порядок
 * не менялись — на них стоит запись показа для сертификации Channex.
 */
const tabs = [
  { view: '', href: '/channels', label: 'Обзор' },
  { view: 'connections', href: '/channels/connections', label: 'Подключения' },
  { view: 'mapping', href: '/channels/mapping', label: 'Сопоставление' },
  { view: 'sync', href: '/channels/sync', label: 'Синхронизация' },
  { view: 'events', href: '/channels/events', label: 'События' },
] as const;

const subtitles: Record<string, string> = {
  '': 'Состояние обмена с каналами и брони по источникам.',
  connections: 'Подключение Channex и настройка обмена.',
  mapping: 'Категории и тарифы WETOP в Channex.',
  sync: 'Что уходит в каналы и что приходит обратно.',
  events: 'Входящие события каналов: новые брони, изменения, отмены.',
};

/** Ответ API как есть или причина отказа: экран остаётся, вместо данных — сбой со следующим шагом (D4) */
const settle = <T,>(p: Promise<T>) =>
  p.then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => ({ ok: false as const, e }),
  );

/**
 * «, проверено 14:22 по Алматы» — время последней пробы адреса webhook по часам объекта (С-13: сервер стойки
 * может стоять не в поясе объекта); без пробы подпись не нужна
 */
const checkedAt = (iso: string | null | undefined, clock: PropertyClock) =>
  iso ? `, проверено ${clock.clock(iso)} по Алматы` : '';

export default async function ChannelSalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const { section = [] } = await params;
  if (section.length > 1) notFound();
  const view = section[0] ?? '';
  const sp = normalizeSearchParams(await searchParams);
  // Старые адреса пульта «/channels?…» ведут на свои вкладки: queue — очередь, type — журнал событий
  if (!view && sp.queue) redirect(`/channels/sync?queue=${encodeURIComponent(sp.queue)}`);
  if (!view && sp.type) {
    const u = new URLSearchParams();
    for (const key of ['status', 'type', 'q', 'page'] as const)
      if (sp[key]) u.set(key, sp[key]);
    redirect(`/channels/events?${u.toString()}`);
  }
  const tab = tabs.find((item) => item.view === view);
  if (!tab) notFound();
  return (
    <Page
      title={view ? tab.label : 'Каналы продаж'}
      subtitle={subtitles[view]}
      crumbs={view ? <Link href="/channels">Каналы продаж</Link> : undefined}
      actions={view === 'connections' ? <RefreshButton label="Проверить соединение" /> : undefined}
    >
      <nav className="settings-tabs" aria-label="Каналы продаж">
        {tabs.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            aria-current={item.view === view ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {view === '' && <Overview sp={sp} />}
      {view === 'connections' && <Connections />}
      {view === 'mapping' && <Mapping />}
      {view === 'sync' && <Sync queue={queueFilter(sp.queue)} />}
      {view === 'events' && <Events sp={sp} />}
    </Page>
  );
}

const queueFilter = (raw: string | undefined): OutboxRowStatus | '' =>
  raw === 'PENDING' || raw === 'FAILED' ? raw : '';

/* ── Обзор: работает ли обмен и что каналы принесли ── */

async function Overview({ sp }: { sp: Record<string, string | undefined> }) {
  const clock = await hotelClock();
  const [connection, webhook, loadedOutbox, failedEvents] = await Promise.all([
    channelsApi.connection().catch(() => null),
    channelsApi.webhookStatus().catch(() => null),
    settle(channelsApi.outbox()),
    channelsApi
      .events({ limit: 1, status: 'FAILED' })
      .then((r) => r.total)
      .catch(() => null),
  ]);
  const outbox = loadedOutbox.ok ? loadedOutbox.r : null;
  const stalledMinutes = outbox?.oldestPendingAt
    ? Math.floor((Date.now() - Date.parse(outbox.oldestPendingAt)) / 60_000)
    : 0;
  const notConnected = !connection?.propertyAccessible;
  const alarm =
    (outbox?.failed ?? 0) > 0 || stalledMinutes >= 10 || (failedEvents ?? 0) > 0;
  const tone = alarm ? 'alarm' : !outbox || notConnected || outbox.pending > 0 ? 'warn' : 'calm';
  const word = notConnected
    ? 'не подключены'
    : alarm
      ? 'требует внимания'
      : !outbox
        ? 'неизвестно'
        : 'работает';
  const summary = notConnected
    ? `${connection?.message ?? 'Не удалось проверить соединение с Channex'}.`
    : !outbox
      ? 'Сводка очереди не загрузилась — обновите страницу.'
      : outbox.failed > 0
        ? `Ошибок отправки ${outbox.failed} — каналы продают по старому остатку.`
        : stalledMinutes >= 10
          ? `Очередь стоит ${stalledMinutes} мин — каналы продают по старому остатку.`
          : (failedEvents ?? 0) > 0
            ? 'Входящая бронь требует разбора — откройте «События».'
            : outbox.pending > 0
              ? 'Изменения ждут отправки в каналы.'
              : 'Цены, остатки и брони ходят между WETOP и каналами.';
  const lastExchange =
    [outbox?.lastSentAt, connection?.lastWebhookAt, connection?.lastPullAt]
      .filter((x): x is string => !!x)
      .sort()
      .at(-1) ?? null;
  const failedTotal = (outbox?.failed ?? 0) + (failedEvents ?? 0);
  return (
    <div className="stack">
      {!loadedOutbox.ok && (
        <LoadError testId="outbox-error" {...loadErrorProps(loadedOutbox.e)} />
      )}
      <StateBar
        className="state-bar--wide"
        tone={tone}
        label="Обмен с каналами"
        value={<span data-testid="channels-state">{word}</span>}
        summary={summary}
      >
        <StateFact label="Последний обмен" value={eventTime(lastExchange, clock)} />
        <StateFact
          label="Очередь"
          value={outbox ? <span data-testid="outbox-pending">{String(outbox.pending)}</span> : '—'}
        >
          {outbox && outbox.pending === 0 && (
            <span className="state-bar__sub">всё ушло в каналы</span>
          )}
        </StateFact>
        <StateFact
          label="Ошибки"
          value={
            outbox || failedEvents !== null ? (
              <span className={failedTotal > 0 ? 'danger-text' : undefined} data-testid="channels-errors">
                {String(failedTotal)}
              </span>
            ) : (
              '—'
            )
          }
        >
          {failedTotal > 0 && (
            <span className="state-bar__sub danger-text">
              в отправке {outbox?.failed ?? 0}, во входящих {failedEvents ?? 0}
            </span>
          )}
        </StateFact>
        <StateFact
          label="Webhook в Channex"
          value={
            <span data-testid="webhook-status">
              {webhook === null
                ? 'состояние неизвестно'
                : webhook.registered
                  ? webhook.active
                    ? 'активен'
                    : 'выключен'
                  : webhook.expectedUrl
                    ? 'не зарегистрирован'
                    : 'нет PUBLIC_API_URL'}
            </span>
          }
        >
          {webhook?.registered &&
            webhook.expectedUrl &&
            webhook.callbackUrl !== webhook.expectedUrl && (
              <span className="state-bar__sub danger-text">
                зарегистрирован не постоянный адрес PMS — проверьте на «Подключениях»
              </span>
            )}
          {webhook?.registered && webhook.callbackReachable === false && (
            <span className="state-bar__sub danger-text">
              адрес не отвечает{checkedAt(webhook.callbackCheckedAt, clock)}
            </span>
          )}
        </StateFact>
      </StateBar>
      {outbox && <OverbookingAlarm outbox={outbox} />}
      <ChannelButtons group="exchange" connected={!!connection?.propertyAccessible} />
      <ChannelReport sp={sp} />
      <details className="context-help" data-testid="channels-tech">
        <summary>Технические детали</summary>
        <div>
          <Grid min={200}>
            <Fact
              label="Объект Channex"
              value={
                connection?.propertyId ? (
                  <span className="mono break-all">{connection.propertyId}</span>
                ) : (
                  'не создан'
                )
              }
            />
            <Fact
              label="Последняя задача Channex"
              value={
                <span className="mono break-all" data-testid="outbox-last-task">
                  {outbox ? (outbox.lastTaskId ?? '—') : 'не загрузилось'}
                </span>
              }
            />
            <Fact
              label="Адрес webhook"
              value={
                webhook?.registered && webhook.callbackUrl ? (
                  <span className="mono break-all">{webhook.callbackUrl}</span>
                ) : (
                  '—'
                )
              }
            />
          </Grid>
          <p className="note">
            Очередь отправки — на вкладке <Link href="/channels/sync">«Синхронизация»</Link>, журнал
            входящих — в <Link href="/channels/events">«Событиях»</Link>.
          </p>
        </div>
      </details>
    </div>
  );
}

/* ── Подключения: состояние Channex и настройка обмена (кнопки — владельцу) ── */

async function Connections() {
  const clock = await hotelClock();
  const [connection, webhook, me] = await Promise.all([
    channelsApi.connection().catch(() => null),
    channelsApi.webhookStatus().catch(() => null),
    settle(currentMe()),
  ]);
  const owner = me.ok && me.r.user?.role === 'OWNER';
  const webhookReady = !!webhook?.expectedUrl && !!webhook?.secretConfigured;
  return (
    <div className="stack">
      {!connection && <Alert boxed>Не удалось проверить подключение Channex.</Alert>}
      <Panel title="Channex" data-testid="channel-connection">
        <Badge tone={connection?.propertyAccessible ? 'ok' : 'warn'}>
          {connection?.message ?? 'Не проверено'}
        </Badge>
        {connection && (
          <Grid min={180}>
            <Fact
              label="Среда"
              value={
                connection.environment === 'production'
                  ? 'Рабочая'
                  : connection.environment === 'staging'
                    ? 'Тестовая'
                    : 'Свой сервер'
              }
            />
            <Fact
              label="Объект Channex"
              value={
                connection.propertyId ? (
                  <span className="mono break-all">{connection.propertyId}</span>
                ) : (
                  'не создан'
                )
              }
            />
            <Fact
              label="Сопоставлено"
              value={`категорий ${connection.mappedCategories}, тарифов ${connection.mappedRatePlans}`}
            />
            <Fact label="Последний webhook, по Алматы" value={clock.local(connection.lastWebhookAt)} />
            <Fact label="Последний импорт, по Алматы" value={clock.local(connection.lastPullAt)} />
          </Grid>
        )}
      </Panel>
      <Panel title="Webhook в Channex" data-testid="channel-webhook">
        {webhook === null ? (
          <Alert>
            Статус webhook не загрузился. Его состояние неизвестно — обновите страницу перед
            настройкой.
          </Alert>
        ) : (
          <>
            <Badge tone={webhook.registered && webhook.active ? 'ok' : 'warn'}>
              <span data-testid="webhook-state">
                {webhook.registered
                  ? `${webhook.active ? 'активен' : 'выключен'}, события ${webhook.eventMask}`
                  : webhook.expectedUrl
                    ? 'не зарегистрирован'
                    : 'нет PUBLIC_API_URL'}
              </span>
            </Badge>
            {webhook.registered && <p className="note break-all">{webhook.callbackUrl}</p>}
            {webhook.registered &&
              webhook.expectedUrl &&
              webhook.callbackUrl !== webhook.expectedUrl && (
                <p className="note danger-text" data-testid="webhook-url-mismatch">
                  зарегистрирован не постоянный адрес PMS ({webhook.expectedUrl}) — события уходят
                  не туда, нажмите «Зарегистрировать webhook»
                </p>
              )}
            {webhook.registered &&
              webhook.callbackReachable === false &&
              (!webhook.expectedUrl || webhook.callbackUrl === webhook.expectedUrl) && (
                <p className="note danger-text">
                  адрес не отвечает{checkedAt(webhook.callbackCheckedAt, clock)} — брони подберёт
                  опрос ленты, но webhook надо поднять
                </p>
              )}
            {webhook.registered && webhook.callbackReachable === true && (
              <p className="note ok-text">
                адрес отвечает{checkedAt(webhook.callbackCheckedAt, clock)}
              </p>
            )}
          </>
        )}
      </Panel>
      {owner ? (
        <ChannelButtons
          group="setup"
          webhookReady={webhookReady}
          configured={!!connection?.apiConfigured}
          connected={!!connection?.propertyAccessible}
        />
      ) : (
        <p className="note" data-testid="channel-setup-owner-only">
          Настройку подключения меняет владелец организации.
        </p>
      )}
      <p className="note" data-testid="channel-content-location">
        Ключ Channex хранится только на сервере. Общий экран подключений гостиницы —{' '}
        <Link href="/connections">«Интеграции»</Link>; фото, удобства и описание для каналов
        настраиваются в кабинете Channex или самого канала.
      </p>
    </div>
  );
}

/* ── Сопоставление: категории и тарифы WETOP ↔ Channex ── */

async function Mapping() {
  const [loadedMapping, summary] = await Promise.all([
    settle(channelsApi.mapping()),
    // сводка фонда нужна только для названий категорий: без неё страница остаётся, категории — кодами
    api.inventorySummary().catch(() => null),
  ]);
  const mapping = loadedMapping.ok ? loadedMapping.r : [];
  const byCode = new Map((summary?.byCategory ?? []).map((c) => [c.code, c.name]));
  const categoryName = (code: string) => byCode.get(code) ?? code;
  const mapped = mapping.filter((m) => m.providerRoomTypeId);
  return (
    <div className="stack">
      {!summary && (
        <Alert boxed tone="warning" data-testid="inventory-failed">
          Сводка фонда не загрузилась: категории ниже подписаны кодами. Сопоставления читаются
          отдельно и верны.
        </Alert>
      )}
      {loadedMapping.ok ? (
        <Table size="sm" className="dir-table dir-table--mapping">
          <thead>
            <tr>
              {['Категория', 'Категория в Channex', 'Тариф в Channex'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mapped.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-state" data-testid="mapping-empty">
                  Сопоставлений пока нет: категории и тарифы появятся здесь после «Создать объект и
                  категории» на вкладке <Link href="/channels/connections">«Подключения»</Link>.
                  Пока их нет, цены и остатки в каналы не уходят.
                </td>
              </tr>
            )}
            {mapped.map((m) => (
              <tr key={m.id} data-testid="mapping-row">
                <td>{categoryName(m.localAccommodationTypeCode ?? '')}</td>
                <td className="mono">{m.providerRoomTypeId}</td>
                <td className="mono">{m.providerRatePlanId}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <LoadError testId="mapping-error" {...loadErrorProps(loadedMapping.e)} />
      )}
    </div>
  );
}

/* ── Синхронизация: актуальны ли остатки, цены и брони; техника — раскрывашкой ── */

const SYNC_KINDS = [
  ['AVAILABILITY', 'Остатки'],
  ['RESTRICTIONS', 'Цены и ограничения'],
] as const;

async function Sync({ queue }: { queue: OutboxRowStatus | '' }) {
  const clock = await hotelClock();
  const [loadedOutbox, allRows, filteredRows, connection, failedEvents, summary] =
    await Promise.all([
      settle(channelsApi.outbox()),
      channelsApi.outboxRows().catch(() => null),
      queue ? channelsApi.outboxRows(queue).catch(() => null) : Promise.resolve(null),
      channelsApi.connection().catch(() => null),
      channelsApi
        .events({ limit: 1, status: 'FAILED' })
        .then((r) => r.total)
        .catch(() => null),
      api.inventorySummary().catch(() => null),
    ]);
  const outbox = loadedOutbox.ok ? loadedOutbox.r : null;
  const rows = queue ? filteredRows : allRows;
  const byCode = new Map((summary?.byCategory ?? []).map((c) => [c.code, c.name]));
  const categoryName = (code: string) => byCode.get(code) ?? code;
  const stalledMinutes = outbox?.oldestPendingAt
    ? Math.floor((Date.now() - Date.parse(outbox.oldestPendingAt)) / 60_000)
    : 0;
  const tone = !outbox
    ? 'warn'
    : outbox.failed > 0 || stalledMinutes >= 10
      ? 'alarm'
      : outbox.pending > 0
        ? 'warn'
        : 'calm';
  const summaryWord = !outbox
    ? 'Сводка очереди не загрузилась.'
    : outbox.failed > 0
      ? `Ошибок отправки ${outbox.failed} — каналы продают по старому остатку.`
      : stalledMinutes >= 10
        ? `Очередь стоит ${stalledMinutes} мин — каналы продают по старому остатку.`
        : outbox.pending > 0
          ? 'Ждут отправки в каналы.'
          : 'Очередь пуста: всё ушло в каналы.';
  const lastInbound =
    [connection?.lastWebhookAt, connection?.lastPullAt].filter((x): x is string => !!x).sort().at(-1) ??
    null;
  const kindState = (kind: OutboxRow['kind']) => {
    const ofKind = (allRows ?? []).filter((r) => r.kind === kind);
    const failed = ofKind.filter((r) => r.status === 'FAILED').length;
    const pending = ofKind.filter((r) => r.status === 'PENDING').length;
    const lastSent = ofKind.filter((r) => r.sentAt).map((r) => r.sentAt as string).sort().at(-1) ?? null;
    return { failed, pending, lastSent };
  };
  return (
    <div className="stack">
      {!loadedOutbox.ok && (
        <LoadError testId="outbox-error" {...loadErrorProps(loadedOutbox.e)} />
      )}
      <StateBar
        tone={tone}
        label="В очереди"
        value={outbox ? <span data-testid="sync-pending">{String(outbox.pending)}</span> : '—'}
        summary={summaryWord}
      >
        <StateFact
          label="Отправлено"
          value={
            outbox ? (
              <>
                <span data-testid="sync-sent">{String(outbox.sent)}</span>
                {outbox.failed > 0 ? (
                  <span className="danger-text">, ошибок {outbox.failed}</span>
                ) : (
                  ', ошибок нет'
                )}
              </>
            ) : (
              '—'
            )
          }
        >
          <span className="state-bar__sub">
            {outbox?.lastSentAt
              ? `последняя ${eventTime(outbox.lastSentAt, clock)}`
              : outbox
                ? 'ещё не было'
                : 'сводка не загрузилась'}
          </span>
        </StateFact>
        <StateFact
          label="Входящие брони"
          value={
            failedEvents === null ? (
              'не загрузилось'
            ) : failedEvents > 0 ? (
              <span className="danger-text">требуют разбора: {failedEvents}</span>
            ) : (
              'принимаются'
            )
          }
        >
          <span className="state-bar__sub">
            {lastInbound ? `последняя ${eventTime(lastInbound, clock)}` : 'ещё не приходили'}
          </span>
        </StateFact>
      </StateBar>
      {outbox && <OverbookingAlarm outbox={outbox} />}
      <Table size="sm" className="dir-table" data-testid="sync-kinds">
        <thead>
          <tr>
            {['Что', 'Состояние', 'Последняя отправка'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SYNC_KINDS.map(([kind, label]) => {
            const s = kindState(kind);
            return (
              <tr key={kind} data-testid={`sync-kind-${kind}`}>
                <td>{label}</td>
                <td>
                  {allRows === null ? (
                    '—'
                  ) : s.failed > 0 ? (
                    <Badge tone="danger">ошибка</Badge>
                  ) : s.pending > 0 ? (
                    <Badge tone="info">в очереди: {s.pending}</Badge>
                  ) : (
                    <Badge tone="ok">актуально</Badge>
                  )}
                </td>
                <td className="nowrap">{eventTime(s.lastSent, clock)}</td>
              </tr>
            );
          })}
          <tr data-testid="sync-kind-BOOKINGS">
            <td>Брони из каналов</td>
            <td>
              {failedEvents === null ? (
                '—'
              ) : failedEvents > 0 ? (
                <>
                  <Badge tone="danger">требуют разбора: {failedEvents}</Badge>{' '}
                  <Link href="/channels/events?status=FAILED">к событиям</Link>
                </>
              ) : (
                <Badge tone="ok">принимаются</Badge>
              )}
            </td>
            <td className="nowrap">{eventTime(lastInbound, clock)}</td>
          </tr>
        </tbody>
      </Table>
      <ChannelButtons group="exchange" connected={!!connection?.propertyAccessible} />
      <details className="context-help" open={queue ? true : undefined} data-testid="sync-tech">
        <summary>Технические детали</summary>
        <section className="stack stack--sm" aria-labelledby="outbox-title">
          <SectionTitle id="outbox-title">Очередь в Channex</SectionTitle>
          <OutboxTable
            rows={rows}
            filter={queue}
            hrefFor={(status) => (status ? `/channels/sync?queue=${status}` : '/channels/sync')}
            categoryName={categoryName}
          />
        </section>
      </details>
    </div>
  );
}

/* ── События: журнал входящих ревизий с фильтрами ── */

async function Events({ sp }: { sp: Record<string, string | undefined> }) {
  const filter: EventsFilter = {
    status: sp.status ?? '',
    type: sp.type ?? '',
    q: (sp.q ?? '').trim(),
    page: Math.max(1, Number(sp.page) || 1),
  };
  const data = await channelsApi
    .events({
      limit: EVENTS_PAGE,
      offset: (filter.page - 1) * EVENTS_PAGE,
      status: filter.status,
      type: filter.type,
      q: filter.q,
    })
    .catch(() => null);
  const href = (next: Partial<EventsFilter>) => {
    const f = { ...filter, ...next };
    const u = new URLSearchParams();
    if (f.status) u.set('status', f.status);
    if (f.type) u.set('type', f.type);
    if (f.q) u.set('q', f.q);
    if (f.page > 1) u.set('page', String(f.page));
    const s = u.toString();
    return s ? `/channels/events?${s}` : '/channels/events';
  };
  return (
    <section className="stack stack--sm" aria-labelledby="events-title">
      <SectionTitle id="events-title">Входящие события</SectionTitle>
      <EventsTable data={data} filter={filter} hrefFor={href} />
    </section>
  );
}

/**
 * T6: канал обязан узнать, что мест нет. Изменения уходят дельтами через очередь; если очередь встала
 * или дала ошибку, каналы продолжают продавать по старому остатку — это прямая дорога к овербукингу.
 * Порог 10 минут: воркер отправляет каждые 5 секунд, лимит Channex — не чаще 6 секунд на вид сообщения.
 */
function OverbookingAlarm({ outbox }: { outbox: OutboxSummary }) {
  const staleMinutes = outbox.oldestPendingAt
    ? Math.floor((Date.now() - Date.parse(outbox.oldestPendingAt)) / 60000)
    : 0;
  const stuck = staleMinutes >= 10;
  if (outbox.failed === 0 && !stuck) return null;
  return (
    <Alert boxed data-testid="overbooking-alarm">
      <b>Каналы могут не знать об остатках.</b>{' '}
      {outbox.failed > 0 && `Ошибок отправки: ${outbox.failed}. `}
      {stuck && `Самая старая неотправленная дельта ждёт ${staleMinutes} мин. `}
      Пока очередь не разошлась, каналы продают по старому остатку — возможен овербукинг. Нажмите
      «Отправить очередь сейчас» и проверьте ключ Channex.
    </Alert>
  );
}
