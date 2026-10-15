import type { InviteRole } from '@pms/domain';
import type { AuthAccessStructure, AuthScope } from '../../lib/api';

/**
 * Область доступа на экране «Сотрудники и доступ» (DATA_MODEL §31.1): модель редактора и подпись в таблице.
 * Модель: ключ `b:<бизнес>` или `l:<филиал>` → роль назначения, пусто: туда доступа нет. Бизнес целиком перекрывает
 * его филиалы: филиальная строка внутри такого бизнеса не отправляется (сервер её и не примет).
 */
export type ScopeModel = Record<string, InviteRole | ''>;

export const fromScopes = (scopes: readonly AuthScope[]): ScopeModel => {
  const model: ScopeModel = {};
  for (const s of scopes) model[s.locationId ? `l:${s.locationId}` : `b:${s.businessId}`] = s.role;
  return model;
};

export const toScopes = (structure: AuthAccessStructure, model: ScopeModel): AuthScope[] => {
  const out: AuthScope[] = [];
  for (const b of structure.businesses) {
    const whole = model[`b:${b.id}`];
    if (whole) {
      out.push({ role: whole, businessId: b.id, locationId: null });
      continue;
    }
    for (const l of b.locations) {
      const role = model[`l:${l.id}`];
      if (role) out.push({ role, businessId: b.id, locationId: l.id });
    }
  }
  return out;
};

/** Есть ли что выбирать: в организации с одним филиалом область не нужна */
export const hasChoice = (structure: AuthAccessStructure | null | undefined): boolean =>
  !!structure && structure.businesses.reduce((n, b) => n + b.locations.length, 0) > 1;

/** Подпись «где работает»: пусто — вся организация; иначе названия, не больше двух, остальные числом */
export const scopeSummary = (
  scopes: readonly AuthScope[],
  structure: AuthAccessStructure | null | undefined,
): string => {
  if (scopes.length === 0) return 'Вся организация';
  const names = scopes.map((s) => {
    const business = structure?.businesses.find((b) => b.id === s.businessId);
    if (s.locationId === null) return `${business?.name ?? 'Бизнес'} (весь)`;
    return business?.locations.find((l) => l.id === s.locationId)?.name ?? 'Филиал';
  });
  return names.length <= 2
    ? names.join(', ')
    : `${names.slice(0, 2).join(', ')} и ещё ${names.length - 2}`;
};
