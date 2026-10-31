import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { requireFeature } from '../../lib/vertical-guard';
import { hotelShell } from '../../lib/hotel-staff-shell';
import { hotelStaffApi } from '../../lib/hotel-staff-api';
import { HotelShiftsBoard } from './board';
import { WeekPicker } from '../beauty/schedule/week-picker';
import { mondayOf } from '../beauty/schedule/week';
import { hotelToday } from '../../lib/hotel-api';
import { serverT } from '../../i18n/server';
import '../beauty/beauty.css';

/** «График работы» гостиницы (решение 22.10.2026): неделя горничных и ресепшена, та же форма недели, что у ресторана */
export default async function StaffSchedulePage({
  searchParams = Promise.resolve({}),
}: { searchParams?: Promise<{ week?: string | string[] }> } = {}) {
  await requireFeature('/staff-schedule');
  const t = await serverT();
  try {
    const shell = await hotelShell();
    // выбор недели и месяца (31.10.2026): неделя в адресе `?week=`, по умолчанию текущая
    const today = await hotelToday();
    const { week } = await searchParams;
    const monday = mondayOf(typeof week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(week) && !Number.isNaN(Date.parse(week)) ? week : today);
    const { employees } = await hotelStaffApi.shifts(monday);
    return (
      <Page className="schedule-page" title={t('График работы')} subtitle={t('Неделя горничных и ресепшена')}>
        <div key={shell.scopeKey}>
          <div className="schedule-toolbar">
            <WeekPicker base="/staff-schedule" monday={monday} today={today} />
          </div>
          <HotelShiftsBoard scopeKey={shell.scopeKey} write={shell.canStaff && !shell.readOnly} employees={employees} monday={monday} />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('График работы')}>
        <LoadError testId="shifts-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
