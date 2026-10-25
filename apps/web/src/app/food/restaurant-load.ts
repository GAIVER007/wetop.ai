import { requireVertical } from '../../lib/vertical-guard';
import { deskShell } from '../../lib/desk-shell';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { mayAccess, type NavigationAccess } from '../../lib/navigation';
import { localInput } from '../beauty/time';
import { accessLevelsFor, type AccessLevel } from '@pms/domain';
import { ApiError } from '../../lib/api-error';
import { msg } from '../../i18n';
import { serverT } from '../../i18n/server';

/** Общая обвязка ресторанных экранов (ADR-159): вертикаль, филиал, права, дата дня филиала */
export interface RestaurantShell {
  date: string;
  timezone: string;
  branchName: string;
  scopeKey: string;
  readOnly: boolean;
  /** права вошедшего: вкладки раздела «Клиенты» берут пункты меню по ним */
  access: NavigationAccess;
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
  if ((vertical !== 'FOOD_SERVICE' && vertical !== 'BEAUTY') || !verticals.includes(vertical) || !me.context?.businessId || !me.context.locationId) {
    // «Личный кабинет» без филиала в рабочий раздел не пускается: это отказ в доступе (403), а не сбой связи,
    // иначе экран ошибки звал «проверить подключение» (аудит 22.10.2026, P1-2)
    if ((await deskShell()).access.role === 'EMPLOYEE') throw new ApiError(403, (await serverT())(msg('Раздел недоступен')));
    throw new Error((await serverT())(msg('Выберите ресторан и филиал')));
  }
  const [shell, branch] = await Promise.all([deskShell(), selectedWorkspaceBranch()]);
  if (!branch) throw new ApiError(403, (await serverT())(msg('Выбранный филиал недоступен')));
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
    access: shell.access,
    canDesk: mayAccess(shell.access, 'desk'),
    canProperty: mayAccess(shell.access, 'property'),
    canStaff: mayAccess(shell.access, 'staff'),
    canRefunds: mayAccess(shell.access, 'refunds'),
    vertical,
    accessLevels: shell.access.role ? accessLevelsFor(shell.access.role) : [],
    canAllBranches: shell.access.role === 'OWNER' || (mayAccess(shell.access, 'staff') && shell.access.restricted !== true),
  };
}
