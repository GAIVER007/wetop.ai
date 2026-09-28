import Link from 'next/link';
import { notFoundOn404 } from '../../../lib/page-error';
import { unitsApi } from '../../../lib/api';
import { hotelToday, validDate } from '../../../lib/hotel-api';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
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

/**
 * Карточка ячейки: уборка, блокировки, ближайшие проживания. `?blockFrom=&blockTo=` — период из окошка
 * шахматки (ТЗ «Шахматка v2» §31–32): форма блокировки открывается с ним; «по» не включается, как у API.
 */
export default async function UnitPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { code } = await params;
  const q = normalizeSearchParams(await searchParams);
  const blockPeriod =
    q.blockFrom &&
    q.blockTo &&
    validDate(q.blockFrom) &&
    validDate(q.blockTo) &&
    q.blockTo > q.blockFrom
      ? { dateFrom: q.blockFrom, dateTo: q.blockTo }
      : undefined;
  const unit = await unitsApi.card(decodeURIComponent(code)).catch(notFoundOn404);
  const today = await hotelToday();
  return (
    <Page
      width="medium"
      crumbs={<Link href="/chessboard">← шахматка</Link>}
      title={`Ячейка ${unit.code}`}
      subtitle={`${unit.kind === 'BED' ? 'Койко-место' : 'Номер'}, категория «${unit.accommodationTypeName}», комната ${unit.roomNumber}${unit.active ? '' : ', выведена из фонда'}`}
    >
      <UnitActions unit={unit} today={today} blockPeriod={blockPeriod} />
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
