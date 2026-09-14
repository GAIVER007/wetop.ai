import { localeInfo, type Locale } from '../i18n';

/** `2026-09-14` → «14 сентября 2026». Дата статьи — календарный день, часовой пояс её не сдвигает. */
export function formatPostDate(isoDate: string, locale?: Locale): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(localeInfo(locale).dateLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(date)
    .replace(/\s*г\.$/, '');
}
