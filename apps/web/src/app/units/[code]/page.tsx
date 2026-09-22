import Link from 'next/link';
import { notFoundOn404 } from '../../../lib/page-error';
import { unitsApi } from '../../../lib/api';
import { displayDate } from '../../../lib/display-date';
import { Page } from '../../../components/page';
import { SectionTitle, StatusBadge, Table } from '../../../components/ui';
import { UnitActions } from './unit-actions';

const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'предварительная',
  CONFIRMED: 'подтверждена',
  CHECKED_IN: 'заселён',
  CHECKED_OUT: 'выселен',
  CANCELLED: 'отменена',
  NO_SHOW: 'незаезд',
};

/** Карточка ячейки: уборка, блокировки, ближайшие проживания. */
export default async function UnitPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const unit = await unitsApi.card(decodeURIComponent(code)).catch(notFoundOn404);
  const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  return (
    <Page
      width="medium"
      crumbs={<Link href="/chessboard">← шахматка</Link>}
      title={`Ячейка ${unit.code}`}
      subtitle={`${unit.kind === 'BED' ? 'Койко-место' : 'Номер'}, категория «${unit.accommodationTypeName}», комната ${unit.roomNumber}${unit.active ? '' : ', выведена из фонда'}`}
    >
      <UnitActions unit={unit} today={today} />
      <SectionTitle>Ближайшие проживания, 60 дней</SectionTitle>
      <Table size="sm" data-testid="unit-stays">
        <thead>
          <tr>
            {['Бронь', 'Заезд', 'Выезд', 'Статус', 'Гость'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {unit.stays.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                Проживаний на 60 дней вперёд нет
              </td>
            </tr>
          )}
          {unit.stays.map((s) => (
            <tr key={`${s.confirmationNumber}-${s.startDate}`}>
              <td>
                <Link href={`/reservations/${encodeURIComponent(s.confirmationNumber)}`}>
                  {s.confirmationNumber}
                </Link>
              </td>
              <td>
                <time dateTime={s.startDate}>{displayDate(s.startDate, 'numeric')}</time>
              </td>
              <td>
                <time dateTime={s.endDate}>{displayDate(s.endDate, 'numeric')}</time>
              </td>
              <td>
                <StatusBadge status={s.status} label={STATUS_RU[s.status] ?? s.status} />
              </td>
              <td>{s.guestLabel || '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Page>
  );
}
