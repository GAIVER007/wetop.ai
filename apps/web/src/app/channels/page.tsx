import Link from 'next/link';
import { type OutboxMessage, type OutboxSummary, api, channelsApi } from '../../lib/api';
import { Page } from '../../components/page';
import { Alert, Badge, Help, SectionTitle, Stat, Stats, Table } from '../../components/ui';
import { ChannelButtons, RetryEventButton } from './buttons';
import { almatyMoment } from '../../lib/almaty';

/** Каналы (Channex staging): маппинг, очередь исходящих изменений, ручные действия. */
const EVENT_RU: Record<string, string> = {
  PROCESSED: 'обработано',
  FAILED: 'ошибка',
  RECEIVED: 'получено',
  SKIPPED: 'пропущено',
};
const EVENT_TONE: Record<string, 'ok' | 'danger' | 'info'> = {
  PROCESSED: 'ok',
  FAILED: 'danger',
  RECEIVED: 'info',
};
/** «, проверено 17.09 14:22» по часам объекта — время последней пробы адреса webhook */
const checkedAt = (iso: string | null | undefined) =>
  iso ? `, проверено ${almatyMoment(iso)}` : '';
const VIA_RU: Record<string, string> = {
  WEBHOOK: 'сама (webhook)',
  PULL: 'опрос ленты',
  MANUAL: 'вручную',
};
/** Вид сообщения очереди словом: в базе это перечисление, на экране — что уезжает в канал */
const OUTBOX_KIND_RU: Record<string, string> = {
  AVAILABILITY: 'остатки',
  RESTRICTIONS: 'цены и ограничения',
};
const OUTBOX_STATUS_RU: Record<string, string> = {
  PENDING: 'ждёт отправки',
  SENT: 'ушло',
  FAILED: 'ошибка',
};
const OUTBOX_TONE: Record<string, 'ok' | 'danger' | 'info'> = {
  SENT: 'ok',
  FAILED: 'danger',
  PENDING: 'info',
};

export default async function ChannelsPage() {
  const [mapping, outbox, messages, summary, webhook, events, connection] = await Promise.all([
    channelsApi.mapping(),
    channelsApi.outbox(),
    // Строки очереди необязательны для остального экрана — их отказ не уносит статус webhook (§7.3)
    channelsApi.outboxMessages(20).catch(() => null),
    // Сводка фонда нужна только чтобы подписать категории именами: её отказ не должен уносить
    // очередь ARI и статус webhook — именно за ними сюда и приходят, когда что-то сломалось (§7.3)
    api.inventorySummary().catch(() => null),
    channelsApi.webhookStatus().catch(() => null),
    channelsApi.events(20).catch(() => null),
    channelsApi.connection().catch(() => null),
  ]);
  const webhookReady = !!webhook?.expectedUrl && !!webhook?.secretConfigured;
  const byCode = new Map((summary?.byCategory ?? []).map((c) => [c.code, c.name]));
  const property = mapping.find((m) => !m.providerRoomTypeId);
  return (
    <Page
      title="Каналы продаж — Channex"
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
      {/* Плитками — только числа очереди; идентификаторы и статус webhook строкой фактов (ADR-027) */}
      <Stats min={150}>
        <Stat label="В очереди" value={String(outbox.pending)} testId="outbox-pending" />
        <Stat label="Отправлено" value={String(outbox.sent)} testId="outbox-sent" />
        <Stat
          label="Ошибок"
          value={
            <span className={outbox.failed > 0 ? 'danger-text' : undefined}>
              {String(outbox.failed)}
            </span>
          }
        />
      </Stats>
      <div className="facts facts--card">
        <div>
          <div className="fact__label">Объект Channex</div>
          <div className="fact__value mono">
            {property ? property.providerPropertyId.slice(0, 8) + '…' : 'не создан'}
          </div>
        </div>
        <div>
          <div className="fact__label">Webhook в Channex</div>
          <div className="fact__value" data-testid="webhook-status">
            {webhook === null
              ? 'состояние неизвестно'
              : webhook.registered
                ? `${webhook.active ? 'активен' : 'выключен'} · ${webhook.eventMask}`
                : webhook?.expectedUrl
                  ? 'не зарегистрирован'
                  : 'нет PUBLIC_API_URL'}
          </div>
          {webhook?.registered && <div className="cell-sub break-all">{webhook.callbackUrl}</div>}
          {webhook?.registered &&
            webhook.expectedUrl &&
            webhook.callbackUrl !== webhook.expectedUrl && (
              <div className="cell-sub danger-text" data-testid="webhook-url-mismatch">
                зарегистрирован не постоянный адрес PMS ({webhook.expectedUrl}) — события уходят не
                туда, нажмите «Зарегистрировать webhook»
              </div>
            )}
          {webhook?.registered &&
            webhook.callbackReachable === false &&
            (!webhook.expectedUrl || webhook.callbackUrl === webhook.expectedUrl) && (
              <div className="cell-sub danger-text">
                адрес не отвечает{checkedAt(webhook.callbackCheckedAt)} — брони подберёт опрос
                ленты, но webhook надо поднять
              </div>
            )}
          {webhook?.registered && webhook.callbackReachable === true && (
            <div className="cell-sub ok-text">
              адрес отвечает{checkedAt(webhook.callbackCheckedAt)}
            </div>
          )}
        </div>
        <div>
          <div className="fact__label">Последняя задача Channex</div>
          <div className="fact__value mono break-all" data-testid="outbox-last-task">
            {outbox.lastTaskId ?? '—'}
          </div>
        </div>
      </div>
      <OverbookingAlarm outbox={outbox} />
      <OutboxMessages messages={messages} mapping={mapping} names={byCode} />
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
      <SectionTitle>Входящие события канала</SectionTitle>
      <Help title="Обработка событий">
        Ошибка означает, что ревизия не обработана. После шести неудачных попыток исправьте причину
        и нажмите «Обработать заново».
      </Help>
      {events === null && (
        <Alert boxed>
          Не удалось загрузить входящие события. Это не означает, что событий нет.
        </Alert>
      )}
      <Table size="sm" data-testid="events-table">
        <thead>
          <tr>
            {[
              'Событие',
              'Тип',
              'Бронь',
              'Как дошло',
              'Статус',
              'Попыток',
              'Получено',
              'Ошибка',
              '',
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events?.length === 0 && (
            <tr>
              <td colSpan={9} className="muted">
                событий пока нет
              </td>
            </tr>
          )}
          {events?.map((e) => (
            <tr key={e.externalEventId} data-testid="event-row">
              <td className="mono" style={{ fontSize: 11 }}>
                {e.externalEventId.slice(0, 36)}
              </td>
              <td>{e.type}</td>
              {/* Ревизия связана с бронью по unique_id — от события сразу к карточке (срез 7.2) */}
              <td className="mono nowrap">
                {e.reservationNumber ? (
                  <Link
                    href={`/reservations/${encodeURIComponent(e.reservationNumber)}`}
                    data-testid="event-reservation"
                  >
                    {e.reservationNumber}
                  </Link>
                ) : (
                  <span className="muted-2">—</span>
                )}
              </td>
              <td>{VIA_RU[e.receivedVia ?? 'PULL'] ?? e.receivedVia}</td>
              <td>
                <Badge tone={EVENT_TONE[e.status] ?? 'neutral'}>
                  {EVENT_RU[e.status] ?? e.status}
                </Badge>
              </td>
              <td className="num">{e.attempts}</td>
              <td className="nowrap">{almatyMoment(e.receivedAt)}</td>
              <td className="danger-text">{e.lastError?.slice(0, 80) ?? ''}</td>
              <td>
                {e.status === 'FAILED' && <RetryEventButton revisionId={e.externalEventId} />}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <SectionTitle>Маппинг категорий и тарифов</SectionTitle>
      <Table size="sm">
        <thead>
          <tr>
            {['Категория', 'Категория в Channex', 'Тариф в Channex'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mapping
            .filter((m) => m.providerRoomTypeId)
            .map((m) => (
              <tr key={m.id} data-testid="mapping-row">
                <td>
                  {byCode.get(m.localAccommodationTypeCode ?? '') ?? m.localAccommodationTypeCode}
                </td>
                <td className="mono">{m.providerRoomTypeId}</td>
                <td className="mono">{m.providerRatePlanId}</td>
              </tr>
            ))}
          {!mapping.some((m) => m.providerRoomTypeId) && (
            <tr>
              <td colSpan={3} className="muted" data-testid="mapping-empty">
                Сопоставлений нет: категории и тарифы ещё не связаны с Channex. Пока их нет, цены и
                остатки в каналы не уходят.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </Page>
  );
}
/**
 * Строки очереди ARI (срез 7.2). Плитки выше отвечают «сколько», таблица — «что»: вид сообщения,
 * за какие ночи, по какой категории или тарифу, чем кончилось. На сертификации это тот экран,
 * который показывают вместе с дашбордом Channex.
 */
function OutboxMessages({
  messages,
  mapping,
  names,
}: {
  messages: OutboxMessage[] | null;
  mapping: Array<{
    providerRoomTypeId?: string | null;
    providerRatePlanId?: string | null;
    localAccommodationTypeCode?: string | null;
  }>;
  names: Map<string, string>;
}) {
  /** Адрес Channex → имя категории: без этого в строке стоят идентификаторы, которые никому не говорят */
  const label = (m: OutboxMessage) => {
    const ids = [...m.roomTypeIds, ...m.ratePlanIds];
    const codes = ids.map((id) => {
      const row = mapping.find(
        (x) => x.providerRoomTypeId === id || x.providerRatePlanId === id,
      );
      const code = row?.localAccommodationTypeCode ?? null;
      return (code && names.get(code)) || code || `${id.slice(0, 8)}…`;
    });
    return [...new Set(codes)].join(', ');
  };
  return (
    <>
      <SectionTitle>Очередь отправок в Channex</SectionTitle>
      {messages === null ? (
        <Alert boxed>
          Строки очереди не загрузились. Числа выше читаются отдельно и верны.
        </Alert>
      ) : (
        <Table size="sm" data-testid="outbox-table">
          <thead>
            <tr>
              {['Что уезжает', 'Категория или тариф', 'Ночи', 'Строк', 'Статус', 'Попыток', 'Задача Channex', 'Поставлено', 'Ошибка'].map(
                (h) => (
                  <th key={h}>{h}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 && (
              <tr>
                <td colSpan={9} className="muted" data-testid="outbox-empty">
                  Очередь пуста: всё, что меняли, уже ушло в Channex.
                </td>
              </tr>
            )}
            {messages.map((m) => (
              <tr key={m.id} data-testid="outbox-row">
                <td>{OUTBOX_KIND_RU[m.kind] ?? m.kind}</td>
                <td>{label(m) || <span className="muted-2">—</span>}</td>
                <td className="nowrap">
                  {m.dateFrom ? `${m.dateFrom} → ${m.dateTo}` : <span className="muted-2">—</span>}
                </td>
                <td className="num">{m.lines}</td>
                <td>
                  <Badge tone={OUTBOX_TONE[m.status] ?? 'neutral'}>
                    {OUTBOX_STATUS_RU[m.status] ?? m.status}
                  </Badge>
                </td>
                <td className="num">{m.attempts}</td>
                <td className="mono" style={{ fontSize: 11 }}>
                  {m.taskId ?? ''}
                </td>
                <td className="nowrap">{almatyMoment(m.createdAt)}</td>
                <td className="danger-text">{m.lastError?.slice(0, 80) ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
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
    <Alert boxed data-testid="overbooking-alarm" style={{ marginBottom: 12 }}>
      <b>Каналы могут не знать об остатках.</b>{' '}
      {outbox.failed > 0 && `Ошибок отправки: ${outbox.failed}. `}
      {stuck && `Самая старая неотправленная дельта ждёт ${staleMinutes} мин. `}
      Пока очередь не разошлась, каналы продают по старому остатку — возможен овербукинг. Нажмите
      «Отправить очередь сейчас» и проверьте ключ Channex.
    </Alert>
  );
}
