import { describe, expect, it } from 'vitest';
import { freeBeautySlots } from './slots';

/** 2026-10-19 понедельник; Алматы UTC+5: 10:00 местного это 05:00Z */
const DAY = '2026-10-19';
const at = (hhmm: string) => new Date(`${DAY}T${hhmm}:00+05:00`);
const before = new Date('2026-10-18T00:00:00Z');
const master = (over: Partial<Parameters<typeof freeBeautySlots>[0]['masters'][number]> = {}) => ({
  id: 'm1',
  workingHours: [{ weekday: 1, timeFrom: '10:00', timeTo: '12:00' }],
  timeOffs: [],
  busy: [],
  ...over,
});

describe('freeBeautySlots: окна записи для формы сайта (SITE-4)', () => {
  it('окна от начала интервала с шагом, запись целиком внутри интервала', () => {
    const slots = freeBeautySlots({ date: DAY, timezone: 'Asia/Almaty', durationMinutes: 60, masters: [master()], now: before, stepMinutes: 30 });
    expect(slots.map((s) => s.time)).toEqual(['10:00', '10:30', '11:00']);
    expect(slots[0]!.startsAt.toISOString()).toBe('2026-10-19T05:00:00.000Z');
    expect(slots[0]!.endsAt.toISOString()).toBe('2026-10-19T06:00:00.000Z');
  });

  it('занятое время мастера не предлагается (пересечение в любую сторону)', () => {
    const busy = [{ startsAt: at('10:30'), endsAt: at('11:00') }];
    const slots = freeBeautySlots({ date: DAY, timezone: 'Asia/Almaty', durationMinutes: 60, masters: [master({ busy })], now: before, stepMinutes: 30 });
    expect(slots.map((s) => s.time)).toEqual(['11:00']);
  });

  it('день отсутствия и не тот день недели: окон нет', () => {
    const off = freeBeautySlots({
      date: DAY,
      timezone: 'Asia/Almaty',
      durationMinutes: 60,
      masters: [master({ timeOffs: [{ dateFrom: DAY, dateTo: DAY }] })],
      now: before,
    });
    expect(off).toEqual([]);
    const tuesday = freeBeautySlots({ date: '2026-10-20', timezone: 'Asia/Almaty', durationMinutes: 60, masters: [master()], now: before });
    expect(tuesday).toEqual([]);
  });

  it('прошедшее время не предлагается', () => {
    const slots = freeBeautySlots({ date: DAY, timezone: 'Asia/Almaty', durationMinutes: 60, masters: [master()], now: at('10:15'), stepMinutes: 30 });
    expect(slots.map((s) => s.time)).toEqual(['10:30', '11:00']);
  });

  it('два мастера: окно одно, свободные мастера перечислены', () => {
    const slots = freeBeautySlots({
      date: DAY,
      timezone: 'Asia/Almaty',
      durationMinutes: 60,
      masters: [master(), master({ id: 'm2', busy: [{ startsAt: at('10:00'), endsAt: at('11:00') }] })],
      now: before,
      stepMinutes: 60,
    });
    expect(slots.map((s) => [s.time, s.employeeIds])).toEqual([
      ['10:00', ['m1']],
      ['11:00', ['m1', 'm2']],
    ]);
  });

  it('длительность не целая или не положительная: окон нет', () => {
    expect(freeBeautySlots({ date: DAY, timezone: 'Asia/Almaty', durationMinutes: 0, masters: [master()], now: before })).toEqual([]);
  });
});

describe('окна до полуночи (смена до 24:00, владелец 27.10.2026)', () => {
  it('последнее часовое окно 23:00 при смене 22:00–24:00', () => {
    const m = master({ workingHours: [{ weekday: 1, timeFrom: '22:00', timeTo: '24:00' }] });
    const slots = freeBeautySlots({ date: DAY, timezone: 'Asia/Almaty', durationMinutes: 60, masters: [m], now: before, stepMinutes: 30 });
    expect(slots.map((s) => s.time)).toEqual(['22:00', '22:30', '23:00']);
    expect(slots.at(-1)!.endsAt.toISOString()).toBe('2026-10-19T19:00:00.000Z');
  });
});
