/**
 * Замок стойки: включён ли вход. Правило зеркально API (`apps/api/src/auth/auth.guard.ts`, ТЗ аудита
 * 25.09.2026, В-2 — fail-closed): в production замок включён всегда и выключается только явным '0';
 * вне production включается явной '1' — сквозные наборы, dev-стенд и демонстрационный режим работают
 * без входа. Чистая функция, чтобы правило было доказано модульным тестом без next/headers.
 */
export function lockRequired(value: string | undefined, nodeEnv: string | undefined): boolean {
  if (value === '0') return false;
  return value === '1' || nodeEnv === 'production';
}
