import { describe, expect, it } from 'vitest';
import { resolveWorkingTime } from './schedule';
import { freeBeautySlots } from './slots';

const workingHours = [{ weekday: 1, timeFrom: '09:00', timeTo: '12:00' }, { weekday: 1, timeFrom: '14:00', timeTo: '18:00' }];
const input = { employeeActive: true, worksHere: true, supported: true, timezone: 'UTC', workingHours, timeOffs: [] };
const at = (clock: string) => new Date(`2035-01-08T${clock}:00Z`);
describe('shared working time', () => {
  it('uses every unordered interval, excludes breaks and the closing boundary', () => {
    for (const hours of [workingHours, [...workingHours].reverse()]) {
      for (const [clock, expected] of [['09:00', true], ['11:59', true], ['12:00', false], ['13:00', false], ['14:00', true], ['15:00', true], ['18:00', false]] as const)
        expect(resolveWorkingTime({ ...input, workingHours: hours, startsAt: at(clock) }).ok).toBe(expected);
    }
  });
  it('distinguishes missing schedule, off day, unsupported and assignment/status', () => {
    expect(resolveWorkingTime({ ...input, startsAt: at('15:00'), workingHours: [] })).toEqual({ ok: false, reason: 'NO_SCHEDULE' });
    expect(resolveWorkingTime({ ...input, startsAt: new Date('2035-01-09T15:00Z') })).toEqual({ ok: false, reason: 'OUTSIDE_WORKING_HOURS' });
    for (const [patch, reason] of [[{ supported: false }, 'UNSUPPORTED'], [{ employeeActive: false }, 'EMPLOYEE_INACTIVE'], [{ worksHere: false }, 'NOT_ASSIGNED']] as const)
      expect(resolveWorkingTime({ ...input, ...patch, startsAt: at('15:00') })).toEqual({ ok: false, reason });
  });
  it('inclusive calendar absence uses each branch timezone', () => {
    const startsAt = new Date('2035-01-09T05:00Z');
    const all = Array.from({ length: 7 }, (_, weekday) => ({ weekday, timeFrom: '00:00', timeTo: '23:59' }));
    const absent = { ...input, startsAt, workingHours: all, timeOffs: [{ dateFrom: '2035-01-08', dateTo: '2035-01-08' }] };
    expect(resolveWorkingTime({ ...absent, timezone: 'Asia/Almaty' }).ok).toBe(true);
    expect(resolveWorkingTime({ ...absent, timezone: 'Pacific/Honolulu' })).toEqual({ ok: false, reason: 'TIME_OFF' });
  });
  it('existing Beauty slots obey the same split day and full duration boundary', () => {
    const slots = freeBeautySlots({ date: '2035-01-08', timezone: 'UTC', durationMinutes: 60, now: new Date('2035-01-01Z'), masters: [{ id: 'master', workingHours: [...workingHours].reverse(), timeOffs: [], busy: [] }] });
    expect(slots.some(s => s.time === '15:00')).toBe(true);
    expect(slots.some(s => s.time === '13:00' || s.time === '11:15' || s.time === '17:15')).toBe(false);
  });
});
