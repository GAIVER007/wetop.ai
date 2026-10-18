import { parseWorkingHoursWeek, resolveWorkingTime, type WorkingInterval } from '@pms/domain';
import { ConflictException } from '@nestjs/common';

export function intersectLocationHours(
  employee: Array<{ timeFrom: string; timeTo: string }>,
  salon: WorkingInterval[] | null,
  weekday: number,
): Array<{ timeFrom: string; timeTo: string }> {
  if (salon === null) return employee;
  return employee
    .flatMap((shift) =>
      salon
        .filter((open) => open.weekday === weekday)
        .flatMap((open) => {
          const timeFrom = shift.timeFrom > open.timeFrom ? shift.timeFrom : open.timeFrom;
          const timeTo = shift.timeTo < open.timeTo ? shift.timeTo : open.timeTo;
          return timeFrom < timeTo ? [{ timeFrom, timeTo }] : [];
        }),
    )
    .sort((a, b) => a.timeFrom.localeCompare(b.timeFrom));
}

export function salonHours(raw: unknown): WorkingInterval[] {
  const parsed = parseWorkingHoursWeek({ intervals: raw });
  if (!parsed.ok) throw new ConflictException('Проверьте режим работы салона: ' + parsed.reason);
  const merged: WorkingInterval[] = [];
  for (const interval of parsed.value) {
    const previous = merged.at(-1);
    if (previous && previous.weekday === interval.weekday && interval.timeFrom <= previous.timeTo) {
      previous.timeTo = previous.timeTo > interval.timeTo ? previous.timeTo : interval.timeTo;
    } else merged.push({ ...interval });
  }
  return merged;
}

export function fitsSalonHours(
  startsAt: Date,
  endsAt: Date,
  timezone: string,
  intervals: WorkingInterval[] | null,
): boolean {
  return (
    intervals === null ||
    resolveWorkingTime({
      startsAt,
      endsAt,
      timezone,
      supported: true,
      employeeActive: true,
      worksHere: true,
      workingHours: intervals,
      timeOffs: [],
    }).ok
  );
}
