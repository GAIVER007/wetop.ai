import { canInvite, type InviteRole, type MembershipRole } from './roles';

/**
 * Область доступа человека (DATA_MODEL §30, ADR-155, Q-286, Q-287). Членство без назначений работает на всю
 * организацию, как всегда. Если назначения есть, человек работает только там, где они есть, и роль берётся из
 * назначения: бизнес целиком или один филиал. Владелец без назначений: область у него не ограничивается никогда.
 */
export interface ScopeAssignment {
  role: InviteRole;
  businessId: string;
  /** null: назначение на весь бизнес, иначе на один филиал этого бизнеса */
  locationId: string | null;
}

/** Где человек хочет работать: филиал уже внутри бизнеса, бизнес без филиала бывает у запросов уровня бизнеса */
export interface ScopeTarget {
  businessId: string;
  locationId?: string | undefined;
}

const RANK: Readonly<Record<MembershipRole, number>> = { OWNER: 3, MANAGER: 2, STAFF: 1 };

export function higherRole(a: MembershipRole, b: MembershipRole): MembershipRole {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Нет назначений: вся организация (поведение до §30) */
export function isUnrestricted(assignments: readonly ScopeAssignment[]): boolean {
  return assignments.length === 0;
}

/**
 * Роль человека там, где он хочет работать; `null`: туда его не пускают. Владелец всюду владелец. Назначение на
 * бизнес покрывает все его филиалы; назначение на филиал только его. Запрос уровня бизнеса (без филиала) открывает
 * только назначение на весь бизнес, а филиальное назначение туда не пускает.
 */
export function roleAt(
  membershipRole: MembershipRole,
  assignments: readonly ScopeAssignment[],
  target: ScopeTarget,
): MembershipRole | null {
  if (membershipRole === 'OWNER') return 'OWNER';
  if (isUnrestricted(assignments)) return membershipRole;
  let best: MembershipRole | null = null;
  for (const a of assignments) {
    if (a.businessId !== target.businessId) continue;
    const covers = a.locationId === null || a.locationId === target.locationId;
    if (covers) best = best ? higherRole(best, a.role) : a.role;
  }
  return best;
}

/** Филиалы из списка, куда человека пускают: основа для «Выбор филиала» и сводок */
export function visibleLocations<L extends { id: string; businessId: string }>(
  membershipRole: MembershipRole,
  assignments: readonly ScopeAssignment[],
  locations: readonly L[],
): L[] {
  return locations.filter(
    (l) => roleAt(membershipRole, assignments, { businessId: l.businessId, locationId: l.id }) !== null,
  );
}

/** Роль в `memberships.role` для человека с назначениями: старшая из назначенных (пока нет назначений, как была) */
export function membershipRoleFor(
  assignments: readonly ScopeAssignment[],
  fallback: MembershipRole,
): MembershipRole {
  if (assignments.length === 0) return fallback;
  return assignments.map((a) => a.role).reduce<MembershipRole>(higherRole, 'STAFF');
}

export type AssignmentCheck = { ok: true } | { ok: false; reason: string };

/**
 * Проверка набора назначений при приглашении и правке: роль не выше полномочий выдающего (владелец выдаёт управляющего
 * и администратора, управляющий администратора), филиал принадлежит указанному бизнесу из этой организации, повтора
 * и пересечения нет: филиальное назначение внутри бизнеса, который уже назначен целиком, лишнее и спорное.
 * `known`: бизнесы и филиалы организации (из базы, не из запроса).
 */
export function validateAssignments(input: {
  actor: MembershipRole;
  assignments: readonly ScopeAssignment[];
  known: ReadonlyArray<{ businessId: string; locationIds: readonly string[] }>;
}): AssignmentCheck {
  const seen = new Set<string>();
  const wholeBusiness = new Set(
    input.assignments.filter((a) => a.locationId === null).map((a) => a.businessId),
  );
  for (const a of input.assignments) {
    if (!canInvite(input.actor, a.role))
      return { ok: false, reason: 'Эту роль вы назначить не можете: она выше ваших полномочий' };
    const business = input.known.find((b) => b.businessId === a.businessId);
    if (!business) return { ok: false, reason: 'Бизнес не найден в вашей организации' };
    if (a.locationId !== null && !business.locationIds.includes(a.locationId))
      return { ok: false, reason: 'Филиал не относится к выбранному бизнесу' };
    const key = `${a.businessId}:${a.locationId ?? ''}`;
    if (seen.has(key)) return { ok: false, reason: 'Одно и то же назначение указано дважды' };
    seen.add(key);
    if (a.locationId !== null && wholeBusiness.has(a.businessId))
      return {
        ok: false,
        reason: 'Бизнес уже назначен целиком: отдельное назначение на его филиал лишнее',
      };
  }
  return { ok: true };
}
