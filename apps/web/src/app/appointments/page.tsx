import { requireVertical } from '../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { beautyApi } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { calendarColumns } from '../beauty/calendar-columns';
import { AppointmentsList } from './list';
import '../beauty/beauty.css';
export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireVertical(['BEAUTY']);
  const { date } = normalizeSearchParams(await searchParams);
  const shell = await deskShell();
  try {
    const [day, employees] = await Promise.all([beautyApi.day(date), beautyApi.employees()]);
    return (
      <Page className="beauty-page" title="Записи" subtitle={day.location.name ?? 'Записи филиала'}>
        <AppointmentsList
          day={{ ...day, columns: calendarColumns(day, employees.items) }}
          readOnly={shell.readOnly}
        />
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Записи">
        <LoadError testId="beauty-appointments-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
