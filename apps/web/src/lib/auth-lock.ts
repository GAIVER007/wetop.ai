/**
 * Замок стойки: включён ли вход. Правило зеркально API (`apps/api/src/auth/auth.guard.ts`, ТЗ аудита
 * 25.09.2026, В-2 — fail-closed): в production замок включён всегда и выключается только явным '0';
 * вне production включается любым значением, кроме «0» и «false» (ADR-095) — без значения сквозные наборы, dev-стенд и демо работают
 * без входа. Чистая функция, чтобы правило было доказано модульным тестом без next/headers.
 */
export function lockRequired(value: string | undefined, nodeEnv: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  // в production снимает только явный «0»: «false», пустая строка или опечатка замок не открывают
  if (nodeEnv === 'production') return v !== '0';
  // вне production: без значения, «0» и «false» — без входа; любое другое значение включает, а не снимает (ADR-095)
  return !!v && v !== '0' && v !== 'false';
}
