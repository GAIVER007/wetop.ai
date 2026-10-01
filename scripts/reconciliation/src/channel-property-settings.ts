/**
 * Настройки объекта в Channex, чистая часть: какие три поля смотрим и какие значения советует Channex
 * (hotels-collection.md → Property Settings). CLI рядом: cli-channex-property-settings.ts; тест: tests/unit/channel-property-settings.test.ts.
 */
const KEYS = [
  'allow_availability_autoupdate_on_confirmation',
  'allow_availability_autoupdate_on_modification',
  'allow_availability_autoupdate_on_cancellation',
] as const;
/** hotels-collection.md, Property Settings: confirmation по умолчанию true, два остальных «Recommended Setting is false» */
export const RECOMMENDED: Record<(typeof KEYS)[number], boolean> = {
  allow_availability_autoupdate_on_confirmation: true,
  allow_availability_autoupdate_on_modification: false,
  allow_availability_autoupdate_on_cancellation: false,
};

export function settingsReport(settings: Record<string, unknown> | undefined): {
  lines: string[];
  differs: boolean;
} {
  const lines: string[] = [];
  let differs = false;
  for (const key of KEYS) {
    const value = settings?.[key];
    const want = RECOMMENDED[key];
    const ok = value === want;
    if (!ok) differs = true;
    lines.push(`${key}: ${value === undefined ? 'не задано' : String(value)}${ok ? '' : ` (рекомендовано ${want})`}`);
  }
  return { lines, differs };
}

