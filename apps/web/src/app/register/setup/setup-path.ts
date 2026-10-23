/**
 * Первичная настройка салона, вариант B (решение владельца 21.10.2026, `docs/decisions/2026-10-21-salon-setup-path.md`):
 * слева путь из пяти шагов, справа превью онлайн-записи из настоящих данных салона.
 */
import type { BeautyEmployeeRow, BeautyServiceRow } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { pluralRu } from '../../../lib/plural';

export type SetupStepId = 'profile' | 'services' | 'masters' | 'skills' | 'schedule';
export type SetupStatus = 'done' | 'current' | 'todo' | 'locked';
export interface SetupPathRow {
  id: SetupStepId;
  status: SetupStatus;
  count: number;
  reason: string;
}

export function setupPath({
  profileApplied,
  steps,
  permissions,
}: {
  profileApplied: boolean;
  steps: ReadonlyArray<{ id: string; done: boolean; count: number; reason: string }>;
  permissions?: Partial<Record<string, boolean>> | undefined;
}): SetupPathRow[] {
  const rows: SetupPathRow[] = [
    { id: 'profile', status: profileApplied ? 'done' : 'current', count: 0, reason: '' },
  ];
  let current = !profileApplied;
  for (const id of ['services', 'masters', 'skills', 'schedule'] as const) {
    const step = steps.find((s) => s.id === id);
    const done = Boolean(step?.done);
    const allowed = permissions ? permissions[id] !== false : true;
    let status: SetupStatus = 'todo';
    if (done) status = 'done';
    else if (!allowed) status = 'locked';
    else if (!current) {
      status = 'current';
      current = true;
    }
    rows.push({ id, status, count: step?.count ?? 0, reason: step?.reason ?? '' });
  }
  return rows;
}

export interface BookingPreview {
  services: Array<{ name: string; minutes: number; price: string }>;
  moreServices: number;
  masters: Array<{ name: string; initials: string }>;
}

type PreviewService = Pick<BeautyServiceRow, 'name' | 'durationMinutes' | 'priceMinor' | 'currency' | 'active'> & {
  id?: string;
  location?: { enabled: boolean; priceOverrideMinor: string | null; durationOverrideMinutes: number | null } | null;
};
type PreviewEmployee = Pick<BeautyEmployeeRow, 'name' | 'active' | 'locationIds'> & {
  id?: string;
  serviceIds?: string[];
  personnelKind?: BeautyEmployeeRow['personnelKind'];
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toLocaleUpperCase('ru'))
    .join('');

/** Что клиент увидит в онлайн-записи этого филиала: услуги филиала с его ценой и специалисты филиала */
export function bookingPreview(
  services: readonly PreviewService[],
  employees: readonly PreviewEmployee[],
  locationId: string,
): BookingPreview {
  const sellable = services.filter((s) => s.active && s.location?.enabled);
  const masters = employees.filter(
    (e) => e.active && e.locationIds.includes(locationId) && e.personnelKind !== 'OTHER_EMPLOYEE',
  );
  return {
    services: sellable.slice(0, 4).map((s) => ({
      name: s.name,
      minutes: s.location?.durationOverrideMinutes ?? s.durationMinutes,
      price: formatMoney(s.location?.priceOverrideMinor ?? s.priceMinor, s.currency),
    })),
    moreServices: Math.max(0, sellable.length - 4),
    masters: masters.slice(0, 6).map((e) => ({ name: e.name, initials: initials(e.name) })),
  };
}

/** Итог выполненного шага настройки словами владельца (аудит салона 22.10.2026: «Пригодных сочетаний услуги и графика: 8») */
export function setupCountLine(id: Exclude<SetupStepId, 'profile'>, count: number): string {
  switch (id) {
    case 'services':
      return `Услуг в филиале: ${count}`;
    case 'masters':
      return `Мастеров: ${count}`;
    case 'skills':
      return `Услуг назначено мастерам: ${count}`;
    case 'schedule':
      return `Можно записаться: ${pluralRu(count, ['вариант', 'варианта', 'вариантов'])} услуги и мастера`;
  }
}
