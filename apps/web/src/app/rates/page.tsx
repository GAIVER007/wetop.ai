import Link from 'next/link';
import { formatMinor, ratesApi } from '../../lib/api';
import { BulkEditor } from './bulk-editor';

const monthRange = (ym: string) => {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
};
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** Календарь цен и ограничений по категории × тарифу за месяц; массовое изменение справа. */
export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; ratePlan?: string; month?: string }>;
}) {
  const q = await searchParams;
  const options = await ratesApi.options();
  const category = q.category ?? options.categories[0]?.code ?? '';
  const ratePlan =
    q.ratePlan ?? options.ratePlans.find((p) => p.active)?.code ?? options.ratePlans[0]?.code ?? '';
  const month = q.month ?? new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 7);
  const { from, to } = monthRange(month);
  const cal = category && ratePlan ? await ratesApi.calendar(category, ratePlan, from, to) : null;
  const shift = (n: number) => {
    const [y, m] = month.split('-').map(Number) as [number, number];
    const d = new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
    return `/rates?category=${category}&ratePlan=${ratePlan}&month=${d}`;
  };
  return (
    <main style={{ padding: '20px 20px 48px', maxWidth: 1400, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 16,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ fontSize: 24, margin: 0 }}>Цены и ограничения</h1>
        <nav style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
          <Link href="/chessboard">шахматка</Link>
          <Link href="/channels">каналы</Link>
        </nav>
      </header>
      <form
        method="get"
        style={{ display: 'flex', gap: 10, alignItems: 'end', marginBottom: 14, flexWrap: 'wrap' }}
      >
        <label style={lbl}>
          Категория
          <select name="category" defaultValue={category} style={inp}>
            {options.categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label style={lbl}>
          Тариф
          <select name="ratePlan" defaultValue={ratePlan} style={inp}>
            {options.ratePlans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} ({p.currency}){p.active ? '' : ' — неактивен'}
              </option>
            ))}
          </select>
        </label>
        <label style={lbl}>
          Месяц
          <input type="month" name="month" defaultValue={month} style={inp} />
        </label>
        <button type="submit" style={btnSecondary}>
          Показать
        </button>
        <span style={{ marginLeft: 8 }}>
          <Link href={shift(-1)}>← месяц</Link> · <Link href={shift(1)}>месяц →</Link>
        </span>
      </form>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(520px, 2fr) minmax(320px, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div
          style={{
            overflowX: 'auto',
            background: '#fff',
            border: '1px solid #e3e5e8',
            borderRadius: 8,
          }}
        >
          {cal ? (
            <table
              data-testid="rates-table"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
            >
              <thead>
                <tr>
                  {[
                    'Дата',
                    ...Array.from({ length: cal.capacityAdults }, (_, i) => `Цена, ${i + 1} гост.`),
                    'Min stay',
                    'Max stay',
                    'Stop sell',
                    'CTA',
                    'CTD',
                  ].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cal.days.map((d) => {
                  const wd = new Date(`${d.date}T00:00:00Z`).getUTCDay();
                  const weekend = wd === 0 || wd === 6;
                  return (
                    <tr
                      key={d.date}
                      data-testid={`rate-row-${d.date}`}
                      style={{
                        background: d.stopSell ? '#fee2e2' : weekend ? '#f8fafc' : undefined,
                      }}
                    >
                      <td style={td}>
                        {d.date} <span style={{ color: '#888' }}>{WD[wd]}</span>
                      </td>
                      {Array.from({ length: cal.capacityAdults }, (_, i) => (
                        <td
                          key={i}
                          style={{ ...td, textAlign: 'right' }}
                          data-testid={`price-${d.date}-${i + 1}`}
                        >
                          {d.prices[String(i + 1)] ? (
                            formatMinor(d.prices[String(i + 1)]!, cal.currency)
                          ) : (
                            <span style={{ color: '#b45309' }}>нет</span>
                          )}
                        </td>
                      ))}
                      <td style={td}>{d.minStay ?? '—'}</td>
                      <td style={td}>{d.maxStay ?? '—'}</td>
                      <td style={td}>{d.stopSell ? 'да' : '—'}</td>
                      <td style={td}>{d.closedToArrival ? 'да' : '—'}</td>
                      <td style={td}>{d.closedToDeparture ? 'да' : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p style={{ padding: 16 }}>Нет категорий или тарифов.</p>
          )}
        </div>
        <BulkEditor
          categories={options.categories}
          ratePlans={options.ratePlans}
          defaults={{
            accommodationTypeCode: category,
            ratePlanCode: ratePlan,
            dateFrom: from,
            dateTo: to,
          }}
        />
      </div>
    </main>
  );
}
const lbl: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: '#555',
};
const inp: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #cbd0d6',
  borderRadius: 6,
  fontSize: 14,
};
const btnSecondary: React.CSSProperties = {
  padding: '7px 12px',
  border: '1px solid #cbd0d6',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
};
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: '1px solid #e3e5e8',
  fontSize: 12,
  color: '#666',
  whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '4px 8px',
  borderBottom: '1px solid #f0f1f3',
  whiteSpace: 'nowrap',
};
