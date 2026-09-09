import Link from 'next/link';
import { chessboardApi, formatMinor, reservationsApi } from '../../../lib/api';
import { ReservationActions } from './actions-panel';

const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'предварительная',
  CONFIRMED: 'подтверждена',
  CHECKED_IN: 'заселён',
  CHECKED_OUT: 'выселен',
  CANCELLED: 'отменена',
  NO_SHOW: 'незаезд',
};
const SOURCE_RU: Record<string, string> = {
  DESK: 'стойка',
  PHONE: 'телефон',
  WHATSAPP: 'WhatsApp',
  WALK_IN: 'с улицы',
  INSTAGRAM: 'Instagram',
  OTA: 'OTA',
  WEBSITE: 'сайт',
};

/** Карточка брони + действия стойки (шаг 3.5): даты, отмена, назначение/переселение. */
export default async function ReservationPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const r = await chessboardApi.reservation(decodeURIComponent(number));
  const [ratePlans, availabilities] = await Promise.all([
    reservationsApi.ratePlans(),
    Promise.all(
      r.items.map((it) =>
        reservationsApi.availability(it.arrivalDate, it.departureDate).catch(() => null),
      ),
    ),
  ]);
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 48px' }}>
      <div style={{ fontSize: 13, marginBottom: 8, display: 'flex', gap: 12 }}>
        <Link href="/chessboard">← шахматка</Link>
        <span style={{ marginLeft: 'auto' }}>
          печать:{' '}
          <Link
            href={`/reservations/${encodeURIComponent(r.confirmationNumber)}/print?lang=ru`}
            data-testid="print-ru"
          >
            регистрационная карта RU
          </Link>{' '}
          ·{' '}
          <Link
            href={`/reservations/${encodeURIComponent(r.confirmationNumber)}/print?lang=kz`}
            data-testid="print-kz"
          >
            KZ
          </Link>
        </span>
      </div>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Бронь {r.confirmationNumber}</h1>
      <div style={{ color: '#666', marginBottom: 18 }}>
        {STATUS_RU[r.status] ?? r.status} · {SOURCE_RU[r.source] ?? r.source}
        {r.channel ? ` · ${r.channel}` : ''}
      </div>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Fact label="Заезд" value={r.arrivalDate} />
        <Fact label="Выезд" value={r.departureDate} />
        <Fact label="Гостей" value={`${r.adults}${r.children ? ` + ${r.children} дет.` : ''}`} />
        <Fact label="Сумма" value={formatMinor(r.totalAmountMinor, r.currency)} />
        <Fact
          label="Заказчик"
          value={r.primaryGuest?.label ?? '—'}
          href={r.primaryGuest ? `/guests/${r.primaryGuest.id}` : undefined}
          hint={
            r.primaryGuest
              ? r.primaryGuest.citizenship
                ? `гражданство ${r.primaryGuest.citizenship}`
                : 'гражданство не указано'
              : undefined
          }
        />
      </section>
      <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Проживания</h2>
      <table
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
            {['Ячейка', 'Категория', 'Заезд', 'Выезд', 'Статус', 'Цена', 'Гости'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderBottom: '1px solid #e3e5e8',
                  fontSize: 12,
                  color: '#666',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.items.map((it) => (
            <tr key={it.id} data-testid="stay-row">
              <td style={cell}>
                {it.unitCode ?? <span style={{ color: '#b45309' }}>не назначена</span>}
              </td>
              <td style={cell}>{it.accommodationTypeName}</td>
              <td style={cell}>{it.arrivalDate}</td>
              <td style={cell}>{it.departureDate}</td>
              <td style={cell}>{STATUS_RU[it.status] ?? it.status}</td>
              <td style={{ ...cell, textAlign: 'right' }}>
                {formatMinor(it.priceMinor, r.currency)}
              </td>
              <td style={cell}>{it.guests.map((g) => g.label).join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {r.notes && (
        <p style={{ marginTop: 16, color: '#444' }}>
          <b>Заметки:</b> {r.notes}
        </p>
      )}
      <ReservationActions
        number={r.confirmationNumber}
        status={r.status}
        arrivalDate={r.arrivalDate}
        departureDate={r.departureDate}
        ratePlans={ratePlans}
        items={r.items.map((it, i) => ({
          id: it.id,
          status: it.status,
          accommodationTypeName: it.accommodationTypeName,
          unitCode: it.unitCode,
          availableUnitCodes:
            availabilities[i]?.byCategory[it.accommodationTypeCode]?.availableUnitCodes ?? [],
        }))}
      />
    </main>
  );
}
function Fact({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: string;
  href?: string | undefined;
  hint?: string | undefined;
}) {
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
      <div style={{ fontSize: 16, fontWeight: 600 }}>
        {href ? (
          <Link href={href} data-testid="guest-link">
            {value}
          </Link>
        ) : (
          value
        )}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: hint.includes('не указано') ? '#b45309' : '#666' }}>
          {hint}
        </div>
      )}
    </div>
  );
}
const cell: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid #f0f1f3' };
