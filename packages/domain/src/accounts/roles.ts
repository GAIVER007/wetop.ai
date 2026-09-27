import { can } from './permissions';

/**
 * Роли в организации (DATA_MODEL §16.1; ADR-083, третья роль и права — ADR-098, §16.5). Роль — готовый набор прав
 * (`permissions.ts`): владелец — всё, управляющий — всё, кроме владельческого, администратор — работа с гостями,
 * диалоги продавца и отчёты на просмотр. `STAFF` в базе прежний, на экране — «администратор».
 */
export type MembershipRole = 'OWNER' | 'MANAGER' | 'STAFF';

export const MEMBERSHIP_ROLES: Readonly<Record<MembershipRole, string>> = {
  OWNER: 'владелец',
  MANAGER: 'управляющий',
  STAFF: 'администратор',
};

/** Роль, с которой зовут приглашением: владельца приглашением не назначают (`invites.role`, CHECK в базе) */
export type InviteRole = Exclude<MembershipRole, 'OWNER'>;

/** Приглашать и отключать сотрудников — владелец и управляющий; кого именно — `invitableRoles` */
export function canManageStaff(role: MembershipRole): boolean {
  return can(role, 'staff');
}

/** Менять настройки ИИ-продавца, загружать знания, «Применить»; диалоги ведут все роли */
export function canConfigureSeller(role: MembershipRole): boolean {
  return can(role, 'seller');
}

/** Кого может позвать: владелец — управляющих и администраторов, управляющий — администраторов (ADR-098) */
export function invitableRoles(actor: MembershipRole): InviteRole[] {
  if (!canManageStaff(actor)) return [];
  return can(actor, 'owner') ? ['MANAGER', 'STAFF'] : ['STAFF'];
}

export function canInvite(actor: MembershipRole, role: MembershipRole): boolean {
  return (invitableRoles(actor) as MembershipRole[]).includes(role);
}

/**
 * Отключить человека с ролью `target` может тот, кто вправе позвать с этой ролью; владельца так не отключить. Себя
 * отключить нельзя — это проверяет вызывающий: роль здесь не отличает себя от другого.
 */
export function canRemoveMember(actor: MembershipRole, target: MembershipRole): boolean {
  return canInvite(actor, target);
}

/** Смена роли на стойке: только владелец и только между управляющим и администратором; владельца — команда сервера */
export function canSetRoleAtDesk(
  actor: MembershipRole,
  current: MembershipRole,
  next: MembershipRole,
): boolean {
  return can(actor, 'owner') && current !== 'OWNER' && next !== 'OWNER';
}

/** Роль в подписи ИИ-помощника строчными — как в эталоне ТЗ (`…|owner|…`, ADR-081 Q-178) */
export function identityRole(role: MembershipRole): string {
  return role.toLowerCase();
}

/** Роль из команды на сервере: `owner`, `manager` или `staff` в любом регистре */
export function parseMembershipRole(raw: string): MembershipRole | null {
  const value = raw.trim().toUpperCase();
  return value === 'OWNER' || value === 'MANAGER' || value === 'STAFF' ? value : null;
}

/** Роль из формы приглашения: `manager` или `staff` в любом регистре; остальное — не роль приглашения */
export function parseInviteRole(raw: unknown): InviteRole | null {
  if (typeof raw !== 'string') return null;
  const value = parseMembershipRole(raw);
  return value === 'MANAGER' || value === 'STAFF' ? value : null;
}

/** Смена роли: у организации всегда остаётся хотя бы один владелец — иначе приглашать и настраивать некому */
export function canChangeRole(input: {
  current: MembershipRole;
  next: MembershipRole;
  /** Сколько владельцев в организации сейчас */
  owners: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.current === 'OWNER' && input.next !== 'OWNER' && input.owners <= 1)
    return { ok: false, reason: 'Это единственный владелец организации: сначала назначьте другого' };
  return { ok: true };
}
