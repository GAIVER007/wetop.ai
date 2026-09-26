import Link from 'next/link';
import { type OutboxRowStatus, type OutboxSummary, api, channelsApi } from '../../lib/api';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { Page } from '../../components/page';
import { Alert, SectionTitle, StateBar, StateFact, Table } from '../../components/ui';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { ChannelButtons } from './buttons';
import { OutboxTable } from './outbox-table';
import { EVENTS_PAGE, EventsTable, type EventsFilter } from './events-table';
import { hotelClock } from '../../lib/hotel-api';
import type { PropertyClock } from '../../lib/property-time';
import { eventTime } from './format';
import '../directory.css';

/**
 * «, проверено 14:22 по Алматы» — время последней пробы адреса webhook по часам объекта (С-13: сервер стойки
 * может стоять не в поясе объекта); без пробы подпись не нужна
 */
const checkedAt = (iso: string | null | undefined, clock: PropertyClock) =>
  iso ? `, проверено ${clock.clock(iso)} по Алматы` : '';

/** Ответ API как есть или причина отказа: экран остаётся, вместо данных — сбой со следующим шагом (D4) */
const settle = <T,>(p: Promise<T>) =>
  p.then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => ({ ok: false as const, e }),
  );

/**
 * Каналы продаж (Channex): состояние, ручные действия, очередь в Channex и входящие события
 * (срез 7.2, макет «Integration»). Фильтры — в адресе, чтобы страницу можно было открыть по ссылке.
 * D4 (план владельца 19.09): отказ сводки очереди или сопоставлений не уносит экран — на их месте
 * `LoadError` с «Повторить загрузку», остальное (webhook, кнопки, строки очереди, события) читается и
 * показывается отдельно; пустые таблицы называют причину и следующий шаг.
 */
export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const clock = await hotelClock();
  const sp = normalizeSearchParams(await searchParams);
  const queue: OutboxRowStatus | '' =
    sp.queue === 'PENDING' || sp.queue === 'FAILED' ? sp.queue : '';
  const events: EventsFilter = {
    status: sp.status ?? '',
    type: sp.type ?? '',
    q: (sp.q ?? '').trim(),
    page: Math.max(1, Number(sp.page) || 1),
  };
  const [loadedMapping, loadedOutbox, summary, webhook, eventsPage, outboxRows, connection] =
    await Promise.all([
      settle(channelsApi.mapping()),
      settle(channelsApi.outbox()),
      // сводка фонда нужна только для названий категорий: без неё страница остаётся, категории — кодами
      api.inventorySummary().catch(() => null),
      channelsApi.webhookStatus().catch(() => null),
      channelsApi
        .events({
          limit: EVENTS_PAGE,
          offset: (events.page - 1) * EVENTS_PAGE,
          status: events.status,
          type: events.type,
          q: events.q,
        })
        .catch(() => null),
      channelsApi.outboxRows(queue || undefined).catch(() => null),
      channelsApi.connection().catch(() => null),
    ]);
  const mapping = loadedMapping.ok ? loadedMapping.r : [];
  const outbox = loadedOutbox.ok ? loadedOutbox.r : null;
  const webhookReady = !!webhook?.expectedUrl && !!webhook?.secretConfigured;
  const byCode = new Map((summary?.byCategory ?? []).map((c) => [c.code, c.name]));
  const categoryName = (code: string) => byCode.get(code) ?? code;
  const mapped = mapping.filter((m) => m.providerRoomTypeId);
  const property = mapping.find((m) => !m.providerRoomTypeId);
  const href = (next: { queue?: OutboxRowStatus | '' } & Partial<EventsFilter>) => {
    const u = new URLSearchParams();
    const q = next.queue ?? queue;
    const f = { ...events, ...next };
    if (q) u.set('queue', q);
    if (f.status) u.set('status', f.status);
    if (f.type) u.set('type', f.type);
    if (f.q) u.set('q', f.q);
    if (f.page > 1) u.set('page', String(f.page));
    const s = u.toString();
    return s ? `/channels?${s}` : '/channels';
  };
  // Что полоса состояния говорит об очереди: пустая очередь — норма, ошибки и застой — тревога (§9)
  const stalledMinutes = outbox?.oldestPendingAt
    ? Math.floor((Date.now() - Date.parse(outbox.oldestPendingAt)) / 60_000)
    : 0;
  const queueTone = !outbox
    ? 'warn'
    : outbox.failed > 0 || stalledMinutes >= 10
      ? 'alarm'
      : outbox.pending > 0
        ? 'warn'
        : 'calm';
  const queueWord = !outbox
    ? 'Сводка очереди не загрузилась.'
    : outbox.failed > 0
      ? `Ошибок отправки ${outbox.failed} — каналы продают по старому остатку.`
      : stalledMinutes >= 10
        ? `Очередь стоит ${stalledMinutes} мин — каналы продают по старому остатку.`
        : outbox.pending > 0
          ? 'Ждут отправки в каналы.'
          : 'Очередь пуста: всё ушло в каналы.';
  return (
    <Page
      title="Каналы продаж — Channex"
      subtitle={
        property
          ? 'Что уходит в каналы и что приходит обратно.'
          : 'Объект в Channex не создан — цены и остатки в каналы не уходят.'
      }
      actions={
        <Link href="/connections" className="btn btn--secondary">
          Проверить соединение
        </Link>
      }
    >
      {!summary && (
        <Alert boxed tone="warning" data-testid="inventory-failed">
          Сводка фонда не загрузилась: категории ниже подписаны кодами. Очередь каналов и статус
          webhook на этой странице читаются отдельно и верны.
        </Alert>
      )}
      {/*
       * 21.09: три плитки с числами очереди и панель фактов на четыре колонки занимали весь первый экран
       * и повторяли друг друга (подзаголовок страницы говорил то же третий раз). Теперь одна полоса
       * состояния: слева — сколько ждёт отправки и что это значит, справа — факты подключения.
       */}
      {!outbox && (
        <LoadError
          testId="outbox-error"
          {...loadErrorProps(loadedOutbox.ok ? null : loadedOutbox.e)}
        />
      )}
      <StateBar
        className="state-bar--wide"
        tone={queueTone}
        label="В очереди"
        value={outbox ? <span data-testid="outbox-pending">{String(outbox.pending)}</span> : '—'}
        summary={queueWord}
      >
        <StateFact
          label="Отправлено"
          value={
            outbox ? (
              <>
                <span data-testid="outbox-sent">{String(outbox.sent)}</span>
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
          label="Объект Channex"
          value={
            property ? (
              <span className="mono">{property.providerPropertyId.slice(0, 8) + '…'}</span>
            ) : (
              'не создан'
            )
          }
        >
          {!property && (
            <span className="state-bar__sub">
              пока объекта нет, сопоставлений и выгрузки тоже не будет
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
                  ? `${webhook.active ? 'активен' : 'выключен'}, события ${webhook.eventMask}`
                  : webhook?.expectedUrl
                    ? 'не зарегистрирован'
                    : 'нет PUBLIC_API_URL'}
            </span>
          }
        >
          {webhook?.registered && (
            <span className="state-bar__sub break-all">{webhook.callbackUrl}</span>
          )}
          {webhook?.registered &&
            webhook.expectedUrl &&
            webhook.callbackUrl !== webhook.expectedUrl && (
              <span className="state-bar__sub danger-text" data-testid="webhook-url-mismatch">
                зарегистрирован не постоянный адрес PMS ({webhook.expectedUrl}) — события уходят не
                туда, нажмите «Зарегистрировать webhook»
              </span>
            )}
          {webhook?.registered &&
            webhook.callbackReachable === false &&
            (!webhook.expectedUrl || webhook.callbackUrl === webhook.expectedUrl) && (
              <span className="state-bar__sub danger-text">
                адрес не отвечает{checkedAt(webhook.callbackCheckedAt, clock)} — брони подберёт
                опрос ленты, но webhook надо поднять
              </span>
            )}
          {webhook?.registered && webhook.callbackReachable === true && (
            <span className="state-bar__sub ok-text">
              адрес отвечает{checkedAt(webhook.callbackCheckedAt, clock)}
            </span>
          )}
        </StateFact>
        <StateFact
          label="Последняя задача"
          value={
            <span className="mono break-all" data-testid="outbox-last-task">
              {outbox ? (outbox.lastTaskId ?? '—') : 'не загрузилось'}
            </span>
          }
        />
      </StateBar>
      {outbox && <OverbookingAlarm outbox={outbox} />}
      {webhook === null && (
        <Alert boxed>
          Статус webhook не загрузился. Его состояние неизвестно — обновите страницу перед
          настройкой.
        </Alert>
      )}
      <ChannelButtons
        webhookReady={webhookReady}
        configured={!!connection?.apiConfigured}
        connected={!!connection?.propertyAccessible}
      />
      {!connection?.propertyAccessible && (
        <Alert boxed>
          {connection?.message ?? 'Не удалось проверить соединение'}.{' '}
          <Link href="/connections">Подключения API</Link>
        </Alert>
      )}
      <div className="cols-2">
        <section className="stack stack--sm" aria-labelledby="outbox-title">
          <SectionTitle id="outbox-title">Очередь в Channex</SectionTitle>
          <OutboxTable
            rows={outboxRows}
            filter={queue}
            hrefFor={(status) => href({ queue: status })}
            categoryName={categoryName}
          />
        </section>
        <section className="stack stack--sm" aria-labelledby="events-title">
          <SectionTitle id="events-title">Входящие события</SectionTitle>
          <EventsTable
            data={eventsPage}
            filter={events}
            hrefFor={(f) => href(f)}
            queueFilter={queue}
          />
        </section>
      </div>

      <SectionTitle>Сопоставление категорий и тарифов</SectionTitle>
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
                  Сопоставлений пока нет: категории и тарифы появятся здесь после «Создать объект в
                  Channex». Пока их нет, цены и остатки в каналы не уходят.
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
    </Page>
  );
}
/**
 * Строки очереди ARI (срез 7.2). Плитки выше отвечают «сколько», таблица — «что»: вид сообщения,
 * за какие ночи, по какой категории или тарифу, чем кончилось. На сертификации это тот экран,
 * который показывают вместе с дашбордом Channex.
 */

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
