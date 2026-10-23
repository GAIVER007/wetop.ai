import { unstable_rethrow } from 'next/navigation';
import { Page } from '../page';
import { LoadError } from '../load-error';
import { employeePortalApi, type PortalTarget } from '../../lib/employee-portal-api';
import { requestScopeHeader } from '../../lib/scope-pointer';
import { loadErrorProps } from '../../lib/load-error';
import { ApiError } from '../../lib/api-error';
import { EmployeeCabinet } from './cabinet';
import type { PortalAccountOption } from './management';
import type { BeautyEmployeeServicePriceRow, BeautySchedule } from '../../lib/api';
import type { BeautyMasterDayStatus } from '../../lib/beauty-master-day-status';
import './portal.css';
export async function EmployeePortalScreen({ target, query = {}, locationAssignments, servicePrices, accountOptions, dayStatus }: { target: PortalTarget; query?: { date?: string; month?: string; range?: 'month' }; locationAssignments?: BeautySchedule['locations'] | null; servicePrices?: BeautyEmployeeServicePriceRow[] | null; accountOptions?: PortalAccountOption[] | null; dayStatus?: BeautyMasterDayStatus }) {
  try {
    const [data, headers] = await Promise.all([employeePortalApi.load(target, query), requestScopeHeader()]);
    return <Page title={data.access === 'MANAGER' ? 'Карточка сотрудника' : 'Моя работа'}>
      <EmployeeCabinet key={`${headers['x-wetop-scope'] ?? ''}:${data.employee.id}`} initial={data} target={target} scope={headers['x-wetop-scope'] ?? ''} {...(data.access === 'MANAGER' && locationAssignments !== undefined ? { locationAssignments } : {})} {...(data.access === 'MANAGER' && servicePrices !== undefined ? { servicePrices } : {})} {...(data.access === 'MANAGER' && accountOptions !== undefined ? { accountOptions } : {})} {...(dayStatus !== undefined ? { dayStatus } : {})} />
    </Page>;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && [403, 404, 409].includes(error.status)) return <Page title="Моя работа"><section className="panel portal-section" data-testid="portal-unavailable"><h2>Кабинет недоступен</h2><p>Сотрудник не связан с вашим аккаунтом или недоступен в выбранном бизнесе. Попросите руководителя проверить привязку существующего участника команды.</p><a href="/my-work">Повторить загрузку</a></section></Page>;
    return <Page title="Моя работа"><LoadError testId="portal-load-error" {...loadErrorProps(error)} /></Page>;
  }
}
