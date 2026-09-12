import Link from 'next/link';
import { guestsApi } from '../../../lib/api';
import { Page } from '../../../components/page';
import { SectionTitle, StatusBadge, Table } from '../../../components/ui';
import { GuestForms } from './guest-forms';

const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'предварительная',
  CONFIRMED: 'подтверждена',
  CHECKED_IN: 'заселён',
  CHECKED_OUT: 'выселен',
  CANCELLED: 'отменена',
  NO_SHOW: 'незаезд',
};

/** Карточка гостя: профиль, документы (маска), история проживаний. */
export default async function GuestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guestsApi.card(id);
  return (
    <Page
      width="medium"
      crumbs={<Link href="/guests">← гости</Link>}
      title={`${g.lastName} ${g.firstName} ${g.middleName ?? ''}`.trim()}
    >
      <GuestForms guest={g} />
      <SectionTitle>История проживаний</SectionTitle>
      <Table>
        <thead>
          <tr>
            {['Бронь', 'Категория', 'Ячейка', 'Заезд', 'Выезд', 'Статус'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {g.stays.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                нет
              </td>
            </tr>
          )}
          {g.stays.map((s) => (
            <tr key={`${s.confirmationNumber}-${s.arrivalDate}`}>
              <td>
                <Link href={`/reservations/${encodeURIComponent(s.confirmationNumber)}`}>
                  {s.confirmationNumber}
                </Link>
              </td>
              <td>{s.accommodationTypeName}</td>
              <td className="mono">{s.unitCode ?? '—'}</td>
              <td>{s.arrivalDate}</td>
              <td>{s.departureDate}</td>
              <td>
                <StatusBadge status={s.status} label={STATUS_RU[s.status] ?? s.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Page>
  );
}
