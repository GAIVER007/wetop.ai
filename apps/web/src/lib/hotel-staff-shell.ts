import { ApiError } from './api-error';
import { deskShell } from './desk-shell';
import { mayAccess } from './navigation';
import { requireVertical } from './vertical-guard';
import { selectedWorkspaceBranch } from './workspace-context';
import { localInput } from '../app/beauty/time';

/** Обвязка экранов персонала гостиницы (график, зарплата; 22.10.2026): филиал, права и дата по его часам */
export async function hotelShell() {
  const me = await requireVertical(['HOSPITALITY']);
  if (me.context?.vertical !== 'HOSPITALITY' || !me.context.businessId || !me.context.locationId) {
    if ((await deskShell()).access.role === 'EMPLOYEE') throw new ApiError(403, 'Раздел недоступен');
    throw new Error('Выберите гостиницу и филиал');
  }
  const [shell, branch] = await Promise.all([deskShell(), selectedWorkspaceBranch()]);
  if (!branch) throw new ApiError(403, 'Выбранный филиал недоступен');
  return {
    date: localInput(new Date().toISOString(), branch.timezone).slice(0, 10),
    scopeKey: `${me.context.businessId}:${me.context.locationId}`,
    readOnly: shell.readOnly,
    canStaff: mayAccess(shell.access, 'staff'),
  };
}
