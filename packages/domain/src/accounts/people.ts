import type { MembershipRole } from './roles';

/**
 * Один экран «Сотрудники» (plans/unified-team-screen-2026-10-25.md, решение владельца 25.10.2026, В1–В7 вариант А).
 * Таблицы не сливаются: карточка (`employees`, бизнес) и вход (`memberships`, организация) сводятся в одну строку по
 * `employees.user_id`, которую сервер отдаёт входу списком `employees`. Приглашение с `employee_id` ждёт на строке карточки.
 */
export interface PeopleMember {
  userId: string;
  role: MembershipRole;
  suspended: boolean;
  /** Назначения по бизнесам; пусто: вся организация (DATA_MODEL §31.1) */
  scopes: ReadonlyArray<{ businessId: string }>;
  /** Карточки этого человека по бизнесам организации */
  employees: ReadonlyArray<{ employeeId: string; businessId: string }>;
}
export interface PeopleInvite {
  id: string;
  employeeId: string | null;
}

/** linked: карточка и вход; card: без входа; login: вход без карточки здесь (В3); invited: приглашение ещё не принято */
export type PersonKind = 'linked' | 'card' | 'login' | 'invited';
/** Колонка «Доступ в WETOP»; null: вошедшему входы не открыты (администратор, В2) */
export type PersonAccess = MembershipRole | 'NONE' | 'INVITED' | 'SUSPENDED' | null;

export interface PersonRow<E, M, I> {
  kind: PersonKind;
  access: PersonAccess;
  employee?: E;
  member?: M;
  invite?: I;
}

export function pairPeople<E extends { id: string }, M extends PeopleMember, I extends PeopleInvite>(input: {
  businessId: string;
  employees: readonly E[];
  /** null: списка входов нет (право `staff` не дано) */
  members: readonly M[] | null;
  invites: readonly I[] | null;
}): Array<PersonRow<E, M, I>> {
  const { businessId } = input;
  const access = (m?: M, i?: I): PersonAccess =>
    m ? (m.suspended ? 'SUSPENDED' : m.role) : i ? 'INVITED' : input.members === null ? null : 'NONE';
  const memberOf = new Map<string, M>();
  for (const m of input.members ?? [])
    for (const e of m.employees) if (e.businessId === businessId) memberOf.set(e.employeeId, m);
  const inviteOf = new Map((input.invites ?? []).flatMap((i) => (i.employeeId ? [[i.employeeId, i] as const] : [])));

  const cards = input.employees.map((employee): PersonRow<E, M, I> => {
    const member = memberOf.get(employee.id);
    const invite = member ? undefined : inviteOf.get(employee.id);
    return {
      kind: member ? 'linked' : invite ? 'invited' : 'card',
      access: access(member, invite),
      employee,
      ...(member ? { member } : {}),
      ...(invite ? { invite } : {}),
    };
  });
  const paired = new Set([...memberOf.values()].map((m) => m.userId));
  // В6: вход виден в бизнесе, если у него вся организация или назначение сюда
  const logins = (input.members ?? [])
    .filter((m) => !paired.has(m.userId))
    .filter((m) => m.scopes.length === 0 || m.scopes.some((s) => s.businessId === businessId))
    .map((member): PersonRow<E, M, I> => ({ kind: 'login', access: access(member), member }));
  // приглашение карточки другого бизнеса здесь не показывается
  const invites = (input.invites ?? [])
    .filter((i) => i.employeeId === null)
    .map((invite): PersonRow<E, M, I> => ({ kind: 'invited', access: 'INVITED', invite }));

  const rows = [...cards, ...logins, ...invites];
  // В4: владелец первой строкой, остальной порядок как пришёл
  return [...rows.filter((r) => r.member?.role === 'OWNER'), ...rows.filter((r) => r.member?.role !== 'OWNER')];
}
