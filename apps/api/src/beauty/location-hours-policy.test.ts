import { describe, expect, it } from 'vitest';
import { intersectLocationHours } from './location-hours-policy';

const employee = [{ timeFrom: '09:00', timeTo: '18:00' }];
describe('salon opening hours and employee schedule intersection', () => {
  it('preserves existing behavior until the salon hours are configured', () => {
    expect(intersectLocationHours(employee, null, 1)).toEqual(employee);
  });
  it('keeps the salon lunch break and limits the end of the workday', () => {
    expect(
      intersectLocationHours(
        employee,
        [
          { weekday: 1, timeFrom: '10:00', timeTo: '12:00' },
          { weekday: 1, timeFrom: '13:00', timeTo: '17:00' },
        ],
        1,
      ),
    ).toEqual([
      { timeFrom: '10:00', timeTo: '12:00' },
      { timeFrom: '13:00', timeTo: '17:00' },
    ]);
  });
  it('a configured closed day offers no employee slots', () => {
    expect(intersectLocationHours(employee, [], 1)).toEqual([]);
    expect(
      intersectLocationHours(employee, [{ weekday: 2, timeFrom: '10:00', timeTo: '17:00' }], 1),
    ).toEqual([]);
  });
  it('does not treat an interval touching only a boundary as available', () => {
    expect(
      intersectLocationHours(
        [{ timeFrom: '09:00', timeTo: '10:00' }],
        [{ weekday: 1, timeFrom: '10:00', timeTo: '18:00' }],
        1,
      ),
    ).toEqual([]);
  });
});
