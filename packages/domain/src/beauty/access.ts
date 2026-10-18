/** Owner-approved BEAUTY-ACCESS-20261018. Names are labels, only explicit grants authorize. */
export const BEAUTY_SECTIONS = ['journal', 'appointments', 'customers', 'employees', 'services', 'finance', 'stock', 'settings', 'payroll', 'reviews'] as const;
export const BEAUTY_ACTIONS = ['view', 'create', 'update', 'delete', 'refund'] as const;
export type BeautySection = typeof BEAUTY_SECTIONS[number];
export type BeautyAction = typeof BEAUTY_ACTIONS[number];
export type BeautyPermissionScope = 'OWN' | 'BUSINESS';
export interface BeautyPermission { section: BeautySection; action: BeautyAction; scope: BeautyPermissionScope }
export interface BeautyAssignment {
  businessId: string;
  locationId: string | null;
  revokedAt: Date | string | null;
  position: { archivedAt: Date | string | null; permissions: readonly BeautyPermission[] };
}
export interface BeautyPositionAccess {
  mode: 'LEGACY' | 'ASSIGNED';
  assigned: boolean;
  permissions: BeautyPermission[];
}
export const BEAUTY_SECTION_LABELS: Record<BeautySection, string> = {
  journal: 'Календарь и график', appointments: 'Записи', customers: 'Клиенты', employees: 'Сотрудники', services: 'Услуги и техкарты', finance: 'Финансы', stock: 'Склад', settings: 'Настройки салона', payroll: 'Зарплата', reviews: 'Отзывы',
};
export const BEAUTY_ACTION_LABELS: Record<BeautyAction, string> = { view: 'Просмотр', create: 'Создание', update: 'Изменение', delete: 'Удаление', refund: 'Возврат' };
const OWN_SECTIONS = new Set<BeautySection>(['journal', 'appointments', 'payroll', 'reviews']);

export function parseBeautyPermissions(raw: unknown): { ok: true; value: BeautyPermission[] } | { ok: false; reason: string } {
  if (!Array.isArray(raw) || raw.length > BEAUTY_SECTIONS.length * 4 + 1)
    return { ok: false, reason: 'Пришлите список прав должности' };
  const value: BeautyPermission[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some(key => !['section', 'action', 'scope'].includes(key)))
      return { ok: false, reason: 'Проверьте поля права должности' };
    const { section, action, scope } = entry as Record<string, unknown>;
    if (!BEAUTY_SECTIONS.includes(section as BeautySection) || !BEAUTY_ACTIONS.includes(action as BeautyAction) || (typeof scope !== 'string' || !['OWN', 'BUSINESS'].includes(scope)))
      return { ok: false, reason: 'Неизвестный раздел, действие или область доступа' };
    const permission = { section, action, scope } as BeautyPermission;
    if (action === 'refund' && (section !== 'finance' || scope !== 'BUSINESS'))
      return { ok: false, reason: 'Возврат разрешается отдельным правом финансов' };
    if (scope === 'OWN' && (action !== 'view' || !OWN_SECTIONS.has(permission.section)))
      return { ok: false, reason: 'Своя область доступна только для просмотра записей, графика, зарплаты и отзывов' };
    const key = `${section}:${action}`;
    if (seen.has(key)) return { ok: false, reason: 'Право раздела повторяется' };
    seen.add(key);
    value.push(permission);
  }
  return { ok: true, value };
}

export function beautyPermissionScope(permissions: readonly BeautyPermission[], section: BeautySection, action: BeautyAction): BeautyPermissionScope | null {
  const matches = permissions.filter(permission => permission.section === section && permission.action === action);
  return matches.some(permission => permission.scope === 'BUSINESS') ? 'BUSINESS' : matches.some(permission => permission.scope === 'OWN') ? 'OWN' : null;
}

export function resolveBeautyPositionAccess(assignments: readonly BeautyAssignment[], target: { businessId: string; locationId?: string | null }): BeautyPositionAccess {
  if (!assignments.length) return { mode: 'LEGACY', assigned: false, permissions: [] };
  const applicable = assignments.filter(row => row.revokedAt === null && row.position.archivedAt === null && row.businessId === target.businessId && (row.locationId === null || row.locationId === target.locationId));
  const grants = new Map<string, BeautyPermission>();
  for (const row of applicable) for (const permission of row.position.permissions) {
    const key = `${permission.section}:${permission.action}`;
    if (grants.get(key)?.scope !== 'BUSINESS') grants.set(key, { ...permission });
  }
  return { mode: 'ASSIGNED', assigned: applicable.length > 0, permissions: [...grants.values()] };
}
