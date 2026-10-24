import { requireFeature } from '../../../lib/vertical-guard';
import Link from 'next/link';
import { notFoundOn404 } from '../../../lib/page-error';
import { unitsApi } from '../../../lib/api';
import { hotelToday, validDate } from '../../../lib/hotel-api';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { displayDate } from '../../../lib/display-date';
import { Page, BackCrumb } from '../../../components/page';
import { SectionTitle, StatusBadge, Table } from '../../../components/ui';
import { UnitActions } from './unit-actions';
import { UnitFacts } from './unit-facts';
import { deskShell } from '../../../lib/desk-shell';
import { mayAccess } from '../../../lib/navigation';
import { loadHousekeepers } from '../../../lib/hotel-housekeepers';
import { msg } from '../../../i18n';
import { serverT } from '../../../i18n/server';
import '../../inventory/inventory.css';

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
  // гостиничный экран: салон и ресторан по прямому адресу уходят на свою стартовую (DS2 F1, как `/reports`)
  await requireFeature('/units');
  const t = await serverT();
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
  const [unit, today, shell] = await Promise.all([
    unitsApi.card(decodeURIComponent(code)).catch(notFoundOn404),
    hotelToday(),
    deskShell(),
  ]);
  const canMutate = mayAccess(shell.access, 'desk') && !shell.readOnly;
  const housekeepers = canMutate ? await loadHousekeepers() : undefined;
  return (
    <Page
      width="medium"
      crumbs={<BackCrumb href="/inventory">{t('Номерной фонд')}</BackCrumb>}
      title={t('Номер {code}', { code: unit.code })}
      subtitle={`${t(
        unit.kind === 'BED' ? msg('Койко-место, категория «{category}», комната {room}') : msg('Номер, категория «{category}», комната {room}'),
        { category: unit.accommodationTypeName, room: unit.roomNumber },
      )}${unit.active ? '' : t(', выведена из фонда')}`}
    >
      <UnitFacts unit={unit} today={today} />
      {canMutate && <UnitActions unit={unit} today={today} blockPeriod={blockPeriod} housekeepers={housekeepers} />}
      <SectionTitle>{t('Ближайшие проживания, 60 дней')}</SectionTitle>
      <Table size="sm" data-testid="unit-stays">
        <thead>
          <tr>
            {[msg('Бронь'), msg('Заезд'), msg('Выезд'), msg('Статус'), msg('Гость')].map((h) => (
              <th key={h}>{t(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {unit.stays.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                {t('Проживаний на 60 дней вперёд нет')}
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
                <StatusBadge kind="hospitality" value={s.status} />
              </td>
              <td>{s.guestLabel || '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Page>
  );
}
