import Link from 'next/link';
import { api } from '../../lib/api';

/** Slice 1, шаг 7: номерной фонд объекта. Только чтение. Контроль Gate 1: 88 = 16 ROOM + 72 BED, 92 гостя. */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [summary, units] = await Promise.all([
    api.inventorySummary(),
    api.inventoryUnits(category),
  ]);
  const activeCategory = summary.byCategory.find((c) => c.code === category);

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 48px' }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#666' }}>
          {summary.property.name} · {summary.property.timezone} · {summary.property.currency}
        </div>
        <h1 style={{ fontSize: 26, margin: '4px 0 0' }}>Номерной фонд</h1>
      </header>

      <section
        data-testid="inventory-summary"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Stat label="Единиц продажи" value={summary.totalUnits} testId="total-units" />
        <Stat label="Отдельных номеров" value={summary.rooms} testId="rooms" />
        <Stat label="Койко-мест" value={summary.beds} testId="beds" />
        <Stat label="Максимум гостей" value={summary.maxGuests} testId="max-guests" />
        <Stat label="Блокировок" value={summary.blocks} testId="blocks" />
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={h2}>По категориям</h2>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Категория</th>
              <th style={thNum}>Единиц</th>
              <th style={thNum}>Гостей макс.</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {summary.byCategory.map((c) => (
              <tr
                key={c.code}
                data-testid="category-row"
                style={c.code === category ? rowActive : undefined}
              >
                <td style={td}>{c.name}</td>
                <td style={tdNum}>{c.units}</td>
                <td style={tdNum}>{c.maxGuests}</td>
                <td style={td}>
                  {c.code === category ? (
                    <Link href="/inventory">сбросить фильтр</Link>
                  ) : (
                    <Link href={`/inventory?category=${encodeURIComponent(c.code)}`}>показать</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={h2}>
          Единицы{activeCategory ? `: ${activeCategory.name}` : ''}{' '}
          <span style={{ color: '#666', fontWeight: 400 }}>({units.length})</span>
        </h2>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Код</th>
              <th style={th}>Тип</th>
              <th style={th}>Категория</th>
              <th style={th}>Комната</th>
              <th style={thNum}>Вместимость</th>
              <th style={th}>№ в Exely</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.code} data-testid="unit-row">
                <td style={tdMono}>{u.code}</td>
                <td style={td}>{u.kind === 'ROOM' ? 'номер' : 'койка'}</td>
                <td style={td}>{u.accommodationTypeName}</td>
                <td style={tdMono}>{u.roomNumber}</td>
                <td style={tdNum}>{u.roomCapacity}</td>
                <td style={tdMono}>{u.exelyRoomNumber ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Stat({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e3e5e8',
        borderRadius: 8,
        padding: '12px 14px',
      }}
    >
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div data-testid={testId} style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  );
}

const h2: React.CSSProperties = { fontSize: 17, margin: '0 0 10px' };
const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
  border: '1px solid #e3e5e8',
  borderRadius: 8,
};
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid #e3e5e8',
  fontSize: 12,
  color: '#666',
  fontWeight: 600,
};
const thNum: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = {
  padding: '7px 10px',
  borderBottom: '1px solid #f0f1f3',
  fontSize: 14,
};
const tdNum: React.CSSProperties = {
  ...td,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};
const tdMono: React.CSSProperties = {
  ...td,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};
const rowActive: React.CSSProperties = { background: '#eef4ff' };
