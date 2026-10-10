import { requireVertical } from '../../lib/vertical-guard';
import { deskShell } from '../../lib/desk-shell';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { mayAccess } from '../../lib/navigation';
import { localInput } from '../beauty/time';

/** Общая обвязка ресторанных экранов (ADR-159): вертикаль, филиал, права, дата дня филиала */
export interface RestaurantShell {
  date: string;
  timezone: string;
  branchName: string;
  scopeKey: string;
  readOnly: boolean;
  canDesk: boolean;
  canProperty: boolean;
  canStaff: boolean;
}

export async function restaurantShell(dateParam?: string): Promise<RestaurantShell> {
  const me = await requireVertical(['FOOD_SERVICE']);
  if (me.context?.vertical !== 'FOOD_SERVICE' || !me.context.businessId || !me.context.locationId)
    throw new Error('Выберите ресторан и филиал');
  const [shell, branch] = await Promise.all([deskShell(), selectedWorkspaceBranch()]);
  if (!branch) throw new Error('Выбранный филиал недоступен');
  const local = localInput(new Date().toISOString(), branch.timezone);
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && !Number.isNaN(Date.parse(dateParam))
      ? dateParam
      : local.slice(0, 10);
  return {
    date,
    timezone: branch.timezone,
    branchName: branch.name,
    scopeKey: `${me.context.businessId}:${me.context.locationId}`,
    readOnly: shell.readOnly,
    canDesk: mayAccess(shell.access, 'desk'),
    canProperty: mayAccess(shell.access, 'property'),
    canStaff: mayAccess(shell.access, 'staff'),
  };
}
