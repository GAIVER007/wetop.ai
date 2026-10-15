import { normalizePhone } from '../web-booking/request';
import { canManageStaff, canRemoveMember, type MembershipRole } from './roles';

/**
 * Сотрудники организации (DATA_MODEL §16.1 v1.14, ADR-107): список людей с ролями, отключение и смена роли. Кто кого
 * отключает и кому меняет роль — `roles.ts` (`canRemoveMember`, `canSetRoleAtDesk`); здесь — слова отказов.
 */
export const MEMBER_NOT_FOUND_MESSAGE = 'Такого сотрудника в организации нет.';
export const MEMBER_SELF_MESSAGE = 'Себя отключить или сменить себе роль нельзя.';
export const MEMBER_OWNER_MESSAGE =
  'Владельца организации отключает и назначает только команда на сервере.';
export const MEMBER_MANAGER_REMOVES_STAFF_MESSAGE = 'Управляющий отключает только администраторов.';
export const MEMBER_ROLE_MESSAGE = 'Роль сотрудника — «управляющий» или «администратор».';
export const MEMBER_ROLE_OWNER_ONLY_MESSAGE = 'Роль сотрудника меняет только владелец организации.';

// ── Телефон и должность (TEAM2, Q-244, DATA_MODEL v2.10 §13.3) ─────────────────────────────────

export const MEMBER_PHONE_MESSAGE = 'Проверьте телефон: номер целиком, с 8 или кодом страны.';
export const MEMBER_POSITION_MESSAGE = 'Должность: не длиннее 100 знаков.';
export const MEMBER_DETAILS_FORBIDDEN_MESSAGE =
  'Контакты управляющего меняет владелец, контакты владельца меняет он сам.';
const POSITION_MAX = 100;

/** Свои контакты правит тот, кому открыт раздел; чужие: тот, кто вправе этого человека отключить */
export function canEditMemberDetails(
  actor: MembershipRole,
  target: MembershipRole,
  self: boolean,
): boolean {
  return self ? canManageStaff(actor) : canRemoveMember(actor, target);
}

/** Тело правки из формы: пустое поле стирает значение (NULL), телефон: `+` и цифры, как у брони с сайта */
export function parseMemberDetails(
  raw: unknown,
): { ok: true; phone: string | null; position: string | null } | { ok: false; message: string } {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v);
  const phoneRaw = text(b.phone ?? '');
  const position = text(b.position ?? '');
  if (typeof phoneRaw !== 'string') return { ok: false, message: MEMBER_PHONE_MESSAGE };
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) return { ok: false, message: MEMBER_PHONE_MESSAGE };
  if (typeof position !== 'string' || position.length > POSITION_MAX)
    return { ok: false, message: MEMBER_POSITION_MESSAGE };
  return { ok: true, phone, position: position || null };
}
