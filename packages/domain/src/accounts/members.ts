/**
 * Сотрудники организации (DATA_MODEL §16.1 v1.13, ADR-100): список людей с ролями, отключение и смена роли. Кто кого
 * отключает и кому меняет роль — `roles.ts` (`canRemoveMember`, `canSetRoleAtDesk`); здесь — слова отказов.
 */
export const MEMBER_NOT_FOUND_MESSAGE = 'Такого сотрудника в организации нет.';
export const MEMBER_SELF_MESSAGE = 'Себя отключить или сменить себе роль нельзя.';
export const MEMBER_OWNER_MESSAGE =
  'Владельца организации отключает и назначает только команда на сервере.';
export const MEMBER_MANAGER_REMOVES_STAFF_MESSAGE = 'Управляющий отключает только администраторов.';
export const MEMBER_ROLE_MESSAGE = 'Роль сотрудника — «управляющий» или «администратор».';
export const MEMBER_ROLE_OWNER_ONLY_MESSAGE = 'Роль сотрудника меняет только владелец организации.';
