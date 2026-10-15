import { describe, expect, it } from 'vitest';
import {
  dayOffsetUtc,
  parseTimeOffInput,
  parseWorkingHoursWeek,
  timeOffWindow,
  weekTemplate,
} from './schedule';

describe('parseWorkingHoursWeek', () => {
  it('принимает неделю и приводит время к «ЧЧ:ММ»', () => {
    const r = parseWorkingHoursWeek({
      intervals: [
        { weekday: 1, timeFrom: '9:00', timeTo: '18:00' },
        { weekday: 2, timeFrom: '0900', timeTo: '13.30' },
      ],
    });
    expect(r).toEqual({
      ok: true,
      value: [
        { weekday: 1, timeFrom: '09:00', timeTo: '18:00' },
        { weekday: 2, timeFrom: '09:00', timeTo: '13:30' },
      ],
    });
  });

  it('пустая неделя это снятый график, а не ошибка', () => {
    expect(parseWorkingHoursWeek({ intervals: [] })).toEqual({ ok: true, value: [] });
  });

  it('сортирует по дню и началу, как бы их ни прислали', () => {
    const r = parseWorkingHoursWeek({
      intervals: [
        { weekday: 3, timeFrom: '14:00', timeTo: '18:00' },
        { weekday: 1, timeFrom: '10:00', timeTo: '12:00' },
        { weekday: 3, timeFrom: '09:00', timeTo: '13:00' },
      ],
    });
    expect(r.ok && r.value.map((i) => `${i.weekday} ${i.timeFrom}`)).toEqual([
      '1 10:00',
      '3 09:00',
      '3 14:00',
    ]);
  });

  it('разрешает два интервала в день через перерыв', () => {
    const r = parseWorkingHoursWeek({
      intervals: [
        { weekday: 5, timeFrom: '09:00', timeTo: '13:00' },
        { weekday: 5, timeFrom: '14:00', timeTo: '20:00' },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('разрешает интервалы вплотную', () => {
    const r = parseWorkingHoursWeek({
      intervals: [
        { weekday: 5, timeFrom: '09:00', timeTo: '13:00' },
        { weekday: 5, timeFrom: '13:00', timeTo: '20:00' },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('не пускает наложение в одном дне', () => {
    const r = parseWorkingHoursWeek({
      intervals: [
        { weekday: 5, timeFrom: '09:00', timeTo: '14:00' },
        { weekday: 5, timeFrom: '13:00', timeTo: '20:00' },
      ],
    });
    expect(r).toEqual({ ok: false, reason: 'Интервалы в одном дне накладываются друг на друга' });
  });

  it('не пускает повтор одного и того же интервала', () => {
    const r = parseWorkingHoursWeek({
      intervals: [
        { weekday: 0, timeFrom: '09:00', timeTo: '14:00' },
        { weekday: 0, timeFrom: '09:00', timeTo: '14:00' },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it('не пускает конец не позже начала', () => {
    expect(parseWorkingHoursWeek({ intervals: [{ weekday: 1, timeFrom: '18:00', timeTo: '09:00' }] })).toEqual({
      ok: false,
      reason: 'Конец рабочего времени должен быть позже начала',
    });
    expect(parseWorkingHoursWeek({ intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '09:00' }] }).ok).toBe(
      false,
    );
  });

  it('не пускает день вне недели и время не часами', () => {
    expect(parseWorkingHoursWeek({ intervals: [{ weekday: 7, timeFrom: '09:00', timeTo: '18:00' }] })).toEqual({
      ok: false,
      reason: 'День недели: число от 0 (воскресенье) до 6',
    });
    expect(parseWorkingHoursWeek({ intervals: [{ weekday: 1, timeFrom: 'утром', timeTo: '18:00' }] })).toEqual({
      ok: false,
      reason: 'Время графика в часах и минутах, например 09:00',
    });
  });

  it('не пускает ввод не списком', () => {
    expect(parseWorkingHoursWeek({}).ok).toBe(false);
    expect(parseWorkingHoursWeek({ intervals: 'каждый день' }).ok).toBe(false);
  });

  it('не пускает больше четырёх интервалов в одном дне', () => {
    const intervals = [
      { weekday: 2, timeFrom: '08:00', timeTo: '09:00' },
      { weekday: 2, timeFrom: '10:00', timeTo: '11:00' },
      { weekday: 2, timeFrom: '12:00', timeTo: '13:00' },
      { weekday: 2, timeFrom: '14:00', timeTo: '15:00' },
      { weekday: 2, timeFrom: '16:00', timeTo: '17:00' },
    ];
    expect(parseWorkingHoursWeek({ intervals })).toEqual({
      ok: false,
      reason: 'В одном дне не больше четырёх интервалов',
    });
  });
});

describe('weekTemplate', () => {
  it('раскладывает строки по семи дням с понедельника', () => {
    const week = weekTemplate([
      { weekday: 0, timeFrom: '10:00', timeTo: '16:00' },
      { weekday: 1, timeFrom: '09:00', timeTo: '18:00' },
      { weekday: 1, timeFrom: '19:00', timeTo: '21:00' },
    ]);
    expect(week.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(week[0]?.intervals).toHaveLength(2);
    expect(week[1]?.intervals).toEqual([]);
    expect(week[6]?.intervals).toEqual([{ timeFrom: '10:00', timeTo: '16:00' }]);
  });
});

describe('parseTimeOffInput', () => {
  it('принимает отсутствие с причиной', () => {
    expect(parseTimeOffInput({ dateFrom: '2026-10-12', dateTo: '2026-10-14', reason: ' отпуск ' })).toEqual({
      ok: true,
      value: { dateFrom: '2026-10-12', dateTo: '2026-10-14', reason: 'отпуск' },
    });
  });

  it('принимает один день без причины', () => {
    expect(parseTimeOffInput({ dateFrom: '2026-10-12', dateTo: '2026-10-12' })).toEqual({
      ok: true,
      value: { dateFrom: '2026-10-12', dateTo: '2026-10-12', reason: null },
    });
  });

  it('не пускает конец раньше начала', () => {
    expect(parseTimeOffInput({ dateFrom: '2026-10-14', dateTo: '2026-10-12' })).toEqual({
      ok: false,
      reason: 'Отсутствие: конец раньше начала, проверьте даты',
    });
  });

  it('не пускает несуществующую дату и не дату', () => {
    expect(parseTimeOffInput({ dateFrom: '2026-02-30', dateTo: '2026-03-01' }).ok).toBe(false);
    expect(parseTimeOffInput({ dateFrom: '12.10.2026', dateTo: '14.10.2026' })).toEqual({
      ok: false,
      reason: 'Дата отсутствия в виде ГГГГ-ММ-ДД',
    });
  });

  it('не пускает отсутствие длиннее года: это опечатка, а не отпуск', () => {
    expect(parseTimeOffInput({ dateFrom: '2026-10-12', dateTo: '2028-10-12' })).toEqual({
      ok: false,
      reason: 'Отсутствие длиннее года: проверьте даты',
    });
  });

  it('обрезает слишком длинную причину', () => {
    const r = parseTimeOffInput({ dateFrom: '2026-10-12', dateTo: '2026-10-12', reason: 'я'.repeat(201) });
    expect(r).toEqual({ ok: false, reason: 'Причина отсутствия: не больше 200 символов' });
  });
});

describe('timeOffWindow', () => {
  it('берёт местную полночь филиала, конец невключительно', () => {
    const w = timeOffWindow({ dateFrom: '2026-10-12', dateTo: '2026-10-13', timezone: 'Asia/Almaty' });
    expect(w.fromUtc.toISOString()).toBe('2026-10-11T19:00:00.000Z');
    expect(w.toUtcExclusive.toISOString()).toBe('2026-10-13T19:00:00.000Z');
  });

  it('держит перевод часов: окно считается по поясу на каждую дату', () => {
    // Берлин переводит часы в ночь на 25.10.2026: до него UTC+2, после UTC+1
    const w = timeOffWindow({ dateFrom: '2026-10-24', dateTo: '2026-10-25', timezone: 'Europe/Berlin' });
    expect(w.fromUtc.toISOString()).toBe('2026-10-23T22:00:00.000Z');
    expect(w.toUtcExclusive.toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });

  it('один день это ровно одни местные сутки', () => {
    const w = timeOffWindow({ dateFrom: '2026-10-12', dateTo: '2026-10-12', timezone: 'Asia/Almaty' });
    expect(w.toUtcExclusive.getTime() - w.fromUtc.getTime()).toBe(86_400_000);
  });
});

describe('dayOffsetUtc', () => {
  it('сдвигает календарную дату, не трогая часовой пояс', () => {
    expect(dayOffsetUtc('2026-10-31', 1)).toBe('2026-11-01');
    expect(dayOffsetUtc('2026-01-01', -1)).toBe('2025-12-31');
  });
});
