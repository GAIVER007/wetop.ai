import { PLATFORM_TIMEZONE } from '@pms/domain';

export const ACCESS_TRIAL_DAYS = 14;

/** Сегодня по Алматы плюс 14 дней, YYYY-MM-DD: срок пробного из «Подписок клиентов» (пояс платформы, не UTC) */
export function accessTrialUntil(now: Date = new Date(), days = ACCESS_TRIAL_DAYS): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: PLATFORM_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
