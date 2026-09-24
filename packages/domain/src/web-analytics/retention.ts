/**
 * Хранение сырых данных счётчика сайта (план среза 8 §12, DATA_MODEL §11): 13 месяцев, дальше сессия удаляется,
 * с ней каскадом просмотры и события. Одна граница на ручной `npm run analytics:retention` и суточную очистку API
 * (`apps/api/src/analytics/retention.service.ts`).
 */
export const WEB_RETENTION_MONTHS = 13;

/** Сессии, начатые раньше этой минуты, удаляются. Месяцы — по UTC, как считал первый скрипт хранения. */
export function webRetentionCutoff(now: Date, months: number = WEB_RETENTION_MONTHS): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return cutoff;
}
