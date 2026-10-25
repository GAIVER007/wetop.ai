import type { InviteRole } from '@pms/domain';
import type { AuthAccessStructure, AuthScope } from '../../lib/api';
import { translator, type Translate } from '../../i18n';

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
  t: Translate = translator('ru'),
): string => {
  if (scopes.length === 0) return t('Вся организация');
  const names = scopes.map((s) => {
    const business = structure?.businesses.find((b) => b.id === s.businessId);
    if (s.locationId === null) return t('{name} (весь)', { name: business?.name ?? t('Бизнес') });
    return business?.locations.find((l) => l.id === s.locationId)?.name ?? t('Филиал');
  });
  return names.length <= 2
    ? names.join(', ')
    : t('{names} и ещё {n}', { names: names.slice(0, 2).join(', '), n: names.length - 2 });
};

/** Проверяем ответ API до разрешения команды: пустая успешная структура допустима, ошибка нет. */
export function validAccessStructure(value: unknown): value is AuthAccessStructure {
  if (
    !value ||
    typeof value !== 'object' ||
    !('businesses' in value) ||
    !Array.isArray(value.businesses)
  )
    return false;
  return value.businesses.every((b: unknown) => {
    if (!b || typeof b !== 'object') return false;
    const item = b as Record<string, unknown>;
    return (
      typeof item.id === 'string' &&
      !!item.id &&
      typeof item.name === 'string' &&
      typeof item.vertical === 'string' &&
      ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'].includes(item.vertical) &&
      Array.isArray(item.locations) &&
      item.locations.every((l: unknown) => {
        if (!l || typeof l !== 'object') return false;
        const location = l as Record<string, unknown>;
        return (
          typeof location.id === 'string' && !!location.id && typeof location.name === 'string'
        );
      })
    );
  });
}

/** Потерянное назначение не отбрасываем молча: пользователь должен проверить выбор. */
export function scopeSelectionValid(structure: AuthAccessStructure, model: ScopeModel): boolean {
  const keys = new Set(
    structure.businesses.flatMap((b) => [`b:${b.id}`, ...b.locations.map((l) => `l:${l.id}`)]),
  );
  return Object.entries(model).every(([key, role]) => !role || keys.has(key));
}
