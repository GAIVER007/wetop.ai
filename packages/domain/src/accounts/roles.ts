/**
 * Роли в организации (DATA_MODEL §16.1, ADR-083, Q-182). Их две. На стойке роль прав не меняет — там ADR-023 в силе:
 * сотрудники равноправны, контроль — журнал с автором. Роль разграничивает только новое: сотрудников и приглашения,
 * настройки ИИ-продавца.
 */
export type MembershipRole = 'OWNER' | 'STAFF';

export const MEMBERSHIP_ROLES: Readonly<Record<MembershipRole, string>> = {
  OWNER: 'владелец',
  STAFF: 'сотрудник',
};

/** Приглашать и отключать сотрудников */
export function canManageStaff(role: MembershipRole): boolean {
  return role === 'OWNER';
}

/** Менять настройки ИИ-продавца, загружать знания, «Применить»; диалоги и «Проверку» ведут все */
export function canConfigureSeller(role: MembershipRole): boolean {
  return role === 'OWNER';
}

/** Роль в подписи ИИ-помощника строчными — как в эталоне ТЗ (`…|owner|…`, ADR-081 Q-178) */
export function identityRole(role: MembershipRole): string {
  return role.toLowerCase();
}

/** Роль из команды на сервере: `owner` или `staff` в любом регистре */
export function parseMembershipRole(raw: string): MembershipRole | null {
  const value = raw.trim().toUpperCase();
  return value === 'OWNER' || value === 'STAFF' ? value : null;
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
