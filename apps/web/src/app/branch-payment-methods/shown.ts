/**
 * Какие способы показать в форме приёма денег (DATA_MODEL §21.7): включённые в порядке настройки; без списка все.
 * Выбранный раньше способ, который выключили, форма не теряет: `keep` оставляет его последним, чтобы не подменить
 * выбор кассира молча (сервер всё равно ответит, что способ выключен).
 */
export function branchMethodsShown<T extends string>(all: readonly T[], enabled: readonly string[] | null, keep?: string): T[] {
  if (!enabled) return [...all];
  const shown = enabled.filter((m): m is T => (all as readonly string[]).includes(m));
  if (keep && !shown.includes(keep as T) && (all as readonly string[]).includes(keep)) shown.push(keep as T);
  return shown.length ? shown : [...all];
}
