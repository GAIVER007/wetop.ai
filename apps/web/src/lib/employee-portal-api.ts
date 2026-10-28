import 'server-only';
import type { EmployeePortalDto, PublicEmployeeDto, PortalProfileInput, PortalPublicationInput, PortalPortfolioInput, PortalPercentBasis, PortalWeekDay } from '@pms/domain';
import { portalTransport } from './api';
import { ApiError } from './api-error';
export type PortalTarget = { employeeId: string | null };
export type EmployeeAccountOption = { userId: string; name: string | null; email: string };
const base = (target: PortalTarget) => target.employeeId
  ? `/employee-portal/employees/${encodeURIComponent(target.employeeId)}` : '/employee-portal/me';
export const employeePortalApi = {
  load: (target: PortalTarget, query: { date?: string; month?: string; range?: 'month' } = {}) =>
    portalTransport<EmployeePortalDto>(`${base(target)}?${new URLSearchParams(query)}`),
  profile: (target: PortalTarget, input: PortalProfileInput) => portalTransport<EmployeePortalDto>(`${base(target)}/profile`, 'PATCH', input),
  avatar: (target: PortalTarget, form: FormData) => portalTransport<EmployeePortalDto>(`${base(target)}/avatar`, 'PUT', form),
  removeAvatar: (target: PortalTarget) => portalTransport<EmployeePortalDto>(`${base(target)}/avatar`, 'DELETE'),
  addWork: (target: PortalTarget, form: FormData) => portalTransport<EmployeePortalDto>(`${base(target)}/portfolio`, 'POST', form),
  work: (target: PortalTarget, id: string, input: PortalPortfolioInput) => portalTransport<EmployeePortalDto>(`${base(target)}/portfolio/${encodeURIComponent(id)}`, 'PATCH', input),
  removeWork: (target: PortalTarget, id: string) => portalTransport<EmployeePortalDto>(`${base(target)}/portfolio/${encodeURIComponent(id)}`, 'DELETE'),
  publication: (target: PortalTarget, input: PortalPublicationInput) => portalTransport<EmployeePortalDto>(`${base(target)}/publication`, 'PUT', input),
  services: (target: PortalTarget, serviceIds: string[], expectedRevision: string) => portalTransport<EmployeePortalDto>(`${base(target)}/services`, 'PUT', { serviceIds, expectedRevision }),
  week: (target: PortalTarget, intervals: Array<PortalWeekDay['intervals'][number] & { weekday: number }>, expectedRevision: string) => portalTransport<EmployeePortalDto>(`${base(target)}/week`, 'PUT', { intervals, expectedRevision }),
  timeOff: (target: PortalTarget, input: { dateFrom: string; dateTo: string; reason: string }) => portalTransport<EmployeePortalDto>(`${base(target)}/time-offs`, 'POST', input),
  removeTimeOff: (target: PortalTarget, id: string) => portalTransport<EmployeePortalDto>(`${base(target)}/time-offs/${encodeURIComponent(id)}`, 'DELETE'),
  // запросы графика мастера (SCHEDULE-REQUESTS-20261028)
  scheduleRequest: (input: { kind: 'WEEK'; intervals: Array<PortalWeekDay['intervals'][number] & { weekday: number }> } | { kind: 'TIME_OFF'; dateFrom: string; dateTo: string; reason: string }) => portalTransport<EmployeePortalDto>('/employee-portal/me/schedule-requests', 'POST', input),
  cancelScheduleRequest: (id: string) => portalTransport<EmployeePortalDto>(`/employee-portal/me/schedule-requests/${encodeURIComponent(id)}/cancel`, 'POST', {}),
  decideScheduleRequest: (employeeId: string, id: string, decision: 'approve' | 'reject', note = '') => portalTransport<EmployeePortalDto>(`/employee-portal/employees/${encodeURIComponent(employeeId)}/schedule-requests/${encodeURIComponent(id)}/${decision}`, 'POST', decision === 'reject' ? { note } : {}),
  account: (target: PortalTarget, userId: string) => portalTransport<EmployeePortalDto>(`${base(target)}/account`, 'PUT', { userId }),
  accountOptions: (employeeId: string) => portalTransport<EmployeeAccountOption[]>(`/employee-portal/employees/${encodeURIComponent(employeeId)}/account-options`),
  unlink: (target: PortalTarget) => portalTransport<EmployeePortalDto>(`${base(target)}/account`, 'DELETE'),
  pay: (target: PortalTarget, input: { model: string; fixedMinor: string; percent: number }) => portalTransport<EmployeePortalDto>(`${base(target)}/pay-settings`, 'PUT', input),
  payPolicy: (percentBasis: PortalPercentBasis, expectedRevision?: string) => portalTransport<{ percentBasis: PortalPercentBasis; revision: string }>('/employee-portal/pay-policy', 'PUT', { percentBasis, ...(expectedRevision ? { expectedRevision } : {}) }),
};
/** Anonymous request, deliberately no session, scope header, auth redirect or private endpoint. */
export async function publicEmployee(slug: string, locationId?: string): Promise<PublicEmployeeDto> {
  const endpoint = process.env.APP_API_URL?.trim() || 'http://127.0.0.1:3001';
  const url = `${endpoint.replace(/\/$/, '')}/employee-portal/public/${encodeURIComponent(slug)}${locationId ? `?${new URLSearchParams({ locationId })}` : ''}`;
  let response: Response;
  try { response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(60_000) }); }
  catch (error) {
    if (!(error instanceof TypeError || error instanceof DOMException)) throw error;
    throw new ApiError(503, 'Страница специалиста временно недоступна.');
  }
  if (!response.ok) throw new ApiError(response.status, response.status === 404 ? 'Специалист не найден или страница ещё не опубликована.' : 'Страница специалиста временно недоступна.');
  return response.json() as Promise<PublicEmployeeDto>;
}
