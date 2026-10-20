/**
 * Валюты и часовые пояса, которые предлагают формы настройки (решение владельца 17.10.2026: только страны
 * партнёров). Новая страна партнёра добавляется строкой здесь, все формы подхватят её сами.
 * Сохранённое раньше значение вне списка формы показывают как есть: данные не теряются.
 * Казахстан с 01.03.2024 живёт в одном поясе (UTC+5), поэтому у него один вариант.
 *
 * Пояс идёт от страны (решение по поручению владельца 17.10.2026, Q-SCHED-3): человек выбирает страну, пояс и
 * валюта по умолчанию подставляются сами, пояс отдельно не выбирается. Валюту можно сменить на любую из
 * списка, у USD своей страны и пояса нет.
 */
export const SUPPORTED_COUNTRIES = [
  { code: 'KZ', label: 'Казахстан', zone: 'Asia/Almaty', currency: 'KZT' },
  { code: 'AE', label: 'ОАЭ', zone: 'Asia/Dubai', currency: 'AED' },
  { code: 'QA', label: 'Катар', zone: 'Asia/Qatar', currency: 'QAR' },
] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

/** Страна по коду ISO (как `organizations.country_code`) или по поясу филиала; вне списка — null */
export function countryOf(by: {
  code?: string | null | undefined;
  zone?: string | null | undefined;
}): SupportedCountry | null {
  return (
    SUPPORTED_COUNTRIES.find((c) =>
      by.code ? c.code === by.code.toUpperCase() : c.zone === by.zone,
    ) ?? null
  );
}

export const SUPPORTED_CURRENCIES = [
  { code: 'KZT', label: 'Тенге (KZT)' },
  { code: 'USD', label: 'Доллар США (USD)' },
  { code: 'AED', label: 'Дирхам ОАЭ (AED)' },
  { code: 'QAR', label: 'Катарский риал (QAR)' },
] as const;

export const SUPPORTED_TIMEZONES = [
  { zone: 'Asia/Almaty', label: 'Алматы (Казахстан)' },
  { zone: 'Asia/Dubai', label: 'Дубай (ОАЭ)' },
  { zone: 'Asia/Qatar', label: 'Доха (Катар)' },
] as const;

/** Варианты выбора: текущее значение (если оно вне списка) первым, затем список */
export function currencyOptions(current?: string | null): Array<{ value: string; label: string }> {
  const list = SUPPORTED_CURRENCIES.map((c) => ({
    value: c.code as string,
    label: c.label as string,
  }));
  return current && !list.some((c) => c.value === current)
    ? [{ value: current, label: current }, ...list]
    : list;
}

export function timezoneOptions(current?: string | null): Array<{ value: string; label: string }> {
  const list = SUPPORTED_TIMEZONES.map((z) => ({
    value: z.zone as string,
    label: z.label as string,
  }));
  return current && !list.some((z) => z.value === current)
    ? [{ value: current, label: current.replaceAll('_', ' ') }, ...list]
    : list;
}
