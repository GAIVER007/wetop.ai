import Link from 'next/link';
import { api, channelsApi } from '../../lib/api';
import { hotelApi, hotelClock, hotelToday, plusDays, sourceNames } from '../../lib/hotel-api';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import {
  Alert,
  Badge,
  EmptyState,
  Fact,
  Grid,
  Help,
  Panel,
  SectionTitle,
  StateBar,
  StateFact,
} from '../../components/ui';
import { Icon } from '../../components/icon';
import { pluralRu } from '../../lib/plural';
import '../directory.css';

/** Окно компактной сводки источников: последние 30 дней по дате заезда (ТЗ §2, §21) */
const REPORT_DAYS = 30;

/** Ответ API как есть или причина отказа: экран остаётся, вместо данных — сбой со следующим шагом (D4) */
const settle = <T,>(p: Promise<T>) =>
  p.then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => ({ ok: false as const, e }),
  );

/**
 * «Каналы продаж» — обзор состояния интеграции (CH1, ADR-106, `plans/tz-channels-2026-09-27.md`):
 * работает ли обмен с каналами, сопоставлены ли категории и тарифы, есть ли очередь и ошибки, и где
 * это чинится. Аналитического фильтра периода здесь нет — отчёт по источникам за произвольный период
 * живёт в «Аналитика → Источники продаж». Действий на обзоре тоже нет: кнопки очереди, webhook и
 * повторного разбора остаются на `/channels`, их `data-testid` заморожены сертификацией Channex.
 * Пороги — существующие: застой очереди ≥ 10 минут (T6, как на `/channels`), новых правил нет.
 */
export default async function ChannelOverviewPage() {
  const clock = await hotelClock();
  const to = await hotelToday();
  const from = plusDays(to, -(REPORT_DAYS - 1));
  const [loadedOutbox, loadedMapping, connection, webhook, failedEvents, summary, loadedReport] =
    await Promise.all([
      settle(channelsApi.outbox()),
      settle(channelsApi.mapping()),
      channelsApi.connection().catch(() => null),
      channelsApi.webhookStatus().catch(() => null),
      channelsApi.events({ limit: 1, status: 'FAILED' }).catch(() => null),
      api.inventorySummary().catch(() => null),
      settle(hotelApi.channelReport(from, to, 'ALL')),
    ]);
  const outbox = loadedOutbox.ok ? loadedOutbox.r : null;
  const mapping = loadedMapping.ok ? loadedMapping.r : null;
  const property = mapping?.find((m) => !m.providerRoomTypeId) ?? null;
  const mappedCategories = mapping
    ? new Set(
        mapping
          .filter((m) => m.providerRoomTypeId)
          .map((m) => m.localAccommodationTypeCode ?? m.id),
      ).size
    : null;
  const mappedRatePlans = mapping
    ? new Set(
        mapping
          .filter((m) => m.providerRatePlanId)
          .map((m) => m.localRatePlanCode ?? m.localRatePlanId ?? m.id),
      ).size
    : null;
  const totalCategories = summary ? summary.byCategory.length : null;
  const unmapped =
    mappedCategories !== null && totalCategories !== null
      ? Math.max(0, totalCategories - mappedCategories)
      : null;
  const failedInbox = failedEvents ? failedEvents.total : null;
  const stalledMinutes = outbox?.oldestPendingAt
    ? Math.floor((Date.now() - Date.parse(outbox.oldestPendingAt)) / 60_000)
    : 0;

  // «Требует внимания»: очередь реальных проблем, каждая ведёт туда, где её чинят (ТЗ §3, §10)
  const troubles: Array<{
    key: string;
    tone: 'alarm' | 'warn';
    text: string;
    href: string;
    action: string;
  }> = [];
  if (outbox && outbox.failed > 0)
    troubles.push({
      key: 'outbox-failed',
      tone: 'alarm',
      text: `Ошибок отправки ${outbox.failed} — каналы продают по старому остатку.`,
      href: '/channels?queue=FAILED',
      action: 'Открыть очередь',
    });
  if (outbox && stalledMinutes >= 10)
    troubles.push({
      key: 'outbox-stuck',
      tone: 'alarm',
      text: `Очередь стоит ${stalledMinutes} мин — каналы продают по старому остатку.`,
      href: '/channels',
      action: 'Открыть синхронизацию',
    });
  if (connection && connection.apiConfigured && !connection.propertyAccessible)
    troubles.push({
      key: 'connection',
      tone: 'alarm',
      text: `${connection.message}.`,
      href: '/connections',
      action: 'Открыть интеграции',
    });
  if (connection && !connection.apiConfigured)
    troubles.push({
      key: 'no-key',
      tone: 'warn',
      text: 'Ключ Channex на сервере не задан — обмен с каналами выключен.',
      href: '/connections',
      action: 'Открыть интеграции',
    });
  if (failedInbox !== null && failedInbox > 0)
    troubles.push({
      key: 'inbox',
      tone: 'warn',
      text: `${pluralRu(failedInbox, ['входящее событие', 'входящих события', 'входящих событий'])} с ошибкой — нужен разбор вручную.`,
      href: '/channels?status=FAILED',
      action: 'Разобрать',
    });
  if (mapping && !property)
    troubles.push({
      key: 'no-property',
      tone: 'warn',
      text: 'Объект в Channex не создан — цены и остатки в каналы не уходят.',
      href: '/channels',
      action: 'Настроить',
    });
  else if (unmapped !== null && unmapped > 0)
    troubles.push({
      key: 'unmapped',
      tone: 'warn',
      text: `Без сопоставления ${pluralRu(unmapped, ['категория', 'категории', 'категорий'])} — их продажи в каналы не синхронизируются.`,
      href: '/channels',
      action: 'Сопоставить',
    });
  const webhookTrouble = !webhook
    ? null
    : webhook.registered && webhook.expectedUrl && webhook.callbackUrl !== webhook.expectedUrl
      ? 'Webhook зарегистрирован не на постоянный адрес PMS — события уходят не туда.'
      : webhook.registered && webhook.callbackReachable === false
        ? 'Адрес webhook не отвечает — брони подберёт опрос ленты, но webhook надо поднять.'
        : !webhook.registered && webhook.expectedUrl
          ? 'Webhook в Channex не зарегистрирован — брони приходят только опросом ленты.'
          : null;
  if (webhookTrouble)
    troubles.push({
      key: 'webhook',
      tone: 'warn',
      text: webhookTrouble,
      href: '/channels',
      action: 'Настроить webhook',
    });

  // Полоса здоровья: тревога > внимание > спокойно; сбой загрузки не выдаётся за порядок (D4)
  const nothingLoaded = !outbox && !mapping && !connection;
  const partlyUnknown =
    !loadedOutbox.ok || !loadedMapping.ok || !connection || !webhook || !failedEvents || !summary;
  const hasAlarm = troubles.some((t) => t.tone === 'alarm');
  const tone = nothingLoaded ? 'warn' : hasAlarm ? 'alarm' : troubles.length || partlyUnknown ? 'warn' : 'calm';
  const health = nothingLoaded
    ? 'Состояние неизвестно'
    : hasAlarm
      ? 'Есть ошибки'
      : troubles.length || partlyUnknown
        ? 'Требует внимания'
        : 'Все каналы работают';
  const healthSummary = nothingLoaded
    ? 'Состояние каналов не загрузилось — обновите страницу.'
    : troubles.length
      ? `Проблем: ${troubles.length} — список ниже ведёт туда, где их чинят.`
      : partlyUnknown
        ? 'Часть состояния не загрузилась — цифры могут быть неполными.'
        : 'Очередь пуста, входящие разобраны, сопоставления на месте.';

  // Компактные источники за 30 дней: доли по числу броней, деньги двух валют в долю не складываются
  const bySource = new Map<string, number>();
  let reportTotal = 0;
  if (loadedReport.ok)
    for (const row of loadedReport.r.rows) {
      const label = row.channel ?? sourceNames[row.source] ?? row.source;
      bySource.set(label, (bySource.get(label) ?? 0) + row.count);
      reportTotal += row.count;
    }
  const topSources = [...bySource].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const restCount = reportTotal - topSources.reduce((n, [, count]) => n + count, 0);
  const sourcesHref = `/analytics/sources?from=${from}&to=${to}&status=ALL`;
  const notConnected =
    !!connection && !connection.apiConfigured && !!mapping && mapping.length === 0;

  return (
    <Page title="Каналы продаж" subtitle="Состояние подключений, сопоставлений и синхронизации.">
      {!loadedOutbox.ok && (
        <LoadError testId="overview-outbox-error" {...loadErrorProps(loadedOutbox.e)} />
      )}
      {!loadedMapping.ok && (
        <LoadError testId="overview-mapping-error" {...loadErrorProps(loadedMapping.e)} />
      )}
      <StateBar
        className="state-bar--wide"
        tone={tone}
        label="Каналы"
        value={<span data-testid="overview-health">{health}</span>}
        summary={healthSummary}
      >
        <StateFact
          label="В очереди"
          value={<span data-testid="overview-pending">{outbox ? String(outbox.pending) : '—'}</span>}
        >
          <span className="state-bar__sub">
            {outbox?.lastSentAt
              ? `последняя отправка ${clock.full(outbox.lastSentAt)}`
              : outbox
                ? 'отправок ещё не было'
                : 'сводка не загрузилась'}
          </span>
        </StateFact>
        <StateFact
          label="Ошибок отправки"
          value={<span data-testid="overview-failed">{outbox ? String(outbox.failed) : '—'}</span>}
        />
        <StateFact
          label="Требуют разбора"
          value={
            <span data-testid="overview-inbox">
              {failedInbox === null ? '—' : String(failedInbox)}
            </span>
          }
        >
          <span className="state-bar__sub">входящие события с ошибкой</span>
        </StateFact>
        <StateFact
          label="Без сопоставления"
          value={
            <span data-testid="overview-unmapped">{unmapped === null ? '—' : String(unmapped)}</span>
          }
        >
          <span className="state-bar__sub">
            {totalCategories === null ? 'категории не загрузились' : `из ${totalCategories} категорий объекта`}
          </span>
        </StateFact>
      </StateBar>
      {troubles.length > 0 && (
        <section
          className="stack stack--sm"
          aria-labelledby="overview-troubles-title"
          data-testid="overview-troubles"
        >
          <SectionTitle id="overview-troubles-title">Требует внимания</SectionTitle>
          {troubles.map((t) => (
            <Alert key={t.key} boxed tone={t.tone === 'alarm' ? undefined : 'warning'}>
              {t.text} <Link href={t.href}>{t.action}</Link>
            </Alert>
          ))}
        </section>
      )}
      <div className="cols-2">
        <section className="stack stack--sm" aria-labelledby="overview-connection-title">
          <SectionTitle id="overview-connection-title">Подключения</SectionTitle>
          {notConnected ? (
            <EmptyState
              icon={<Icon name="channels" />}
              title="Каналы ещё не подключены"
              data-testid="overview-not-connected"
              actions={
                <Link href="/connections" className="btn btn--secondary">
                  Открыть интеграции
                </Link>
              }
            >
              Booking.com, Agoda и другие OTA подключаются через Channex. Партнёров подключаем
              вручную — напишите нам, когда будете готовы.
            </EmptyState>
          ) : (
            <Panel title="Channex" data-testid="overview-connection">
              {connection ? (
                <>
                  <Badge tone={connection.propertyAccessible ? 'ok' : 'warn'}>
                    {connection.message}
                  </Badge>
                  <Grid min={150}>
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
                      label="Сопоставлено категорий"
                      value={
                        mappedCategories === null
                          ? '—'
                          : `${mappedCategories} из ${totalCategories ?? '—'}`
                      }
                    />
                    <Fact
                      label="Тарифных планов"
                      value={mappedRatePlans === null ? '—' : String(mappedRatePlans)}
                    />
                    <Fact
                      label="Последний webhook, по Алматы"
                      value={clock.local(connection.lastWebhookAt)}
                    />
                    <Fact
                      label="Последний импорт, по Алматы"
                      value={clock.local(connection.lastPullAt)}
                    />
                    <Fact
                      label="Последняя отправка, по Алматы"
                      value={outbox ? clock.local(outbox.lastSentAt) : '—'}
                    />
                  </Grid>
                </>
              ) : (
                <Alert>Подключение Channex не проверилось — состояние карточки неизвестно.</Alert>
              )}
              <Link className="btn btn--secondary" href="/channels">
                Открыть синхронизацию
              </Link>
            </Panel>
          )}
        </section>
        <section
          className="stack stack--sm"
          aria-labelledby="overview-sources-title"
          data-testid="overview-sources"
        >
          <SectionTitle id="overview-sources-title">Источники за 30 дней</SectionTitle>
          {loadedReport.ok ? (
            <Panel>
              {topSources.length > 0 ? (
                <ul className="overview-sources">
                  {topSources.map(([label, count]) => (
                    <li key={label}>
                      <span>{label}</span>
                      <span className="num">
                        {pluralRu(count, ['бронь', 'брони', 'броней'])} ·{' '}
                        {reportTotal ? Math.round((count / reportTotal) * 100) : 0}%
                      </span>
                    </li>
                  ))}
                  {restCount > 0 && (
                    <li>
                      <span>Другие источники</span>
                      <span className="num">
                        {pluralRu(restCount, ['бронь', 'брони', 'броней'])} ·{' '}
                        {reportTotal ? Math.round((restCount / reportTotal) * 100) : 0}%
                      </span>
                    </li>
                  )}
                </ul>
              ) : (
                <p className="note">Броней с заездом за последние 30 дней нет.</p>
              )}
              <Link className="btn btn--secondary" href={sourcesHref}>
                Подробнее в аналитике
              </Link>
            </Panel>
          ) : (
            <LoadError testId="sources-summary-error" {...loadErrorProps(loadedReport.e)} />
          )}
        </section>
      </div>
      <Help title="Что показывает этот экран">
        Состояние обмена с каналами: подключение, сопоставления, очередь и ошибки. Действия —
        очередь, webhook, повторный разбор событий — на экране{' '}
        <Link href="/channels">«Синхронизация»</Link>. Отчёт по броням и стоимости за произвольный
        период — в <Link href={sourcesHref}>«Аналитика → Источники продаж»</Link>; доли выше
        считаются по числу броней за последние 30 дней, валюты не смешиваются.
      </Help>
    </Page>
  );
}
