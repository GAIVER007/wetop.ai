import ReservationPage from '../../../reservations/[number]/page';
import { RouteDrawer } from '../../../../components/route-drawer';
export default function BookingDrawerPage({ params }: { params: Promise<{ number: string }> }) {
  return (
    <RouteDrawer>
      <ReservationPage params={params} />
    </RouteDrawer>
  );
}
