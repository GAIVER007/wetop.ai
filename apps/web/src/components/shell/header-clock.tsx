'use client';
import { useEffect, useState } from 'react';
import { usePropertyClock } from '../property-time';
import { FALLBACK_TIMEZONE } from '../../lib/property-time';
import { useLocale } from '../../i18n/locale-provider';
import './header-clock.css';

const safeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat('ru-RU', { timeZone });
    return timeZone;
  } catch {
    return FALLBACK_TIMEZONE;
  }
};

/** Части подписи: «24 октября», «24 окт.», «20:00», «суббота» по поясу филиала и языку стойки */
export function headerClockParts(now: Date, timezone: string, locale: string) {
  const timeZone = safeZone(timezone);
  const lang = locale === 'kk' ? 'kk-KZ' : locale === 'en' ? 'en-GB' : 'ru-RU';
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang, { timeZone, ...o }).format(now);
  return {
    date: part({ day: 'numeric', month: 'long' }),
    short: part({ day: 'numeric', month: 'short' }),
    time: new Intl.DateTimeFormat('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now),
    weekday: part({ weekday: 'long' }),
  };
}

/**
 * Дата и время филиала рядом со знаком WETOP (владелец 24.10.2026, вариант A: «давай со временем»): вместо второго
 * поля поиска, ищут в строке отборов журнала и по Ctrl K. До первой отрисовки в браузере место пустое, чтобы
 * серверная и браузерная разметка совпали; дальше минута меняется сама.
 */
export function HeaderClock() {
  const clock = usePropertyClock();
  const locale = useLocale();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  if (!now) return <span className="header-clock" aria-hidden="true" />;
  const p = headerClockParts(now, clock.timezone, locale);
  return (
    <span className="header-clock" data-testid="header-clock" title={`${p.date}, ${p.weekday}, ${p.time}`}>
      <b className="header-clock__date">
        <span className="header-clock__long">{p.date}</span>
        <span className="header-clock__short">{p.short}</span>
      </b>
      <time className="header-clock__time" dateTime={now.toISOString()}>
        {p.time}
      </time>
      <small className="header-clock__weekday">{p.weekday}</small>
    </span>
  );
}
