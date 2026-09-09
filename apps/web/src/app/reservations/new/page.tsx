import Link from 'next/link';
import { api, reservationsApi } from '../../../lib/api';
import { NewReservationForm } from './form';

const plusDays = (iso: string, n: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Slice 3, шаг 3.5: форма ручной брони. Доступность и ячейки — по датам из адресной строки. */
export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ arrival?: string; departure?: string }>;
}) {
  const q = await searchParams;
  const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  const arrival = q.arrival ?? today;
  const departure = q.departure ?? plusDays(arrival, 1);
  const [summary, ratePlans, availability] = await Promise.all([
    api.inventorySummary(),
    reservationsApi.ratePlans(),
    reservationsApi.availability(arrival, departure).catch(() => null),
  ]);
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px 48px' }}>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        <Link href="/chessboard">← шахматка</Link>
      </div>
      <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>Новая бронь</h1>
      <form method="get" style={{ display: 'flex', gap: 10, alignItems: 'end', marginBottom: 16 }}>
        <label style={lbl}>
          Заезд
          <input type="date" name="arrival" defaultValue={arrival} style={inp} />
        </label>
        <label style={lbl}>
          Выезд
          <input type="date" name="departure" defaultValue={departure} style={inp} />
        </label>
        <button type="submit" style={btnSecondary}>
          Проверить доступность
        </button>
      </form>
      {availability ? (
        <div data-testid="availability" style={{ fontSize: 13, color: '#444', marginBottom: 16 }}>
          {availability.nights} ноч. · свободно {availability.total.available} из{' '}
          {availability.total.units} ячеек:{' '}
          {summary.byCategory
            .map((c) => `${c.name} — ${availability.byCategory[c.code]?.available ?? 0}`)
            .join(' · ')}
        </div>
      ) : (
        <div style={{ color: '#b91c1c', marginBottom: 16 }}>
          Даты некорректны: выезд должен быть позже заезда.
        </div>
      )}
      <NewReservationForm
        arrival={arrival}
        departure={departure}
        categories={summary.byCategory.map((c) => ({
          code: c.code,
          name: c.name,
          availableUnitCodes: availability?.byCategory[c.code]?.availableUnitCodes ?? [],
        }))}
        ratePlans={ratePlans}
      />
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
