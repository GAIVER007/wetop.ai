import { type OutboxSummary, api, channelsApi } from '../../lib/api';
import { Page } from '../../components/page';
import { Alert, SectionTitle, Stat, Stats, Table } from '../../components/ui';
import { ChannelButtons, RetryEventButton } from './buttons';

/** Каналы (Channex staging): маппинг, очередь исходящих изменений, ручные действия. */
const VIA_RU: Record<string, string> = {
  WEBHOOK: 'сама (webhook)',
  PULL: 'опрос ленты',
  MANUAL: 'вручную',
};

export default async function ChannelsPage() {
  const [mapping, outbox, summary, webhook, events] = await Promise.all([
    channelsApi.mapping(),
    channelsApi.outbox(),
    api.inventorySummary(),
    channelsApi.webhookStatus().catch(() => null),
    channelsApi.events(20).catch(() => []),
  ]);
  const webhookReady = !!webhook?.expectedUrl && !!webhook?.secretConfigured;
  const byCode = new Map(summary.byCategory.map((c) => [c.code, c.name]));
  const property = mapping.find((m) => !m.providerRoomTypeId);
  return (
    <Page title="Каналы продаж — Channex">
      <Stats min={160} style={{ marginBottom: 12 }}>
        <Stat
          label="Объект на staging"
          size="compact"
          value={property ? property.providerPropertyId.slice(0, 8) + '…' : 'не создан'}
        />
        <Stat
          label="В очереди"
          size="compact"
          value={String(outbox.pending)}
          testId="outbox-pending"
        />
        <Stat label="Отправлено" size="compact" value={String(outbox.sent)} testId="outbox-sent" />
        <Stat label="Ошибок" size="compact" value={String(outbox.failed)} />
        <Stat
          label="Последняя задача Channex"
          size="compact"
          value={outbox.lastTaskId ?? '—'}
          testId="outbox-last-task"
        />
        <Stat
          label="Webhook в Channex"
          size="compact"
          value={
            webhook?.registered
              ? `${webhook.active ? 'активен' : 'выключен'} · ${webhook.eventMask}`
              : webhook?.expectedUrl
                ? 'не зарегистрирован'
                : 'нет PUBLIC_API_URL'
          }
          testId="webhook-status"
        />
      </Stats>
      {webhook?.registered && <p className="hint">адрес: {webhook.callbackUrl}</p>}
      <OverbookingAlarm outbox={outbox} />
      <ChannelButtons webhookReady={webhookReady} />
      <SectionTitle>Входящие события канала</SectionTitle>
      <p className="hint" style={{ margin: '0 0 8px' }}>
        Каждое сообщение от Channex сначала записывается, потом обрабатывается: так бронь не
        теряется при сбое, а неудачную попытку видно (ADR-007). Строка со статусом FAILED — бронь в
        PMS не попала. После шести неудачных попыток PMS перестаёт пробовать сама и ждёт кнопки
        «Обработать заново» — иначе ревизия падала бы на каждом опросе незаметно для человека.
      </p>
      <Table size="sm" data-testid="events-table">
        <thead>
          <tr>
            {['Событие', 'Тип', 'Как дошло', 'Статус', 'Попыток', 'Получено', 'Ошибка', ''].map(
              (h) => (
                <th key={h}>{h}</th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {events.length === 0 && (
            <tr>
              <td colSpan={8} className="muted">
                событий пока нет
              </td>
            </tr>
          )}
          {events.map((e) => (
            <tr key={e.externalEventId} data-testid="event-row">
              <td className="mono" style={{ fontSize: 11 }}>
                {e.externalEventId.slice(0, 36)}
              </td>
              <td>{e.type}</td>
              <td>{VIA_RU[e.receivedVia ?? 'PULL'] ?? e.receivedVia}</td>
              <td className={e.status === 'FAILED' ? 'danger-text' : 'ok-text'}>{e.status}</td>
              <td className="num">{e.attempts}</td>
              <td className="nowrap">{e.receivedAt.slice(0, 16).replace('T', ' ')}</td>
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
            {['Категория', 'Room type (Channex)', 'Rate plan (Channex)'].map((h) => (
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
        </tbody>
      </Table>
    </Page>
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
