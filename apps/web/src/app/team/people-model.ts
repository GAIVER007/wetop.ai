import { MEMBERSHIP_ROLES, pairPeople, type PersonAccess, type PersonRow } from '@pms/domain';
import { msg } from '../../i18n';
import type { AuthInvite, AuthInviteExtra, AuthMember } from '../../lib/api';

/**
 * Общий экран «Сотрудники» салона и ресторана (plans/unified-team-screen-2026-10-25.md, U2): карточки из прежних
 * досок и входы организации одной строкой на человека. Без списка входов (администратор, В2) строки только карточки.
 */
export interface TeamPeople {
  businessId: string;
  members: AuthMember[];
  invites: AuthInvite[];
}
export type Person<E> = PersonRow<E, AuthMember, AuthInvite> & { id: string };

export function peopleRows<E extends { id: string }>(employees: readonly E[], team: TeamPeople | null): Person<E>[] {
  return pairPeople({
    businessId: team?.businessId ?? '',
    employees,
    // старый API этих полей не присылает: пары нет, строки остаются
    members: team ? team.members.map((m) => ({ ...m, employees: m.employees ?? [] })) : null,
    invites: team ? team.invites.map((i) => ({ ...i, employeeId: i.employeeId ?? null })) : null,
  }).map((row) => ({
    ...row,
    id: row.employee?.id ?? (row.member ? `member:${row.member.userId}` : `invite:${row.invite!.id}`),
  }));
}

/** Вкладка «Все», прежние вкладки карточек, и при списке входов «С доступом» и «Ждут приглашения» */
export function peopleTabs<E extends { id: string }>(
  rows: Person<E>[],
  employeeTabs: ReadonlyArray<{ id: string; rows: readonly E[] }>,
  withAccess: boolean,
): Array<{ id: string; rows: Person<E>[] }> {
  const byEmployee = new Map(rows.flatMap((r) => (r.employee ? [[r.employee.id, r] as const] : [])));
  return [
    { id: 'all', rows },
    ...employeeTabs.map((tab) => ({
      id: tab.id,
      rows: tab.rows.flatMap((e) => (byEmployee.has(e.id) ? [byEmployee.get(e.id)!] : [])),
    })),
    ...(withAccess
      ? [
          { id: 'access', rows: rows.filter((r) => r.member) },
          { id: 'invited', rows: rows.filter((r) => r.kind === 'invited') },
        ]
      : []),
  ];
}

const capital = (text: string) => text.charAt(0).toLocaleUpperCase('ru') + text.slice(1);

/** Слова колонки «Доступ в WETOP»; null: колонки нет */
export function accessLabel(access: PersonAccess): string {
  if (access === null) return '';
  if (access === 'NONE') return msg('Без входа');
  if (access === 'INVITED') return msg('Ждёт ответа');
  if (access === 'SUSPENDED') return msg('Приостановлен');
  return capital(MEMBERSHIP_ROLES[access]);
}

/**
 * Что уходит при «Отправить заново»: прежнее приглашение отзывается и создаётся новое. Карточка (`employeeId`) и «все
 * филиалы» (у приглашения с карточкой это пустые назначения) должны уйти вместе с ним, иначе вход не привяжется.
 */
export function resendExtra(i: AuthInvite): AuthInviteExtra {
  return {
    ...(i.firstName ? { firstName: i.firstName } : {}),
    ...(i.lastName ? { lastName: i.lastName } : {}),
    ...(i.position ? { position: i.position } : {}),
    ...(i.scopes && i.scopes.length > 0 ? { scopes: i.scopes } : {}),
    ...(i.employeeId ? { employeeId: i.employeeId } : {}),
    ...(i.employeeId && !(i.scopes && i.scopes.length > 0) ? { allBranches: true } : {}),
  };
}
