import { type SearchParams } from '../../../../lib/search-params';
import NewReservationPage from '../../../reservations/new/page';
import { RouteDrawer } from '../../../../components/route-drawer';
export default function NewBookingDrawer({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <RouteDrawer title="Новая бронь" size="lg">
      <NewReservationPage searchParams={searchParams} />
    </RouteDrawer>
  );
}
