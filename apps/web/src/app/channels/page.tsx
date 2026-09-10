import Link from 'next/link';
import { type OutboxSummary, api, channelsApi } from '../../lib/api';
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
    <main style={{ padding: '20px 20px 48px', maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Каналы продаж — Channex</h1>
        <nav style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
          <Link href="/chessboard">шахматка</Link>
          <Link href="/rates">цены</Link>
        </nav>
      </header>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Fact
          label="Объект на staging"
          value={property ? property.providerPropertyId.slice(0, 8) + '…' : 'не создан'}
        />
        <Fact label="В очереди" value={String(outbox.pending)} testId="outbox-pending" />
        <Fact label="Отправлено" value={String(outbox.sent)} testId="outbox-sent" />
        <Fact label="Ошибок" value={String(outbox.failed)} />
        <Fact
          label="Последняя задача Channex"
          value={outbox.lastTaskId ?? '—'}
          testId="outbox-last-task"
        />
        <Fact
          label="Webhook в Channex"
          value={
            webhook?.registered
              ? `${webhook.active ? 'активен' : 'выключен'} · ${webhook.eventMask}`
              : webhook?.expectedUrl
                ? 'не зарегистрирован'
                : 'нет PUBLIC_API_URL'
          }
          testId="webhook-status"
        />
      </section>
      {webhook?.registered && (
        <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
          адрес: {webhook.callbackUrl}
        </div>
      )}
      <OverbookingAlarm outbox={outbox} />
      <ChannelButtons webhookReady={webhookReady} />
      <h2 style={{ fontSize: 16, margin: '20px 0 8px' }}>Входящие события канала</h2>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px' }}>
        Каждое сообщение от Channex сначала записывается, потом обрабатывается: так бронь не
        теряется при сбое, а неудачную попытку видно (ADR-007). Строка со статусом FAILED — бронь в
        PMS не попала. После шести неудачных попыток PMS перестаёт пробовать сама и ждёт кнопки
        «Обработать заново» — иначе ревизия падала бы на каждом опросе незаметно для человека.
      </p>
      <table style={{ ...tableStyle, marginBottom: 8 }} data-testid="events-table">
        <thead>
          <tr>
            {['Событие', 'Тип', 'Как дошло', 'Статус', 'Попыток', 'Получено', 'Ошибка', ''].map(
              (h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {events.length === 0 && (
            <tr>
              <td style={td} colSpan={8}>
                событий пока нет
              </td>
            </tr>
          )}
          {events.map((e) => (
            <tr key={e.externalEventId} data-testid="event-row">
              <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>
                {e.externalEventId.slice(0, 36)}
              </td>
              <td style={td}>{e.type}</td>
              <td style={td}>{VIA_RU[e.receivedVia ?? 'PULL'] ?? e.receivedVia}</td>
              <td style={{ ...td, color: e.status === 'FAILED' ? '#b91c1c' : '#166534' }}>
                {e.status}
              </td>
              <td style={{ ...td, textAlign: 'right' }}>{e.attempts}</td>
              <td style={td}>{e.receivedAt.slice(0, 16).replace('T', ' ')}</td>
              <td style={{ ...td, color: '#b91c1c' }}>{e.lastError?.slice(0, 80) ?? ''}</td>
              <td style={td}>
                {e.status === 'FAILED' && <RetryEventButton revisionId={e.externalEventId} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, margin: '20px 0 8px' }}>Маппинг категорий и тарифов</h2>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          background: '#fff',
          border: '1px solid #e3e5e8',
          borderRadius: 8,
          fontSize: 13,
        }}
      >
        <thead>
          <tr>
            {['Категория', 'Room type (Channex)', 'Rate plan (Channex)'].map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mapping
            .filter((m) => m.providerRoomTypeId)
            .map((m) => (
              <tr key={m.id} data-testid="mapping-row">
                <td style={td}>
                  {byCode.get(m.localAccommodationTypeCode ?? '') ?? m.localAccommodationTypeCode}
                </td>
                <td style={td}>{m.providerRoomTypeId}</td>
                <td style={td}>{m.providerRatePlanId}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </main>
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
    <div
      role="alert"
      data-testid="overbooking-alarm"
      style={{
        background: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#991b1b',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 12,
        fontSize: 14,
      }}
    >
      <b>Каналы могут не знать об остатках.</b>{' '}
      {outbox.failed > 0 && `Ошибок отправки: ${outbox.failed}. `}
      {stuck && `Самая старая неотправленная дельта ждёт ${staleMinutes} мин. `}
      Пока очередь не разошлась, каналы продают по старому остатку — возможен овербукинг. Нажмите
      «Отправить очередь сейчас» и проверьте ключ Channex.
    </div>
  );
}

function Fact({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e3e5e8',
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600 }} data-testid={testId}>
        {value}
      </div>
    </div>
  );
}
const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
  border: '1px solid #e3e5e8',
  borderRadius: 8,
  fontSize: 13,
};
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid #e3e5e8',
  fontSize: 12,
  color: '#666',
};
const td: React.CSSProperties = {
  padding: '7px 10px',
  borderBottom: '1px solid #f0f1f3',
  fontFamily: 'ui-monospace, monospace',
};
