import { requireVertical } from '../../lib/vertical-guard';
import { deskShell } from '../../lib/desk-shell';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { mayAccess } from '../../lib/navigation';
import { localInput } from '../beauty/time';
import { accessLevelsFor, type AccessLevel } from '@pms/domain';

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
  /** Аннулировать платёж и операцию кассы (§35) */
  canRefunds: boolean;
  /** Направление филиала: касса (§48) открыта и салону */
  vertical: 'FOOD_SERVICE' | 'BEAUTY';
  /** Уровни доступа, которые может выдать вошедший при добавлении сотрудника (решение 20.10.2026) */
  accessLevels: AccessLevel[];
  /** «Все филиалы» в «Доступе в WETOP»: только владелец и сотрудник без ограничения по филиалам */
  canAllBranches: boolean;
}

export async function restaurantShell(
  dateParam?: string,
  verticals: ReadonlyArray<'FOOD_SERVICE' | 'BEAUTY'> = ['FOOD_SERVICE'],
): Promise<RestaurantShell> {
  const me = await requireVertical([...verticals]);
  const vertical = me.context?.vertical;
  if ((vertical !== 'FOOD_SERVICE' && vertical !== 'BEAUTY') || !verticals.includes(vertical) || !me.context?.businessId || !me.context.locationId)
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
    canRefunds: mayAccess(shell.access, 'refunds'),
    vertical,
    accessLevels: shell.access.role ? accessLevelsFor(shell.access.role) : [],
    canAllBranches: shell.access.role === 'OWNER' || (mayAccess(shell.access, 'staff') && shell.access.restricted !== true),
  };
}
