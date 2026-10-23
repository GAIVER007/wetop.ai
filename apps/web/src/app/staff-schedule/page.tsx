import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { requireFeature } from '../../lib/vertical-guard';
import { hotelShell } from '../../lib/hotel-staff-shell';
import { hotelStaffApi } from '../../lib/hotel-staff-api';
import { HotelShiftsBoard } from './board';
import '../beauty/beauty.css';

/** «График работы» гостиницы (решение 22.10.2026): неделя горничных и ресепшена, та же форма недели, что у ресторана */
export default async function StaffSchedulePage() {
  await requireFeature('/staff-schedule');
  try {
    const shell = await hotelShell();
    const { employees } = await hotelStaffApi.shifts();
    return (
      <Page title="График работы" subtitle="Обычная неделя горничных и ресепшена">
        <div key={shell.scopeKey}>
          <HotelShiftsBoard scopeKey={shell.scopeKey} write={shell.canStaff && !shell.readOnly} employees={employees} />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="График работы">
        <LoadError testId="shifts-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
