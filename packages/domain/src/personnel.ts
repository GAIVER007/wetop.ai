/** Явное назначение руководителем; не зависит от ролей доступа и услуг (DATA_MODEL.md, решение 18.10.2026) */
export const PERSONNEL_KINDS = ['SPECIALIST', 'OTHER_EMPLOYEE', 'BOTH'] as const;
export type PersonnelKind = typeof PERSONNEL_KINDS[number];

/** Команда обязана назвать назначение; неизвестное значение не принимается и не угадывается */
export function parsePersonnelKind(value: unknown): PersonnelKind {
  if (typeof value === 'string' && PERSONNEL_KINDS.includes(value as PersonnelKind)) {
    return value as PersonnelKind;
  }
  throw new RangeError('Укажите назначение сотрудника');
}

/** Неназначенные остаются видимыми отдельно; «оба» это один и тот же объект в обоих списках */
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

/** Подписи назначения на экране */
export const PERSONNEL_KIND_LABELS: Readonly<Record<PersonnelKind, string>> = {
  SPECIALIST: 'Специалист',
  OTHER_EMPLOYEE: 'Другой сотрудник',
  BOTH: 'Оба',
};

export type PersonnelTabKey = 'specialists' | 'employees' | 'unassigned';

/** Вкладки экрана: «Не назначено (N)» только при N > 0, чтобы старые записи не терялись и не мешали */
export function personnelTabs<T extends { personnelKind: PersonnelKind | null }>(
  people: readonly T[],
): Array<{ key: PersonnelTabKey; label: string; count: number; items: T[] }> {
  const lists = personnelLists(people);
  const tabs: Array<{ key: PersonnelTabKey; label: string; count: number; items: T[] }> = [
    { key: 'specialists', label: 'Специалисты', count: lists.specialists.length, items: lists.specialists },
    { key: 'employees', label: 'Другие сотрудники', count: lists.employees.length, items: lists.employees },
  ];
  if (lists.unassigned.length > 0)
    tabs.push({
      key: 'unassigned',
      label: `Не назначено (${lists.unassigned.length})`,
      count: lists.unassigned.length,
      items: lists.unassigned,
    });
  return tabs;
}
