import Link from 'next/link';
import { guestsApi } from '../../lib/api';

/** Поиск гостей: фамилия, имя, телефон, email. */
export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const guests = query.length >= 2 ? await guestsApi.search(query) : [];
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 48px' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Гости</h1>
        <nav style={{ marginLeft: 'auto' }}>
          <Link href="/chessboard">шахматка</Link>
        </nav>
      </header>
      <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          name="q"
          defaultValue={query}
          placeholder="фамилия, имя, телефон или email"
          style={{
            flex: 1,
            padding: '8px 10px',
            border: '1px solid #cbd0d6',
            borderRadius: 6,
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          style={{
            padding: '8px 14px',
            border: 0,
            borderRadius: 6,
            background: '#1d4ed8',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Найти
        </button>
      </form>
      {query.length >= 2 && (
        <table
          data-testid="guests-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            background: '#fff',
            border: '1px solid #e3e5e8',
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          <thead>
            <tr>
              {['Гость', 'Телефон', 'Email', 'Гражданство', 'Проживаний', 'Последний заезд'].map(
                (h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {guests.length === 0 && (
              <tr>
                <td style={td} colSpan={6}>
                  не найдено
                </td>
              </tr>
            )}
            {guests.map((g) => (
              <tr key={g.id}>
                <td style={td}>
                  <Link href={`/guests/${g.id}`}>
                    {g.lastName} {g.firstName} {g.middleName ?? ''}
                  </Link>
                </td>
                <td style={td}>{g.phone ?? '—'}</td>
                <td style={td}>{g.email ?? '—'}</td>
                <td style={td}>{g.citizenship ?? <span style={{ color: '#b45309' }}>нет</span>}</td>
                <td style={td}>{g.staysCount}</td>
                <td style={td}>{g.lastStay ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid #e3e5e8',
  fontSize: 12,
  color: '#666',
};
const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid #f0f1f3' };
