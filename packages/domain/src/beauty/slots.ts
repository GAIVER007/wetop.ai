/**
 * Свободные окна записи к мастеру для формы сайта (SITE-4, ADR-185, план `plans/site-seo-flow-2026-10-15.md` §2).
 *
 * Правило то же, что у стойки: запись целиком внутри одного интервала графика мастера в этом филиале, не в день его
 * отсутствия (`fitsSchedule`) и не пересекается с его записями, которые занимают место (`BOOKED`, `CONFIRMED`, `DONE`).
 * Окна идут от начала каждого интервала графика с шагом `stepMinutes`; прошедшее время не предлагается. Окончательно
 * место проверяет запись (под замком филиала и `EXCLUDE` базы): окно это подсказка, а не бронь.
 */

import { fitsSchedule, type TimeOffRef, type WorkingHoursRef } from './beauty';
import { timeOffWindow } from './schedule';

/** Шаг окон по умолчанию: четверть часа */
export const BEAUTY_SLOT_STEP_MINUTES = 15;

export interface SlotMaster {
  id: string;
  workingHours: readonly WorkingHoursRef[];
  timeOffs: readonly TimeOffRef[];
  /** Записи мастера, которые занимают место, на эти сутки и рядом */
  busy: ReadonlyArray<{ startsAt: Date; endsAt: Date }>;
}

export interface BeautySlot {
  startsAt: Date;
  endsAt: Date;
  /** «ЧЧ:ММ» в поясе филиала */
  time: string;
  /** Мастера, свободные в это окно, в порядке входа */
  employeeIds: string[];
}

function clockMinutes(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh > 24 || mm > 59 ? null : hh * 60 + mm;
}

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** День недели календарной даты: 0 воскресенье, как `working_hours.weekday` */
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

export function freeBeautySlots(input: {
  /** «ГГГГ-ММ-ДД» в поясе филиала */
  date: string;
  timezone: string;
  durationMinutes: number;
  masters: readonly SlotMaster[];
  now: Date;
  stepMinutes?: number;
}): BeautySlot[] {
  const { date, timezone, durationMinutes, masters, now } = input;
  const step = input.stepMinutes ?? BEAUTY_SLOT_STEP_MINUTES;
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return [];
  if (!Number.isInteger(step) || step <= 0) return [];
  const midnight = timeOffWindow({ dateFrom: date, dateTo: date, timezone }).fromUtc.getTime();
  const weekday = weekdayOf(date);
  const byStart = new Map<number, BeautySlot>();
  for (const master of masters) {
    for (const h of master.workingHours) {
      if (h.weekday !== weekday) continue;
      const from = clockMinutes(h.timeFrom);
      const to = clockMinutes(h.timeTo);
      if (from === null || to === null) continue;
      for (let m = from; m + durationMinutes <= to; m += step) {
        const startsAt = new Date(midnight + m * 60_000);
        const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
        if (startsAt.getTime() <= now.getTime()) continue;
        // тот же график, что проверяет запись: местное время, отсутствие, один интервал
        const fit = fitsSchedule({
          startsAt,
          endsAt,
          timezone,
          workingHours: master.workingHours,
          timeOffs: master.timeOffs,
        });
        if (!fit.ok) continue;
        if (master.busy.some((b) => b.startsAt < endsAt && b.endsAt > startsAt)) continue;
        const key = startsAt.getTime();
        const slot = byStart.get(key) ?? { startsAt, endsAt, time: clock(m), employeeIds: [] };
        if (!slot.employeeIds.includes(master.id)) slot.employeeIds.push(master.id);
        byStart.set(key, slot);
      }
    }
  }
  return [...byStart.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
