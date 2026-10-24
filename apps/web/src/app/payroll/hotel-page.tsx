import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { hotelShell } from '../../lib/hotel-staff-shell';
import { hotelStaffApi } from '../../lib/hotel-staff-api';
import { HotelPayrollBoard } from './hotel-payroll';

/** «Зарплата» гостиницы (решение 22.10.2026): оклад, уборки сдельно, премии и удержания; без выплат из кассы */
export async function HotelPayrollPage({ month }: { month?: string | undefined }) {
  try {
    const shell = await hotelShell();
    const chosen = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : shell.date.slice(0, 7);
    const payroll = await hotelStaffApi.payroll(chosen);
    return (
      <Page title="Зарплата" subtitle="Оклад, уборки сдельно, премии и удержания за месяц">
        <div key={shell.scopeKey}>
          <HotelPayrollBoard scopeKey={shell.scopeKey} write={shell.canStaff && !shell.readOnly} payroll={payroll} />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Зарплата">
        <LoadError testId="payroll-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
