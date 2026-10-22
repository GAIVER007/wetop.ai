import { unstable_rethrow } from 'next/navigation';
import { EmployeePortalScreen } from '../../components/employee-portal/screen';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { currentMe } from '../../lib/desk-shell';
import { hotelStaffApi } from '../../lib/hotel-staff-api';
import { loadErrorProps } from '../../lib/load-error';
import { ApiError } from '../../lib/api-error';
import { HotelCabinet } from './hotel-cabinet';
import './hotel-cabinet.css';

/** «Моя работа»: у салона и ресторана кабинет сотрудника, у гостиницы кабинет горничной и ресепшена (22.10.2026) */
export default async function MyWorkPage({ searchParams }: { searchParams: Promise<{ date?: string; month?: string; range?: string }> }) {
  const params = await searchParams;
  const month = typeof params.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : undefined;
  const me = await currentMe().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });
  if (me?.context?.vertical === 'HOSPITALITY') {
    try {
      return (
        <Page title="Моя работа">
          <HotelCabinet data={await hotelStaffApi.cabinet(month)} />
        </Page>
      );
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof ApiError && [403, 404].includes(error.status))
        return (
          <Page title="Моя работа">
            <section className="panel" data-testid="portal-unavailable">
              <h2>Кабинет недоступен</h2>
              <p>Ваш вход не привязан к сотруднику этой гостиницы. Попросите руководителя пригласить вас как «Личный кабинет».</p>
              <a href="/my-work">Повторить загрузку</a>
            </section>
          </Page>
        );
      return (
        <Page title="Моя работа">
          <LoadError testId="portal-load-error" {...loadErrorProps(error)} />
        </Page>
      );
    }
  }
  const query = { ...(typeof params.date === 'string' ? { date: params.date } : {}), ...(typeof params.month === 'string' ? { month: params.month } : {}), ...(params.range === 'month' ? { range: 'month' as const } : {}) };
  return <EmployeePortalScreen target={{ employeeId: null }} query={query} />;
}
