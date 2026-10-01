import { ChannelConnectionSetup } from '../connection-setup';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  type OutboxRow,
  type OutboxRowStatus,
  type OutboxSummary,
  api,
  channelsApi,
  ratesApi,
} from '../../../lib/api';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { Page } from '../../../components/page';
import { RefreshButton } from '../../../components/refresh-button';
import {
  Alert,
  Badge,
  EmptyState,
  Fact,
  Grid,
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
import { eventTime } from '../format';
import { ChannelReport } from '../report';
import { categoryMappings, planMappings } from '../mapping';
import { Icon } from '../../../components/icon';
import '../../directory.css';
import '../channels.css';

/**
 * Модуль «Каналы продаж» (ADR-112, поручение владельца 27.09.2026): один вход вместо пунктов
 * «Менеджер каналов» и «Синхронизация каналов». Обзор отвечает управляющему («обмен работает?
 * сколько броней принесли каналы?»), технический слой — очередь, payload, попытки, внутренние ID —
 * раскрывается «Техническими деталями» и живёт на вкладках «Синхронизация» и «События»; опасные
 * ручные команды — в «Настройке подключения» на вкладке «Подключения», только владельцу.
 * Вкладки — как у «Настроек гостиницы» (`.settings-tabs`); команды, их `data-testid` и порядок
 * не менялись — на них стоит запись показа для сертификации Channex.
 */
const tabs = [
  { view: '', href: '/channels', label: 'Обзор' },
  { view: 'connections', href: '/connections/channex', label: 'Настройка подключения' },
  { view: 'mapping', href: '/channels/mapping', label: 'Сопоставление' },
  { view: 'sync', href: '/channels/sync', label: 'Синхронизация' },
  { view: 'events', href: '/channels/events', label: 'События' },
] as const;

const subtitles: Record<string, string> = {
  '': 'Состояние обмена с каналами и брони по источникам.',
  connections: 'Подключение менеджера каналов и настройка обмена.',
  mapping: 'Категории и тарифы WETOP в менеджере каналов.',
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
  if (view === 'connections') redirect('/connections/channex');
  const sp = normalizeSearchParams(await searchParams);
  // Старые адреса пульта «/channels?…» ведут на свои вкладки: queue — очередь, type — журнал событий
  if (!view && sp.queue) redirect(`/channels/sync?queue=${encodeURIComponent(sp.queue)}`);
  if (!view && sp.type) {
    const u = new URLSearchParams();
    for (const key of ['status', 'type', 'q', 'page'] as const) if (sp[key]) u.set(key, sp[key]);
    redirect(`/channels/events?${u.toString()}`);
  }
  const tab = tabs.find((item) => item.view === view);
  if (!tab) notFound();
  return (
    <Page
      title={view ? tab.label : 'Каналы продаж'}
      subtitle={view ? subtitles[view] : undefined}
      crumbs={view ? <Link href="/channels">Каналы продаж</Link> : undefined}
      actions={view === 'connections' ? <RefreshButton label="Проверить соединение" /> : undefined}
    >
      <nav className="settings-tabs channels-tabs" aria-label="Каналы продаж">
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
      {view === 'connections' && <ChannelConnectionSetup />}
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
  const [connection, webhook, loadedOutbox, failedEvents, recentEvents, summaryFund] =
    await Promise.all([
      channelsApi.connection().catch(() => null),
      channelsApi.webhookStatus().catch(() => null),
      settle(channelsApi.outbox()),
      channelsApi
        .events({ limit: 1, status: 'FAILED' })
        .then((r) => r.total)
        .catch(() => null),
      // наблюдаемые каналы (решение владельца по Q-205, дополнение к ADR-112): только факты из событий
      channelsApi
        .events({ limit: 50 })
        .then((r) => r.rows)
        .catch(() => null),
      api.inventorySummary().catch(() => null),
    ]);
  const outbox = loadedOutbox.ok ? loadedOutbox.r : null;
  const stalledMinutes = outbox?.oldestPendingAt
    ? Math.floor((Date.now() - Date.parse(outbox.oldestPendingAt)) / 60_000)
    : 0;
  const notConnected = !connection?.propertyAccessible;
  const alarm = (outbox?.failed ?? 0) > 0 || stalledMinutes >= 10 || (failedEvents ?? 0) > 0;
  const tone = alarm ? 'alarm' : !outbox || notConnected || outbox.pending > 0 ? 'warn' : 'calm';
  const word = notConnected
    ? 'не подключены'
    : alarm
      ? 'требует внимания'
      : !outbox
        ? 'неизвестно'
        : connection?.environment === 'staging'
          ? 'тестовый контур'
          : !webhook?.registered || !webhook?.active
            ? 'настройка не завершена'
            : 'API доступен';
  const summary = notConnected
    ? `${connection?.message ?? 'Не удалось проверить соединение с менеджером каналов'}.`
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
              : connection?.environment === 'staging'
                ? 'Менеджер каналов: тестовое подключение.'
                : 'Доступ к объекту проверен. Получение броней — в журнале событий.';
  const lastExchange =
    [outbox?.lastSentAt, connection?.lastWebhookAt, connection?.lastPullAt]
      .filter((x): x is string => !!x)
      .sort()
      .at(-1) ?? null;
  const failedTotal = (outbox?.failed ?? 0) + (failedEvents ?? 0);
  /**
   * Наблюдаемые OTA (Q-205, дополнение владельца к ADR-112): «Booking.com — работает» запрещено,
   * пока backend не может это подтвердить — показываем только факты из последних событий Channex:
   * имя, последнюю активность и события с ошибкой. Канал без событий в окне из списка выпадает —
   * это окно наблюдения, а не состояние подключения.
   */
  const observed = new Map<string, { lastAt: string; failed: number }>();
  for (const e of recentEvents ?? []) {
    if (!e.otaName) continue;
    const row = observed.get(e.otaName) ?? { lastAt: e.receivedAt, failed: 0 };
    if (e.receivedAt > row.lastAt) row.lastAt = e.receivedAt;
    if (e.status === 'FAILED') row.failed += 1;
    observed.set(e.otaName, row);
  }
  const observedRows = [...observed.entries()].sort((a, b) => (a[1].lastAt < b[1].lastAt ? 1 : -1));
  const fundCategories = summaryFund?.byCategory?.length ?? null;
  const mappedCategories = connection?.mappedCategories ?? null;
  const mappingGap =
    fundCategories !== null && mappedCategories !== null && mappedCategories < fundCategories;
  return (
    <div className="stack channels-overview">
      {!loadedOutbox.ok && <LoadError testId="outbox-error" {...loadErrorProps(loadedOutbox.e)} />}
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
            <span className="state-bar__sub">нет ожидающих отправки</span>
          )}
        </StateFact>
        <StateFact
          label="Ошибки"
          value={
            outbox || failedEvents !== null ? (
              <span
                className={failedTotal > 0 ? 'danger-text' : undefined}
                data-testid="channels-errors"
              >
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
          label="Приём событий"
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
      {outbox && alarm && (
        <Alert boxed data-testid="overbooking-alarm">
          Остатки могут быть неактуальны. <Link href="/channels/sync">Проверить очередь</Link> ·{' '}
          <Link href="/channels/events?status=FAILED">Ошибки входящих</Link>
        </Alert>
      )}
      <ChannelReport sp={sp} />
      <details className="context-help" data-testid="channels-activity">
        <summary>Активность каналов и ручной обмен</summary>
        <section className="stack stack--sm" aria-labelledby="observed-title">
          <SectionTitle id="observed-title">Каналы</SectionTitle>
          <p className="note">
            Наблюдаются по входящим событиям каналов — это последняя активность источника, а не
            состояние его подключения.
          </p>
          {recentEvents === null ? (
            <p className="note" data-testid="observed-failed">
              События не загрузились: API не ответил. Обновите страницу или откройте{' '}
              <Link href="/incidents">неисправности</Link>.
            </p>
          ) : observedRows.length === 0 ? (
            <p className="note" data-testid="observed-empty">
              Событий от каналов ещё не было. Канал появится здесь, когда придёт его бронь,
              изменение или отмену.
            </p>
          ) : (
            <Table size="sm" className="dir-table" data-testid="channels-observed">
              <thead>
                <tr>
                  {['Канал', 'Последнее событие', 'Событий с ошибкой'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {observedRows.map(([name, row]) => (
                  <tr key={name} data-testid="observed-row">
                    <td>
                      <strong>{name}</strong>
                    </td>
                    <td className="nowrap">{eventTime(row.lastAt, clock)}</td>
                    <td className="num">
                      {row.failed > 0 ? (
                        <Link href="/channels/events?status=FAILED" className="danger-text">
                          {row.failed}
                        </Link>
                      ) : (
                        '0'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {mappedCategories !== null &&
            (mappingGap ? (
              <p className="note danger-text" data-testid="mapping-gap">
                Сопоставлены не все категории: {mappedCategories} из {fundCategories} — по остальным
                цены и остатки в каналы не уходят. Проверить —{' '}
                <Link href="/channels/mapping">«Сопоставление»</Link>.
              </p>
            ) : (
              <p className="note" data-testid="mapping-note">
                Сопоставление — общее для всех каналов: категорий {mappedCategories}
                {fundCategories !== null ? ` из ${fundCategories}` : ''}, тарифов{' '}
                {connection?.mappedRatePlans ?? '—'}.
              </p>
            ))}
        </section>
        <ChannelButtons group="exchange" connected={!!connection?.propertyAccessible} />
      </details>
      <details className="context-help" data-testid="channels-tech">
        <summary>Технические детали</summary>
        <div>
          <Grid min={200}>
            <Fact
              label="Объект в менеджере каналов"
              value={
                connection?.propertyId ? (
                  <span className="mono break-all">{connection.propertyId}</span>
                ) : (
                  'не создан'
                )
              }
            />
            <Fact
              label="Последняя задача"
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

/* ── Сопоставление: категории и тарифы WETOP ↔ Channex ── */

/**
 * Категории и тарифы раздельно, по названиям (`plans/channels-mapping-port-2026-09-28.md`):
 * в таблицах — название номера в кабинете Channex и статус словом, id — за «Техническими деталями».
 * Правила «что ошибка, а что нет» — в `../mapping.ts`.
 */
async function Mapping() {
  const [loadedMapping, summary, loadedOptions, names] = await Promise.all([
    settle(channelsApi.mapping()),
    // сводка фонда — список категорий: без неё страница остаётся, категории — кодами
    api.inventorySummary().catch(() => null),
    // тарифы WETOP: не загрузились — категории остаются, сбой тарифов назван отдельно
    settle(ratesApi.options()),
    // названия номеров в кабинете Channex: не пришли — вместо названия слова, а не id
    channelsApi.channexNames().catch(() => null),
  ]);
  if (!loadedMapping.ok)
    return (
      <div className="stack">
        {!summary && <InventoryFailed />}
        <LoadError testId="mapping-error" {...loadErrorProps(loadedMapping.e)} />
      </div>
    );
  const mapping = loadedMapping.r;
  const mapped = mapping.filter((m) => m.providerRoomTypeId);
  if (mapped.length === 0)
    return (
      <div className="stack">
        {!summary && <InventoryFailed />}
        <EmptyState
          icon={<Icon name="channels" />}
          title="Сопоставлений пока нет"
          data-testid="mapping-empty"
          actions={
            <Link href="/channels/connections" className="btn btn--secondary">
              Открыть подключения
            </Link>
          }
        >
          Категории и тарифы появятся здесь, когда владелец организации нажмёт «Создать объект и
          категории» на вкладке «Подключения». Пока их нет, цены и остатки в каналы не уходят.
        </EmptyState>
      </div>
    );
  // без сводки фонда несопоставленных не видно: остаются сопоставленные, подписанные кодами
  const fund =
    summary?.byCategory.map((c) => ({ code: c.code, name: c.name })) ??
    [...new Set(mapped.map((m) => m.localAccommodationTypeCode ?? ''))].map((code) => ({
      code,
      name: code,
    }));
  const categories = categoryMappings(fund, mapping, names?.roomTypes ?? {});
  const unmapped = categories.filter((c) => !c.roomTypeId);
  const plans = loadedOptions.ok
    ? planMappings(
        loadedOptions.r.ratePlans,
        categories.map((c) => c.code),
        mapping,
      )
    : null;
  return (
    <div className="stack">
      {!summary && <InventoryFailed />}
      {unmapped.length > 0 && (
        <Alert boxed tone="warning" data-testid="mapping-warning">
          Без сопоставления: {unmapped.map((c) => c.name).join(', ')}. Остатки и цены по{' '}
          {unmapped.length === 1 ? 'этой категории' : 'этим категориям'} в каналы не уходят.
          Недостающее создаёт владелец организации кнопкой «Создать объект и категории» на вкладке{' '}
          <Link href="/channels/connections">«Подключения»</Link>; уже сопоставленное повтор не
          трогает.
        </Alert>
      )}
      <section className="stack stack--sm" aria-labelledby="mapping-categories-title">
        <SectionTitle id="mapping-categories-title">Категории</SectionTitle>
        <Table
          size="sm"
          className="dir-table dir-table--mapping"
          data-testid="mapping-categories"
          aria-label="Сопоставление категорий"
        >
          <thead>
            <tr>
              <th>Категория WETOP</th>
              <th>Номер в каналах</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.code}>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td>
                  {c.roomTypeId ? (
                    (c.channexName ?? (
                      <span className="cell-sub">название в каналах недоступно</span>
                    ))
                  ) : (
                    <span className="cell-sub">—</span>
                  )}
                </td>
                <td>
                  <Badge tone={c.roomTypeId ? 'ok' : 'warn'}>
                    {c.roomTypeId ? 'Сопоставлена' : 'Не сопоставлена'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
      <section className="stack stack--sm" aria-labelledby="mapping-rate-plans-title">
        <SectionTitle id="mapping-rate-plans-title">Тарифы</SectionTitle>
        {plans ? (
          <Table
            size="sm"
            className="dir-table dir-table--mapping"
            data-testid="mapping-rate-plans"
            aria-label="Сопоставление тарифов"
          >
            <thead>
              <tr>
                <th>Тариф WETOP</th>
                <th>Сопоставлен в категориях</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.code}>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="cell-sub">
                      {p.currency}
                      {p.active ? '' : ', не действует'}
                    </div>
                  </td>
                  <td className="num">
                    {p.mappedIn} из {categories.length}
                  </td>
                  <td>
                    <Badge
                      tone={p.status === 'none' ? 'neutral' : p.status === 'full' ? 'ok' : 'warn'}
                    >
                      {PLAN_STATUS[p.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          !loadedOptions.ok && (
            <LoadError testId="mapping-plans-error" {...loadErrorProps(loadedOptions.e)} />
          )
        )}
        <p className="note">
          В каналы уходит один тариф: он сопоставлен с каждой категорией объекта. Остальные тарифы
          работают только в WETOP — это не ошибка.
        </p>
      </section>
      <details className="context-help" data-testid="mapping-tech">
        <summary>Технические детали</summary>
        <div>
          <Table size="sm" className="dir-table dir-table--mapping">
            <thead>
              <tr>
                {['Категория', 'Номер в каналах', 'Тариф в каналах'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories
                .filter((c) => c.roomTypeId)
                .map((c) => (
                  <tr key={c.code} data-testid="mapping-row">
                    <td>{c.name}</td>
                    <td className="mono">{c.roomTypeId}</td>
                    <td className="mono">{c.ratePlanId}</td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </div>
      </details>
    </div>
  );
}

const PLAN_STATUS = {
  full: 'Выгружается',
  partial: 'Не во всех категориях',
  none: 'В каналы не выгружается',
} as const;

function InventoryFailed() {
  return (
    <Alert boxed tone="warning" data-testid="inventory-failed">
      Сводка фонда не загрузилась: категории ниже подписаны кодами, несопоставленные не видны.
      Сопоставления читаются отдельно и верны.
    </Alert>
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
  const notConnected = !connection?.apiConfigured || !connection.propertyAccessible;
  const tone =
    !outbox || notConnected
      ? 'warn'
      : outbox.failed > 0 || stalledMinutes >= 10
        ? 'alarm'
        : outbox.pending > 0
          ? 'warn'
          : 'calm';
  const summaryWord = !connection
    ? 'Не удалось проверить подключение каналов.'
    : notConnected
      ? 'Каналы не подключены. Обмен с OTA не подтверждён.'
      : !outbox
        ? 'Сводка очереди не загрузилась.'
        : outbox.failed > 0
          ? `Ошибок отправки: ${outbox.failed}. Проверьте журнал.`
          : stalledMinutes >= 10
            ? `Очередь ожидает ${stalledMinutes} мин. Проверьте отправку.`
            : outbox.pending > 0
              ? 'Изменения ждут отправки в менеджер каналов.'
              : connection.environment !== 'production'
                ? 'Тестовый контур. Ожидающих заданий нет; обмен с рабочими OTA не подтверждён.'
                : 'Ожидающих заданий нет. Результаты обмена смотрите в журнале.';
  const lastInbound =
    [connection?.lastWebhookAt, connection?.lastPullAt]
      .filter((x): x is string => !!x)
      .sort()
      .at(-1) ?? null;
  const kindState = (kind: OutboxRow['kind']) => {
    const ofKind = (allRows ?? []).filter((r) => r.kind === kind);
    const failed = ofKind.filter((r) => r.status === 'FAILED').length;
    const pending = ofKind.filter((r) => r.status === 'PENDING').length;
    const lastSent =
      ofKind
        .filter((r) => r.sentAt)
        .map((r) => r.sentAt as string)
        .sort()
        .at(-1) ?? null;
    return { failed, pending, lastSent };
  };
  return (
    <div className="stack">
      {!loadedOutbox.ok && <LoadError testId="outbox-error" {...loadErrorProps(loadedOutbox.e)} />}
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
          <SectionTitle id="outbox-title">Очередь в каналы</SectionTitle>
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
      «Отправить очередь сейчас» и проверьте ключ менеджера каналов.
    </Alert>
  );
}
