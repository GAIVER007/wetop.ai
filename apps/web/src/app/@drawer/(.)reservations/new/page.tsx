import { type SearchParams } from '../../../../lib/search-params';
import NewReservationPage from '../../../reservations/new/page';
import { RouteDrawer } from '../../../../components/route-drawer';
import { msg } from '../../../../i18n';
export default function NewBookingDrawer({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <RouteDrawer title={msg('Новая бронь')} size="xl">
      <NewReservationPage searchParams={searchParams} embedded />
    </RouteDrawer>
  );
}
