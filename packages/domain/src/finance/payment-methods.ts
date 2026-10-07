/**
 * Способы оплаты объекта (DATA_MODEL §21.6, ADR-152, план plans/property-directories-2026-10-07.md).
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
};
export const paymentMethodRu = (method: string): string => PAYMENT_METHOD_RU[method] ?? method;

export interface PaymentMethodSetting {
  method: ConfigurablePaymentMethod;
  enabled: boolean;
}

const isConfigurable = (method: string): method is ConfigurablePaymentMethod =>
  (CONFIGURABLE_PAYMENT_METHODS as readonly string[]).includes(method);
const defaultIndex = (method: string) =>
  (CONFIGURABLE_PAYMENT_METHODS as readonly string[]).indexOf(method);

/** Умолчания без строк в базе: все восемь включены в системном порядке (У3) */
export const DEFAULT_PAYMENT_METHOD_SETTINGS: readonly PaymentMethodSetting[] =
  CONFIGURABLE_PAYMENT_METHODS.map((method) => ({ method, enabled: true }));

/**
 * Строки объекта в полный список: сохранённые по `sortOrder`, недостающие дописываются включёнными
 * в системном порядке (строки появились раньше нового способа), чужие и повторные коды отбрасываются.
 */
export function resolvePaymentMethodSettings(
  rows: ReadonlyArray<{ method: string; enabled: boolean; sortOrder: number }>,
): PaymentMethodSetting[] {
  const out: PaymentMethodSetting[] = [];
  const seen = new Set<string>();
  const known = rows
    .filter((r) => isConfigurable(r.method))
    .sort((a, b) => a.sortOrder - b.sortOrder || defaultIndex(a.method) - defaultIndex(b.method));
  for (const r of known) {
    if (seen.has(r.method)) continue;
    seen.add(r.method);
    out.push({ method: r.method as ConfigurablePaymentMethod, enabled: r.enabled });
  }
  for (const method of CONFIGURABLE_PAYMENT_METHODS)
    if (!seen.has(method)) out.push({ method, enabled: true });
  return out;
}

/** Коды включённых способов в порядке показа */
export const enabledPaymentMethods = (
  settings: readonly PaymentMethodSetting[],
): ConfigurablePaymentMethod[] => settings.filter((s) => s.enabled).map((s) => s.method);

export type PaymentMethodSettingsParse =
  | { ok: true; value: PaymentMethodSetting[] }
  | { ok: false; reason: string };

/**
 * Разбор тела `PUT /hotel/payment-methods`: `{ methods: [{ method, enabled }] }`, все восемь ровно по разу
 * в порядке показа, хотя бы один включён (У4). Тот же разбор зовут API, форма стойки и подставной API.
 */
export function parsePaymentMethodSettings(raw: unknown): PaymentMethodSettingsParse {
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
    if (typeof method !== 'string' || !isConfigurable(method))
      return { ok: false, reason: `Неизвестный способ оплаты: ${String(method)}` };
    if (typeof enabled !== 'boolean')
      return { ok: false, reason: `enabled у способа «${paymentMethodRu(method)}»: true или false` };
    if (seen.has(method))
      return { ok: false, reason: `Способ «${paymentMethodRu(method)}» указан дважды` };
    seen.add(method);
    out.push({ method, enabled });
  }
  const missing = CONFIGURABLE_PAYMENT_METHODS.filter((m) => !seen.has(m));
  if (missing.length > 0)
    return {
      ok: false,
      reason: `В списке не хватает: ${missing.map(paymentMethodRu).join(', ')}`,
    };
  if (!out.some((s) => s.enabled))
    return { ok: false, reason: 'Хотя бы один способ оплаты должен быть включён' };
  return { ok: true, value: out };
}

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
