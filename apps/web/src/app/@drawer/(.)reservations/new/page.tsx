import NewReservationPage from '../../../reservations/new/page';
import { RouteDrawer } from '../../../../components/route-drawer';
export default function NewBookingDrawer({
  searchParams,
}: {
  searchParams: Promise<{ arrival?: string; departure?: string; unit?: string }>;
}) {
  return (
    <RouteDrawer title="Новая бронь">
      <NewReservationPage searchParams={searchParams} />
    </RouteDrawer>
  );
}
