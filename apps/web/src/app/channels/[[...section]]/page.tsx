import { requireFeature } from '../../../lib/vertical-guard';
import { ChannelConnectionSetup } from '../connection-setup';
import Link from 'next/link';
import { notFound, redirect, unstable_rethrow } from 'next/navigation';
import {
  type OutboxRow,
  type OutboxRowStatus,
  type OutboxSummary,
  api,
  channelsApi,
  guardApi,
  ratesApi,
} from '../../../lib/api';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { Page, BackCrumb } from '../../../components/page';
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
import { connectionSummary, eventTime, reconciliationView, webhookWord } from '../format';
import { ChannelReport } from '../report';
import { ChannelList } from '../channel-list';
import { categoryMappings, planMappings } from '../mapping';
import { Icon } from '../../../components/icon';
import '../../directory.css';
import '../channels.css';
import { deskShell } from '../../../lib/desk-shell';
import { mayAccess } from '../../../lib/navigation';
import { CHANNEL_TABS, ChannelTabs } from '../tabs';
import { msg, type Translate } from '../../../i18n';
import { currentLocale, serverT } from '../../../i18n/server';

/**
 * Модуль «Каналы продаж» (ADR-112, поручение владельца 27.09.2026): один вход вместо пунктов
 * «Менеджер каналов» и «Синхронизация каналов». Обзор отвечает управляющему («обмен работает?
 * сколько броней принесли каналы?»), технический слой — очередь, payload, попытки, внутренние ID —
 * раскрывается «Техническими деталями» и живёт на вкладках «Синхронизация» и «События»; опасные
 * ручные команды — в «Настройке подключения» на вкладке «Подключения», только владельцу.
 * Вкладки: общий `Tabs` (`channels/tabs.tsx`); команды, их `data-testid` и порядок
 * не менялись — на них стоит запись показа для сертификации Channex.
 */
const subtitles: Record<string, string> = {
  '': msg('Состояние обмена с каналами и брони по источникам.'),
  list: msg('Подключённые каналы, брони за 30 дней и все каналы, которые можно подключить.'),
  connections: msg('Подключение менеджера каналов и настройка обмена.'),
  mapping: msg('Категории и тарифы WETOP в менеджере каналов.'),
  sync: msg('Что уходит в каналы и что приходит обратно.'),
  events: msg('Входящие события каналов: новые брони, изменения, отмены.'),
};

/** Ответ API как есть или причина отказа: экран остаётся, вместо данных — сбой со следующим шагом (D4) */
const settle = <T,>(p: Promise<T>) =>
  p.then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => {
      unstable_rethrow(e);
      return { ok: false as const, e };
    },
  );

/**
 * «, проверено 14:22 по Алматы» — время последней пробы адреса webhook по часам объекта (С-13: сервер стойки
 * может стоять не в поясе объекта); без пробы подпись не нужна
 */
const checkedAt = (iso: string | null | undefined, clock: PropertyClock, t: Translate) =>
  iso ? t(', проверено {time} по времени объекта', { time: clock.clock(iso) }) : '';

export default async function ChannelSalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  await requireFeature('/channels');
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
  const tab = CHANNEL_TABS.find((item) => item.view === view);
  if (!tab) notFound();
  const shell = await deskShell();
  const canMutate = mayAccess(shell.access, 'channels') && !shell.readOnly;
  const t = await serverT();
  return (
    <Page
      title={view ? t(tab.label) : t('Каналы продаж')}
      subtitle={view && subtitles[view] ? t(subtitles[view]!) : undefined}
      crumbs={view ? <BackCrumb href="/channels">{t('Каналы продаж')}</BackCrumb> : undefined}
      actions={view === 'connections' ? <RefreshButton label={t('Проверить соединение')} /> : undefined}
    >
      <ChannelTabs current={view} />
      {view === '' && <Overview sp={sp} canMutate={canMutate} />}
      {view === 'list' && <ChannelList sp={sp} />}
      {view === 'connections' && <ChannelConnectionSetup canMutate={canMutate} />}
      {view === 'mapping' && <Mapping />}
      {view === 'sync' && <Sync queue={queueFilter(sp.queue)} canMutate={canMutate} />}
      {view === 'events' && <Events sp={sp} canMutate={canMutate} />}
    </Page>
  );
}

const queueFilter = (raw: string | undefined): OutboxRowStatus | '' =>
  raw === 'PENDING' || raw === 'FAILED' ? raw : '';

/* ── Обзор: работает ли обмен и что каналы принесли ── */

async function Overview({
  sp,
  canMutate,
}: {
  sp: Record<string, string | undefined>;
  canMutate: boolean;
}) {
  const clock = await hotelClock();
  const t = await serverT();
  const locale = await currentLocale();
  const [
    connection,
    webhook,
    loadedOutbox,
    failedEvents,
    recentEvents,
    summaryFund,
    reconciliation,
  ] = await Promise.all([
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
    // X3 (ADR-144): сверка остатков у сторожа; чужой организации и без права — 403, тогда «не известно»
    guardApi.reconciliation().catch(() => null),
  ]);
  const outbox = loadedOutbox.ok ? loadedOutbox.r : null;
  const stalledMinutes = outbox?.oldestPendingAt
    ? Math.floor((Date.now() - Date.parse(outbox.oldestPendingAt)) / 60_000)
    : 0;
  const notConnected = !connection?.propertyAccessible;
  const oversold = !!reconciliation?.mismatch;
  const alarm =
    (outbox?.failed ?? 0) > 0 || stalledMinutes >= 10 || (failedEvents ?? 0) > 0 || oversold;
  const tone = alarm ? 'alarm' : !outbox || notConnected || outbox.pending > 0 ? 'warn' : 'calm';
  const word = notConnected
    ? t('не подключены')
    : alarm
      ? t('требует внимания')
      : !outbox
        ? t('неизвестно')
        : connection?.environment === 'staging'
          ? t('тестовый контур')
          : !webhook?.registered || !webhook?.active
            ? t('настройка не завершена')
            : t('API доступен');
  const summary = notConnected
    ? connectionSummary(connection?.state, connection?.message, t)
    : !outbox
      ? t('Сводка очереди не загрузилась, обновите страницу.')
      : outbox.failed > 0
        ? t('Ошибок отправки {n}: каналы продают по старому остатку.', { n: outbox.failed })
        : stalledMinutes >= 10
          ? t('Очередь стоит {n} мин: каналы продают по старому остатку.', { n: stalledMinutes })
          : (failedEvents ?? 0) > 0
            ? t('Входящая бронь требует разбора: откройте «События».')
            : oversold
              ? t('Канал видит больше мест, чем есть: сторож запустил полную выгрузку остатков.')
              : outbox.pending > 0
                ? t('Изменения ждут отправки в каналы.')
                : connection?.environment === 'staging'
                  ? t('Менеджер каналов: тестовое подключение.')
                  : t('Доступ к объекту проверен. Получение броней: в журнале событий.');
  const lastExchange =
    [outbox?.lastSentAt, connection?.lastWebhookAt, connection?.lastPullAt]
      .filter((x): x is string => !!x)
      .sort()
      .at(-1) ?? null;
  const failedTotal = (outbox?.failed ?? 0) + (failedEvents ?? 0);
  // X3 (ADR-144): ежедневная сверка остатков с каналом видна владельцу, не только сторожу
  const reconcile = reconciliationView(reconciliation, clock, Date.now(), t, locale);
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
        label={t('Обмен с каналами')}
        value={<span data-testid="channels-state">{word}</span>}
        summary={summary}
      >
        <StateFact label={t('Последний обмен')} value={eventTime(lastExchange, clock)}>
          {/* X3 (ADR-144): ежедневная сверка остатков с каналом видна владельцу; подробности в подсказке */}
          {!notConnected && (
            <span
              className={`state-bar__sub${reconcile.tone === 'danger' ? ' danger-text' : ''}`}
              title={reconcile.sub}
              data-testid="channels-reconcile-sub"
            >
              {t('сверка:')}{' '}
              <span data-testid="channels-reconcile" data-tone={reconcile.tone}>
                {reconcile.value}
              </span>
            </span>
          )}
        </StateFact>
        <StateFact
          label={t('Очередь')}
          value={outbox ? <span data-testid="outbox-pending">{String(outbox.pending)}</span> : '—'}
        >
          {outbox && outbox.pending === 0 && (
            <span className="state-bar__sub">{t('нет ожидающих отправки')}</span>
          )}
        </StateFact>
        <StateFact
          label={t('Ошибки')}
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
              {t('в отправке {sent}, во входящих {inbound}', {
                sent: outbox?.failed ?? 0,
                inbound: failedEvents ?? 0,
              })}
            </span>
          )}
        </StateFact>
        <StateFact
          label={t('Приём броней')}
          value={
            <span data-testid="webhook-status">{webhookWord(webhook, t)}</span>
          }
        >
          {webhook?.registered &&
            webhook.expectedUrl &&
            webhook.callbackUrl !== webhook.expectedUrl && (
              <span className="state-bar__sub danger-text">
                {t('зарегистрирован не постоянный адрес PMS: проверьте на «Подключениях»')}
              </span>
            )}
          {webhook?.registered && webhook.callbackReachable === false && (
            <span className="state-bar__sub danger-text">
              {t('адрес не отвечает{checked}', { checked: checkedAt(webhook.callbackCheckedAt, clock, t) })}
            </span>
          )}
        </StateFact>
      </StateBar>
      {outbox && alarm && (
        <Alert boxed data-testid="overbooking-alarm">
          {oversold && <div>{t('Сверка: {details}.', { details: reconcile.sub })}</div>}
          <div>
            {t('Остатки могут быть неактуальны.')} <Link href="/channels/sync">{t('Проверить очередь')}</Link> ·{' '}
            <Link href="/channels/events?status=FAILED">{t('Ошибки входящих')}</Link>
          </div>
        </Alert>
      )}
      <ChannelReport sp={sp} />
      <details className="context-help" data-testid="channels-activity">
        <summary>{t('Активность каналов и ручной обмен')}</summary>
        <section className="stack stack--sm" aria-labelledby="observed-title">
          <SectionTitle id="observed-title">{t('Каналы')}</SectionTitle>
          <p className="note">
            {t('Наблюдаются по входящим событиям каналов: это последняя активность источника, а не состояние его подключения.')}
          </p>
          {recentEvents === null ? (
            <p className="note" data-testid="observed-failed">
              {t('События не загрузились: API не ответил. Обновите страницу или откройте')}{' '}
              <Link href="/incidents">{t('неисправности')}</Link>.
            </p>
          ) : observedRows.length === 0 ? (
            <p className="note" data-testid="observed-empty">
              {t('Событий от каналов ещё не было. Канал появится здесь, когда придёт его бронь, изменение или отмену.')}
            </p>
          ) : (
            <Table size="sm" className="dir-table" data-testid="channels-observed">
              <thead>
                <tr>
                  {[msg('Канал'), msg('Последнее событие'), msg('Событий с ошибкой')].map((h) => (
                    <th key={h}>{t(h)}</th>
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
                {t('Сопоставлены не все категории: {mapped} из {total}, по остальным цены и остатки в каналы не уходят. Проверить:', {
                  mapped: mappedCategories,
                  total: fundCategories ?? 0,
                })}{' '}
                <Link href="/channels/mapping">«{t('Сопоставление')}»</Link>.
              </p>
            ) : (
              <p className="note" data-testid="mapping-note">
                {t('Сопоставление общее для всех каналов: категорий {categories}, тарифных планов {plans}, сопоставлений тарифов {mappings}.', {
                  categories:
                    fundCategories !== null
                      ? t('{mapped} из {total}', { mapped: mappedCategories, total: fundCategories })
                      : mappedCategories,
                  plans: connection?.mappedLocalRatePlans ?? t('неизвестно'),
                  mappings: connection?.mappedRatePlans ?? t('неизвестно'),
                })}
              </p>
            ))}
        </section>
        {canMutate && (
          <ChannelButtons group="exchange" connected={!!connection?.propertyAccessible} canMutate />
        )}
      </details>
      <details className="context-help" data-testid="channels-tech">
        <summary>{t('Технические детали')}</summary>
        <div>
          <Grid min={200}>
            <Fact
              label={t('Объект в менеджере каналов')}
              value={
                connection?.propertyId ? (
                  <span className="mono break-all">{connection.propertyId}</span>
                ) : (
                  t('не создан')
                )
              }
            />
            <Fact
              label={t('Последняя задача')}
              value={
                <span className="mono break-all" data-testid="outbox-last-task">
                  {outbox ? (outbox.lastTaskId ?? '—') : t('не загрузилось')}
                </span>
              }
            />
            <Fact
              label={t('Адрес webhook')}
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
            {t('Очередь отправки: на вкладке')} <Link href="/channels/sync">«{t('Синхронизация')}»</Link>
            {t(', журнал входящих: в')} <Link href="/channels/events">«{t('Событиях')}»</Link>.
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
  const t = await serverT();
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
          title={t('Сопоставлений пока нет')}
          data-testid="mapping-empty"
          actions={
            <Link href="/channels/connections" className="btn btn--secondary">
              {t('Открыть подключения')}
            </Link>
          }
        >
          {t('Категории и тарифы появятся здесь, когда владелец организации нажмёт «Создать объект и категории» на вкладке «Подключения». Пока их нет, цены и остатки в каналы не уходят.')}
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
          {t('Без сопоставления: {names}.', { names: unmapped.map((c) => c.name).join(', ') })}{' '}
          {unmapped.length === 1
            ? t('Остатки и цены по этой категории в каналы не уходят.')
            : t('Остатки и цены по этим категориям в каналы не уходят.')}{' '}
          {t('Недостающее создаёт владелец организации кнопкой «Создать объект и категории» на вкладке')}{' '}
          <Link href="/channels/connections">«{t('Подключения')}»</Link>
          {t('; уже сопоставленное повтор не трогает.')}
        </Alert>
      )}
      <section className="stack stack--sm" aria-labelledby="mapping-categories-title">
        <SectionTitle id="mapping-categories-title">{t('Категории')}</SectionTitle>
        <Table
          size="sm"
          className="dir-table dir-table--mapping"
          data-testid="mapping-categories"
          aria-label={t('Сопоставление категорий')}
        >
          <thead>
            <tr>
              <th>{t('Категория WETOP')}</th>
              <th>{t('Номер в каналах')}</th>
              <th>{t('Статус')}</th>
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
                      <span className="cell-sub">{t('название в каналах недоступно')}</span>
                    ))
                  ) : (
                    <span className="cell-sub">—</span>
                  )}
                </td>
                <td>
                  <Badge tone={c.roomTypeId ? 'ok' : 'warn'}>
                    {c.roomTypeId ? t('Сопоставлена') : t('Не сопоставлена')}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
      <section className="stack stack--sm" aria-labelledby="mapping-rate-plans-title">
        <SectionTitle id="mapping-rate-plans-title">{t('Тарифы')}</SectionTitle>
        {plans ? (
          <Table
            size="sm"
            className="dir-table dir-table--mapping"
            data-testid="mapping-rate-plans"
            aria-label={t('Сопоставление тарифов')}
          >
            <thead>
              <tr>
                <th>{t('Тариф WETOP')}</th>
                <th>{t('Сопоставлен в категориях')}</th>
                <th>{t('Статус')}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.code}>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="cell-sub">
                      {p.currency}
                      {p.active ? '' : t(', не действует')}
                    </div>
                  </td>
                  <td className="num">
                    {t('{mapped} из {total}', { mapped: p.mappedIn, total: categories.length })}
                  </td>
                  <td>
                    <Badge
                      tone={p.status === 'none' ? 'neutral' : p.status === 'full' ? 'ok' : 'warn'}
                    >
                      {t(PLAN_STATUS[p.status])}
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
          {t('Сопоставлено тарифов: {n}. Покрытие категорий показано отдельно для каждого тарифа. Тарифы без сопоставлений доступны только в WETOP. Сопоставление само по себе не подтверждает подключение OTA или успешную передачу цен.', {
            n: new Set(
              mapping
                .filter((m) => m.providerRatePlanId && m.localRatePlanId)
                .map((m) => m.localRatePlanId),
            ).size,
          })}
        </p>
      </section>
      <details className="context-help" data-testid="mapping-tech">
        <summary>{t('Технические детали')}</summary>
        <div>
          <Table size="sm" className="dir-table dir-table--mapping">
            <thead>
              <tr>
                {[msg('Категория'), msg('Номер в каналах'), msg('Тариф в каналах')].map((h) => (
                  <th key={h}>{t(h)}</th>
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
  full: msg('Выгружается'),
  partial: msg('Не во всех категориях'),
  none: msg('В каналы не выгружается'),
} as const;

async function InventoryFailed() {
  const t = await serverT();
  return (
    <Alert boxed tone="warning" data-testid="inventory-failed">
      {t('Сводка фонда не загрузилась: категории ниже подписаны кодами, несопоставленные не видны. Сопоставления читаются отдельно и верны.')}
    </Alert>
  );
}

/* ── Синхронизация: актуальны ли остатки, цены и брони; техника — раскрывашкой ── */

const SYNC_KINDS = [
  ['AVAILABILITY', msg('Остатки')],
  ['RESTRICTIONS', msg('Цены и ограничения')],
] as const;

async function Sync({ queue, canMutate }: { queue: OutboxRowStatus | ''; canMutate: boolean }) {
  const clock = await hotelClock();
  const t = await serverT();
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
    ? t('Не удалось проверить подключение каналов.')
    : notConnected
      ? t('Каналы не подключены. Обмен с OTA не подтверждён.')
      : !outbox
        ? t('Сводка очереди не загрузилась.')
        : outbox.failed > 0
          ? t('Ошибок отправки: {n}. Проверьте журнал.', { n: outbox.failed })
          : stalledMinutes >= 10
            ? t('Очередь ожидает {n} мин. Проверьте отправку.', { n: stalledMinutes })
            : outbox.pending > 0
              ? t('Изменения ждут отправки в менеджер каналов.')
              : connection.environment !== 'production'
                ? t('Тестовый контур. Ожидающих заданий нет; обмен с рабочими OTA не подтверждён.')
                : t('Ожидающих заданий нет. Результаты обмена смотрите в журнале.');
  const lastInbound =
    [connection?.lastWebhookAt, connection?.lastPullAt]
      .filter((x): x is string => !!x)
      .sort()
      .at(-1) ?? null;
  const inboundLabel = !connection
    ? t('Не проверено')
    : notConnected
      ? t('Не подключено')
      : connection.environment !== 'production'
        ? t('Тестовый контур')
        : lastInbound
          ? t('События получены')
          : t('Событий ещё нет');
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
        label={t('В очереди')}
        value={
          outbox ? <span data-testid="sync-pending">{String(outbox.pending)}</span> : t('Неизвестно')
        }
        summary={summaryWord}
      >
        <StateFact
          label={t('Отправлено')}
          value={
            outbox ? (
              <>
                <span data-testid="sync-sent">{String(outbox.sent)}</span>
                {outbox.failed > 0 ? (
                  <span className="danger-text">{t(', ошибок {n}', { n: outbox.failed })}</span>
                ) : (
                  t(', ошибок нет')
                )}
              </>
            ) : (
              t('Неизвестно')
            )
          }
        >
          <span className="state-bar__sub">
            {outbox?.lastSentAt
              ? t('последняя {time}', { time: eventTime(outbox.lastSentAt, clock) })
              : outbox
                ? t('ещё не было')
                : t('сводка не загрузилась')}
          </span>
        </StateFact>
        <StateFact
          label={t('Входящие брони')}
          value={
            failedEvents === null ? (
              t('не загрузилось')
            ) : failedEvents > 0 ? (
              <span className="danger-text">{t('требуют разбора: {n}', { n: failedEvents })}</span>
            ) : (
              inboundLabel
            )
          }
        >
          <span className="state-bar__sub">
            {lastInbound
              ? t('последняя {time}', { time: eventTime(lastInbound, clock) })
              : t('ещё не приходили')}
          </span>
        </StateFact>
      </StateBar>
      {outbox && <OverbookingAlarm outbox={outbox} />}
      <Table size="sm" className="dir-table" data-testid="sync-kinds">
        <thead>
          <tr>
            {[msg('Что'), msg('Состояние'), msg('Последняя отправка')].map((h) => (
              <th key={h}>{t(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SYNC_KINDS.map(([kind, label]) => {
            const s = kindState(kind);
            return (
              <tr key={kind} data-testid={`sync-kind-${kind}`}>
                <td>{t(label)}</td>
                <td>
                  {allRows === null ? (
                    t('Неизвестно')
                  ) : s.failed > 0 ? (
                    <Badge tone="danger">{t('ошибка')}</Badge>
                  ) : s.pending > 0 ? (
                    <Badge tone="info">{t('в очереди: {n}', { n: s.pending })}</Badge>
                  ) : (
                    <Badge tone="info">
                      {!connection
                        ? t('Не проверено')
                        : notConnected
                          ? t('Не подключено')
                          : connection.environment !== 'production'
                            ? t('Тестовый контур')
                            : s.lastSent
                              ? t('Отправлено в менеджер')
                              : t('Не отправлялось')}
                    </Badge>
                  )}
                </td>
                <td className="nowrap">{eventTime(s.lastSent, clock)}</td>
              </tr>
            );
          })}
          <tr data-testid="sync-kind-BOOKINGS">
            <td>{t('Брони из каналов')}</td>
            <td>
              {failedEvents === null ? (
                t('Неизвестно')
              ) : failedEvents > 0 ? (
                <>
                  <Badge tone="danger">{t('требуют разбора: {n}', { n: failedEvents })}</Badge>{' '}
                  <Link href="/channels/events?status=FAILED">{t('к событиям')}</Link>
                </>
              ) : (
                <Badge tone="info">{inboundLabel}</Badge>
              )}
            </td>
            <td className="nowrap">{eventTime(lastInbound, clock)}</td>
          </tr>
        </tbody>
      </Table>
      {canMutate && (
        <ChannelButtons group="exchange" connected={!!connection?.propertyAccessible} canMutate />
      )}
      <details className="context-help" open={queue ? true : undefined} data-testid="sync-tech">
        <summary>{t('Технические детали')}</summary>
        <section className="stack stack--sm" aria-labelledby="outbox-title">
          <SectionTitle id="outbox-title">{t('Очередь в каналы')}</SectionTitle>
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

async function Events({
  sp,
  canMutate,
}: {
  sp: Record<string, string | undefined>;
  canMutate: boolean;
}) {
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
  const t = await serverT();
  return (
    <section className="stack stack--sm" aria-labelledby="events-title">
      <SectionTitle id="events-title">{t('Входящие события')}</SectionTitle>
      <EventsTable data={data} filter={filter} hrefFor={href} canRetry={canMutate} />
    </section>
  );
}

/**
 * T6: канал обязан узнать, что мест нет. Изменения уходят дельтами через очередь; если очередь встала
 * или дала ошибку, каналы продолжают продавать по старому остатку — это прямая дорога к овербукингу.
 * Порог 10 минут: воркер отправляет каждые 5 секунд, лимит Channex — не чаще 6 секунд на вид сообщения.
 */
async function OverbookingAlarm({ outbox }: { outbox: OutboxSummary }) {
  const t = await serverT();
  const staleMinutes = outbox.oldestPendingAt
    ? Math.floor((Date.now() - Date.parse(outbox.oldestPendingAt)) / 60000)
    : 0;
  const stuck = staleMinutes >= 10;
  if (outbox.failed === 0 && !stuck) return null;
  return (
    <Alert boxed data-testid="overbooking-alarm">
      <b>{t('Каналы могут не знать об остатках.')}</b>{' '}
      {outbox.failed > 0 && `${t('Ошибок отправки: {n}.', { n: outbox.failed })} `}
      {stuck && `${t('Самая старая неотправленная дельта ждёт {n} мин.', { n: staleMinutes })} `}
      {t('Пока очередь не разошлась, каналы продают по старому остатку: возможен овербукинг. Нажмите «Отправить очередь сейчас» и проверьте ключ менеджера каналов.')}
    </Alert>
  );
}
