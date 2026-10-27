/**
 * Какие способы показать в форме приёма денег (DATA_MODEL §21.7): включённые в порядке настройки; без списка все.
 * Выбранный раньше способ, который выключили, форма не теряет: `keep` оставляет его последним, чтобы не подменить
 * выбор кассира молча (сервер всё равно ответит, что способ выключен).
 */
/** Способы, выключенные без настройки (домен `BRANCH_PAYMENT_METHODS`, PAYMENT-OTHER-20261025): в «всех» их нет */
// Kaspi и Halyk тоже (NO-KZ-METHODS-20261027): без настройки не предлагаются
const OFF_BY_DEFAULT = new Set(['OTHER', 'KASPI', 'HALYK']);

export function branchMethodsShown<T extends string>(all: readonly T[], enabled: readonly string[] | null, keep?: string): T[] {
  const defaults = all.filter((m) => !OFF_BY_DEFAULT.has(m) || m === keep);
  if (!enabled) return defaults;
  const shown = enabled.filter((m): m is T => (all as readonly string[]).includes(m));
  if (keep && !shown.includes(keep as T) && (all as readonly string[]).includes(keep)) shown.push(keep as T);
  return shown.length ? shown : defaults;
}

/**
 * Все способы для выдачи и возврата денег («расход», «откуда», возврат): прежние шесть всегда, «Другое» только если
 * оно включено или по нему есть остаток (выключили после приёма денег: остаток всё равно надо вывести).
 */
export function branchMethodsAll<T extends string>(
  all: readonly T[],
  enabled: readonly string[] | null,
  withBalance: readonly string[] = [],
): T[] {
  return all.filter((m) => !OFF_BY_DEFAULT.has(m) || enabled?.includes(m) || withBalance.includes(m));
}

/**
 * Остатки кассы филиала (и способы сверки и расхода «из»): включённые способы плюс любой способ, где есть деньги.
 * Выключенный способ с нулём только мешает (салону в Катаре Kaspi и Halyk); с деньгами остаётся, чтобы их перевести.
 */
export function cashMethodsShown<B extends { method: string; balanceMinor: string }>(
  balances: readonly B[],
  enabled: readonly string[],
): B[] {
  return balances.filter((b) => enabled.includes(b.method) || BigInt(b.balanceMinor || '0') !== 0n);
}

/**
 * Способы расхода «из» и сверки кассы: включённые в порядке настройки филиала (владелец поднял Kaspi вверх, касса
 * показывает так же), затем выключенные, по которым есть деньги, в порядке общего списка.
 */
export function cashMethodsList<T extends string>(
  all: readonly T[],
  enabled: readonly string[],
  balances: readonly { method: string; balanceMinor: string }[],
): T[] {
  const on = enabled.filter((m): m is T => (all as readonly string[]).includes(m));
  const withMoney = new Set(balances.filter((b) => BigInt(b.balanceMinor || '0') !== 0n).map((b) => b.method));
  return [...on, ...all.filter((m) => !on.includes(m) && withMoney.has(m))];
}
