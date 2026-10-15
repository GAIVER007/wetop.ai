/**
 * График мастера и его отсутствия (DATA_MODEL §19.1, Q-251, срез B4).
 *
 * График это недельный шаблон: строки `working_hours` на мастера и филиал, день недели как у
 * `Date.getDay()` (0 воскресенье). Наложение интервалов в одном дне база не ловит (в §19.1 у
 * `working_hours` только уникальность по началу), поэтому его ловят здесь.
 *
 * Отсутствие (`time_offs`) это календарные даты включительно с обеих сторон и на всю сеть: у таблицы
 * нет филиала, мастер уехал целиком. Отсутствие само записи не отменяет, отмена записи это деньги
 * (Q-252 открыт), поэтому наложение на уже созданные записи только показывается человеку.
 */

import { normalizeClockTime } from '../property/settings';
import type { ParseResult } from './catalog';

const REASON_LIMIT = 200;
const INTERVALS_PER_DAY = 4;
const MAX_TIME_OFF_DAYS = 366;

/** Интервал недельного шаблона: день недели и местное время филиала */
export interface WorkingInterval {
  weekday: number;
  timeFrom: string;
  timeTo: string;
}

/** Отсутствие мастера: календарные даты «ГГГГ-ММ-ДД» включительно */
export interface TimeOffInput {
  dateFrom: string;
  dateTo: string;
  reason: string | null;
}

/**
 * Недельный шаблон целиком: список заменяет прежний график мастера в этом филиале, а не дополняет его.
 * Пустой список снимает график, это не ошибка: мастер в филиале не принимает.
 */
export function parseWorkingHoursWeek(raw: unknown): ParseResult<WorkingInterval[]> {
  const body = (raw ?? {}) as Record<string, unknown>;
  const rows = body['intervals'];
  if (!Array.isArray(rows)) return { ok: false, reason: 'Пришлите график списком интервалов' };

  const value: WorkingInterval[] = [];
  for (const row of rows) {
    const item = (row ?? {}) as Record<string, unknown>;
    const weekday = parseWeekday(item['weekday']);
    if (weekday === null) return { ok: false, reason: 'День недели: число от 0 (воскресенье) до 6' };

    const timeFrom = normalizeClockTime(item['timeFrom']);
    const timeTo = normalizeClockTime(item['timeTo']);
    if (timeFrom === null || timeTo === null)
      return { ok: false, reason: 'Время графика в часах и минутах, например 09:00' };
    if (minutes(timeTo) <= minutes(timeFrom))
      return { ok: false, reason: 'Конец рабочего времени должен быть позже начала' };

    value.push({ weekday, timeFrom, timeTo });
  }

  value.sort((a, b) => a.weekday - b.weekday || minutes(a.timeFrom) - minutes(b.timeFrom));

  for (let i = 1; i < value.length; i += 1) {
    const prev = value[i - 1] as WorkingInterval;
    const cur = value[i] as WorkingInterval;
    // вплотную можно (09:00-13:00 и 13:00-20:00), внахлёст нельзя
    if (prev.weekday === cur.weekday && minutes(cur.timeFrom) < minutes(prev.timeTo))
      return { ok: false, reason: 'Интервалы в одном дне накладываются друг на друга' };
  }

  for (let day = 0; day <= 6; day += 1) {
    if (value.filter((i) => i.weekday === day).length > INTERVALS_PER_DAY)
      return { ok: false, reason: 'В одном дне не больше четырёх интервалов' };
  }

  return { ok: true, value };
}

/** День шаблона для экрана: семь дней по порядку недели, с понедельника */
export interface WeekTemplateDay {
  weekday: number;
  intervals: Array<{ timeFrom: string; timeTo: string }>;
}

/** Строки графика по семи дням, пустой день тоже строка: экран рисует неделю целиком */
export function weekTemplate(rows: readonly WorkingInterval[]): WeekTemplateDay[] {
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
    weekday,
    intervals: rows
      .filter((r) => r.weekday === weekday)
      .slice()
      .sort((a, b) => minutes(a.timeFrom) - minutes(b.timeFrom))
      .map((r) => ({ timeFrom: r.timeFrom, timeTo: r.timeTo })),
  }));
}

export function parseTimeOffInput(raw: unknown): ParseResult<TimeOffInput> {
  const body = (raw ?? {}) as Record<string, unknown>;
  const dateFrom = parseDate(body['dateFrom']);
  const dateTo = parseDate(body['dateTo']);
  if (dateFrom === null || dateTo === null) return { ok: false, reason: 'Дата отсутствия в виде ГГГГ-ММ-ДД' };
  if (dateTo < dateFrom) return { ok: false, reason: 'Отсутствие: конец раньше начала, проверьте даты' };
  if (dayDiff(dateFrom, dateTo) + 1 > MAX_TIME_OFF_DAYS)
    return { ok: false, reason: 'Отсутствие длиннее года: проверьте даты' };

  const rawReason = body['reason'];
  const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
  if (reason.length > REASON_LIMIT)
    return { ok: false, reason: `Причина отсутствия: не больше ${REASON_LIMIT} символов` };

  return { ok: true, value: { dateFrom, dateTo, reason: reason || null } };
}

/**
 * Отсутствие в моментах UTC: от местной полуночи первой даты до местной полуночи дня после последней.
 * Конец невключительно, как `[)` у окна записи в §19.1. Пояс берётся на каждую дату отдельно, иначе
 * перевод часов сдвинул бы границу на час.
 */
export function timeOffWindow(input: {
  dateFrom: string;
  dateTo: string;
  timezone: string;
}): { fromUtc: Date; toUtcExclusive: Date } {
  return {
    fromUtc: localMidnightUtc(input.dateFrom, input.timezone),
    toUtcExclusive: localMidnightUtc(dayOffsetUtc(input.dateTo, 1), input.timezone),
  };
}

/** Календарная дата плюс-минус дни. Считается в UTC: это арифметика по календарю, не по поясу */
export function dayOffsetUtc(date: string, days: number): string {
  const at = new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000);
  return at.toISOString().slice(0, 10);
}

// ───────────── местное время филиала ─────────────

/** Момент UTC, в который в этом поясе начинаются сутки `date` */
function localMidnightUtc(date: string, timezone: string): Date {
  const naive = Date.parse(`${date}T00:00:00Z`);
  // смещение зависит от самого момента, поэтому берём его дважды: первая догадка попадает в нужные сутки
  let guess = naive - zoneOffsetMs(new Date(naive), timezone);
  guess = naive - zoneOffsetMs(new Date(guess), timezone);
  return new Date(guess);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(timezone: string): Intl.DateTimeFormat {
  let f = fmtCache.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    fmtCache.set(timezone, f);
  }
  return f;
}

/** Насколько местное время впереди UTC в этот момент, в миллисекундах */
function zoneOffsetMs(at: Date, timezone: string): number {
  const parts = new Map(fmt(timezone).formatToParts(at).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.get('year')),
    Number(parts.get('month')) - 1,
    Number(parts.get('day')),
    Number(parts.get('hour')),
    Number(parts.get('minute')),
    Number(parts.get('second')),
  );
  return asUtc - at.getTime();
}

// ───────────── разбор полей ─────────────

function parseWeekday(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 6) return null;
  return n;
}

function parseDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  // «2026-02-30» формату отвечает, а в календаре такого дня нет
  const at = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== text) return null;
  return text;
}

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function minutes(clock: string): number {
  const [hh, mm] = clock.split(':');
  return Number(hh) * 60 + Number(mm);
}
