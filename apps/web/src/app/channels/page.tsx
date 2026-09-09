import Link from 'next/link';
import { api, channelsApi } from '../../lib/api';
import { ChannelButtons } from './buttons';

/** Каналы (Channex staging): маппинг, очередь исходящих изменений, ручные действия. */
export default async function ChannelsPage() {
  const [mapping, outbox, summary] = await Promise.all([
    channelsApi.mapping(),
    channelsApi.outbox(),
    api.inventorySummary(),
  ]);
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
      </section>
      <ChannelButtons />
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
