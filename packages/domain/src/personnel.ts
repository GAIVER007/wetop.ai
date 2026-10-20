/** Explicit assignment chosen by the manager, independent of access roles and services. */
export const PERSONNEL_KINDS = ['SPECIALIST', 'OTHER_EMPLOYEE', 'BOTH'] as const;
export type PersonnelKind = typeof PERSONNEL_KINDS[number];

/** Command input must name an assignment; unknown legacy values are not valid commands. */
export function parsePersonnelKind(value: unknown): PersonnelKind {
  if (typeof value === 'string' && PERSONNEL_KINDS.includes(value as PersonnelKind)) {
    return value as PersonnelKind;
  }
  throw new RangeError('Укажите назначение сотрудника');
}

/** Keep unknown legacy assignments visible, and reuse one employee object for both lists. */
export function personnelLists<T extends { personnelKind: PersonnelKind | null }>(
  people: readonly T[],
): { specialists: T[]; employees: T[]; unassigned: T[] } {
  const result: { specialists: T[]; employees: T[]; unassigned: T[] } = {
    specialists: [],
    employees: [],
    unassigned: [],
  };
  for (const person of people) {
    if (person.personnelKind === null) {
      result.unassigned.push(person);
      continue;
    }
    const kind = parsePersonnelKind(person.personnelKind);
    if (kind !== 'OTHER_EMPLOYEE') result.specialists.push(person);
    if (kind !== 'SPECIALIST') result.employees.push(person);
  }
  return result;
}
