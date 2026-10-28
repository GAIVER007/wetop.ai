/**
 * Способы оплаты объекта (DATA_MODEL §21.6, ADR-185, план plans/property-directories-2026-10-07.md).
 * Способы остаются системными кодами `PaymentMethod` (§6): на них завязаны отчёты, сверка наличных,
 * CHECK в базе и запросы оплаты. Объект решает, какие из восьми стойка предлагает при приёме денег
 * и в каком порядке; EXTERNAL не настраивается: это платёж площадки, его ставят каналы.
 */
import { FinanceRuleError } from './finance';

/** Восемь способов, которые объект включает, выключает и упорядочивает; порядок здесь это умолчание */
export const CONFIGURABLE_PAYMENT_METHODS = [
  'CASH',
  'CARD_TERMINAL',
  'KASPI',
  'HALYK',
  'BANK_TRANSFER_PERSON',
  'BANK_TRANSFER_LEGAL',
  'DEPOSIT',
  'CARD_GUARANTEE',
] as const;
export type ConfigurablePaymentMethod = (typeof CONFIGURABLE_PAYMENT_METHODS)[number];

/** Подписи способов для стойки, отчётов и сообщений об отказе: один источник (У10) */
export const PAYMENT_METHOD_RU: Record<string, string> = {
  CASH: 'Наличные',
  CARD_TERMINAL: 'Карта (терминал)',
  KASPI: 'Kaspi',
  HALYK: 'Halyk',
  BANK_TRANSFER_PERSON: 'Перевод от физлица',
  BANK_TRANSFER_LEGAL: 'Перевод от юрлица',
  DEPOSIT: 'Депозит',
  CARD_GUARANTEE: 'Гарантия картой',
  EXTERNAL: 'Внешний канал',
  OTHER: 'Другое',
  BONUS: 'Бонусы',
  GIFT_CERTIFICATE: 'Сертификат',
};
export const paymentMethodRu = (method: string): string => PAYMENT_METHOD_RU[method] ?? method;

export interface PaymentMethodSetting {
  method: BranchPaymentMethod;
  enabled: boolean;
}

const isConfigurable = (method: string): method is ConfigurablePaymentMethod =>
  (CONFIGURABLE_PAYMENT_METHODS as readonly string[]).includes(method);

/**
 * Способы оплаты филиала салона и ресторана (DATA_MODEL §21.7, решение владельца 23.10.2026): шесть денежных
 * способов кассы филиала (§35, `FOOD_PAYMENT_METHODS`) в том же порядке; депозита и гарантии картой у филиала нет.
 */
export const BRANCH_PAYMENT_METHODS = [
  'CASH',
  'CARD_TERMINAL',
  'KASPI',
  'HALYK',
  'BANK_TRANSFER_PERSON',
  'BANK_TRANSFER_LEGAL',
  // «Другое» (PAYMENT-OTHER-20261025, миграция 158): ссылка на оплату, кошелёк, приложение банка; деньги кассы
  'OTHER',
] as const satisfies readonly BranchPaymentMethod[];
export type BranchPaymentMethod = ConfigurablePaymentMethod | 'OTHER';

/**
 * Без строки в базе выключены: «Другое» (новый способ, у действующих филиалов ничего не появляется само) и Kaspi с
 * Halyk (владелец 27.10.2026: «убери везде каспи халык, не привязывайся к Казахстану», NO-KZ-METHODS-20261027).
 * Кто включил Kaspi или Halyk сам, сохраняет их: строка в базе главнее умолчания.
 */
/** Новые способы без строки в базе выключены: у действующих филиалов ничего не появляется само */
const OFF_BY_DEFAULT: ReadonlySet<string> = new Set(['OTHER', 'KASPI', 'HALYK']);

/** Умолчания без строк в базе: все восемь включены в системном порядке (У3) */
export const DEFAULT_PAYMENT_METHOD_SETTINGS: readonly PaymentMethodSetting[] =
  CONFIGURABLE_PAYMENT_METHODS.map((method) => ({ method, enabled: !OFF_BY_DEFAULT.has(method) }));
/** Умолчания филиала (§21.7): прежние шесть включены, «Другое» выключено, поэтому выкладка ничего не меняет */
export const DEFAULT_BRANCH_PAYMENT_METHOD_SETTINGS: readonly PaymentMethodSetting[] =
  BRANCH_PAYMENT_METHODS.map((method) => ({ method, enabled: !OFF_BY_DEFAULT.has(method) }));

/**
 * Строки в полный список выбранного набора: сохранённые по `sortOrder`, недостающие дописываются включёнными
 * в системном порядке (строки появились раньше нового способа), чужие и повторные коды отбрасываются.
 */
function resolveSettings(
  list: readonly BranchPaymentMethod[],
  rows: ReadonlyArray<{ method: string; enabled: boolean; sortOrder: number }>,
): PaymentMethodSetting[] {
  const inList = (m: string): m is BranchPaymentMethod => (list as readonly string[]).includes(m);
  const index = (m: string) => (list as readonly string[]).indexOf(m);
  const out: PaymentMethodSetting[] = [];
  const seen = new Set<string>();
  const known = rows
    .filter((r) => inList(r.method))
    .sort((a, b) => a.sortOrder - b.sortOrder || index(a.method) - index(b.method));
  for (const r of known) {
    if (seen.has(r.method)) continue;
    seen.add(r.method);
    out.push({ method: r.method as BranchPaymentMethod, enabled: r.enabled });
  }
  for (const method of list) if (!seen.has(method)) out.push({ method, enabled: !OFF_BY_DEFAULT.has(method) });
  return out;
}

/** Объект гостиницы (§21.6): восемь способов */
export const resolvePaymentMethodSettings = (
  rows: ReadonlyArray<{ method: string; enabled: boolean; sortOrder: number }>,
): PaymentMethodSetting[] => resolveSettings(CONFIGURABLE_PAYMENT_METHODS, rows);
/** Филиал салона и ресторана (§21.7): шесть способов */
export const resolveBranchPaymentMethodSettings = (
  rows: ReadonlyArray<{ method: string; enabled: boolean; sortOrder: number }>,
): PaymentMethodSetting[] => resolveSettings(BRANCH_PAYMENT_METHODS, rows);

/** Коды включённых способов в порядке показа */
export const enabledPaymentMethods = (
  settings: readonly PaymentMethodSetting[],
): BranchPaymentMethod[] => settings.filter((s) => s.enabled).map((s) => s.method);

export type PaymentMethodSettingsParse =
  | { ok: true; value: PaymentMethodSetting[] }
  | { ok: false; reason: string };

/**
 * Разбор тела сохранения: `{ methods: [{ method, enabled }] }`, все способы набора ровно по разу в порядке показа,
 * хотя бы один включён (У4). Тот же разбор зовут API, форма и подставной API.
 */
function parseSettings(
  list: readonly BranchPaymentMethod[],
  raw: unknown,
): PaymentMethodSettingsParse {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Нечего сохранять' };
  const methods = (raw as { methods?: unknown }).methods;
  if (!Array.isArray(methods))
    return { ok: false, reason: 'methods: список способов оплаты в порядке показа' };
  const out: PaymentMethodSetting[] = [];
  const seen = new Set<string>();
  for (const item of methods) {
    const method =
      item && typeof item === 'object' ? (item as { method?: unknown }).method : undefined;
    const enabled =
      item && typeof item === 'object' ? (item as { enabled?: unknown }).enabled : undefined;
    if (typeof method !== 'string' || !(list as readonly string[]).includes(method))
      return { ok: false, reason: `Неизвестный способ оплаты: ${String(method)}` };
    if (typeof enabled !== 'boolean')
      return { ok: false, reason: `enabled у способа «${paymentMethodRu(method)}»: true или false` };
    if (seen.has(method))
      return { ok: false, reason: `Способ «${paymentMethodRu(method)}» указан дважды` };
    seen.add(method);
    out.push({ method: method as BranchPaymentMethod, enabled });
  }
  const missing = list.filter((m) => !seen.has(m));
  if (missing.length > 0)
    return {
      ok: false,
      reason: `В списке не хватает: ${missing.map(paymentMethodRu).join(', ')}`,
    };
  if (!out.some((s) => s.enabled))
    return { ok: false, reason: 'Хотя бы один способ оплаты должен быть включён' };
  return { ok: true, value: out };
}

/** `PUT /hotel/payment-methods` (§21.6): восемь способов объекта */
export const parsePaymentMethodSettings = (raw: unknown): PaymentMethodSettingsParse =>
  parseSettings(CONFIGURABLE_PAYMENT_METHODS, raw);
/** `PUT /food-service/payment-methods` (§21.7): шесть способов филиала */
export const parseBranchPaymentMethodSettings = (raw: unknown): PaymentMethodSettingsParse =>
  parseSettings(BRANCH_PAYMENT_METHODS, raw);

/**
 * Правило У5: выключенный способ не принимает новых денег. EXTERNAL и коды вне списка это не дело
 * этого правила (их проверяет перечень способов API).
 */
export function assertPaymentMethodEnabled(method: string, enabled: readonly string[]): void {
  if (!isConfigurable(method)) return;
  if (!enabled.includes(method))
    throw new FinanceRuleError(
      `Способ оплаты «${paymentMethodRu(method)}» выключен в настройках объекта`,
    );
}

/**
 * Правило У5 для филиала (§21.7): выключенный способ не принимает новых денег. BONUS и GIFT_CERTIFICATE это не деньги
 * кассы и не дело этого правила, их проверяют свои правила лояльности.
 */
export function assertBranchPaymentMethodEnabled(method: string, enabled: readonly string[]): void {
  if (!(BRANCH_PAYMENT_METHODS as readonly string[]).includes(method)) return;
  if (!enabled.includes(method))
    throw new FinanceRuleError(
      `Способ оплаты «${paymentMethodRu(method)}» выключен в настройках филиала`,
    );
}
