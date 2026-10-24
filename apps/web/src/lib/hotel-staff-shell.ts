import { ApiError } from './api-error';
import { deskShell } from './desk-shell';
import { hotelToday } from './hotel-api';
import { mayAccess } from './navigation';
import { requireVertical } from './vertical-guard';

/**
 * Обвязка экранов персонала гостиницы (график, зарплата; 22.10.2026): филиал, права и дата по часам объекта.
 * Филиал гостиницы известен из указателя; `selectedWorkspaceBranch` гостиницу не отдаёт (только салон и ресторан),
 * поэтому день берётся из настроек объекта (`hotelToday`).
 */
export async function hotelShell() {
  const me = await requireVertical(['HOSPITALITY']);
  if (me.context?.vertical !== 'HOSPITALITY' || !me.context.businessId || !me.context.locationId) {
    if ((await deskShell()).access.role === 'EMPLOYEE') throw new ApiError(403, 'Раздел недоступен');
    throw new Error('Выберите гостиницу и филиал');
  }
  const [shell, date] = await Promise.all([deskShell(), hotelToday()]);
  return {
    date,
    scopeKey: `${me.context.businessId}:${me.context.locationId}`,
    readOnly: shell.readOnly,
    canStaff: mayAccess(shell.access, 'staff'),
  };
}
