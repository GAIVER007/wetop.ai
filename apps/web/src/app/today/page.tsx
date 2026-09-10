import Link from 'next/link';
import { deskApi, formatMinor, messengerLinks, type DeskRow } from '../../lib/api';

const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'предварительная',
  CONFIRMED: 'ждём',
  CHECKED_IN: 'живёт',
  CHECKED_OUT: 'выселен',
};

/** Рабочий день стойки: что делать сегодня (SPEC §6). Первое, что открывает администратор утром. */
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const day = await deskApi.today(sp.date);
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 48px' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Сегодня, {day.date}</h1>
        <nav style={{ display: 'flex', gap: 10, marginLeft: 'auto', fontSize: 14 }}>
          <Link href="/chessboard">шахматка</Link>
          <Link href="/finance">деньги</Link>
          <Link href="/guests">гости</Link>
          <Link href="/journal">журнал</Link>
        </nav>
      </header>

      <form method="get" style={{ marginBottom: 16 }}>
        <input type="date" name="date" defaultValue={day.date} style={inp} />{' '}
        <button type="submit" style={btn}>
          Показать
        </button>
      </form>

      <section style={cards}>
        <Card label="Заезды" value={String(day.counts.arrivals)} testId="c-arrivals" />
        <Card
          label="Из них не заселены"
          value={String(day.counts.toCheckIn)}
          testId="c-tocheckin"
        />
        <Card label="Выезды" value={String(day.counts.departures)} testId="c-departures" />
        <Card
          label="Из них не выселены"
          value={String(day.counts.toCheckOut)}
          testId="c-tocheckout"
        />
        <Card label="Живут" value={String(day.counts.inHouse)} testId="c-inhouse" />
        <Card
          label="Долг уезжающих"
          value={formatMinor(day.debtMinor)}
          testId="c-debt"
          alarm={day.debtMinor !== '0'}
        />
      </section>

      <Group title="Заезжают" rows={day.arrivals} testId="arrivals" showBlocked />
      <Group title="Выезжают" rows={day.departures} testId="departures" showDebt />
      <Group title="Живут" rows={day.inHouse} testId="inhouse" />
    </main>
  );
}

function Group({
  title,
  rows,
  testId,
  showBlocked,
  showDebt,
}: {
  title: string;
  rows: DeskRow[];
  testId: string;
  showBlocked?: boolean;
  showDebt?: boolean;
}) {
  return (
    <>
      <h2 style={{ fontSize: 16, margin: '22px 0 8px' }}>
        {title} — {rows.length}
      </h2>
      <table style={table} data-testid={`group-${testId}`}>
        <thead>
          <tr>
            {[
              'Гость',
              'Бронь',
              'Ячейка',
              'Категория',
              'Проживание',
              'Статус',
              showDebt ? 'Счёт' : '',
            ]
              .filter(Boolean)
              .map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td style={td} colSpan={7}>
                никого
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const m = messengerLinks(r.guestPhone);
            return (
              <tr key={r.itemId} data-testid={`row-${testId}`}>
                <td style={td}>
                  {r.guestLabel || '—'}
                  {m && (
                    <>
                      {' '}
                      <a href={m.whatsapp} target="_blank" rel="noreferrer" style={link}>
                        WA
                      </a>
                    </>
                  )}
                </td>
                <td style={td}>
                  <Link href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`}>
                    {r.confirmationNumber}
                  </Link>
                </td>
                <td style={td}>
                  {r.unitCode ? (
                    <Link href={`/units/${encodeURIComponent(r.unitCode)}`}>{r.unitCode}</Link>
                  ) : (
                    <span style={{ color: '#b45309' }}>нет</span>
                  )}
                </td>
                <td style={td}>{r.accommodationTypeName}</td>
                <td style={td}>
                  {r.arrivalDate} → {r.departureDate}
                </td>
                <td style={td}>
                  {STATUS_RU[r.status] ?? r.status}
                  {showBlocked && r.blockedReason && (
                    <span style={{ color: '#b45309' }}> · {r.blockedReason}</span>
                  )}
                </td>
                {showDebt && (
                  <td style={{ ...td, textAlign: 'right' }}>
                    <span style={{ color: BigInt(r.balanceMinor) > 0n ? '#b91c1c' : '#15803d' }}>
                      {formatMinor(r.balanceMinor)}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function Card({
  label,
  value,
  testId,
  alarm,
}: {
  label: string;
  value: string;
  testId: string;
  alarm?: boolean;
}) {
  return (
    <div style={{ ...card, ...(alarm ? { borderColor: '#fecaca', background: '#fef2f2' } : {}) }}>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600 }} data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

const cards: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 12,
};
const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e3e5e8',
  borderRadius: 8,
  padding: '10px 12px',
};
const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
  border: '1px solid #e3e5e8',
  borderRadius: 8,
  fontSize: 14,
};
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid #e3e5e8',
  fontSize: 12,
  color: '#666',
};
const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid #f0f1f3' };
const inp: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #cbd0d6',
  borderRadius: 6,
  fontSize: 14,
};
const btn: React.CSSProperties = {
  padding: '7px 14px',
  border: 0,
  borderRadius: 6,
  background: '#1d4ed8',
  color: '#fff',
  fontSize: 14,
  cursor: 'pointer',
};
const link: React.CSSProperties = { fontSize: 11 };
