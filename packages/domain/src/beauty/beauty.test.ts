import { describe, expect, it } from 'vitest';
import {
  appointmentWindow,
  assertTimeOffRange,
  effectiveService,
  fitsSchedule,
} from './beauty';

const SERVICE = {
  active: true,
  priceMinor: 800000n,
  currency: 'KZT',
  durationMinutes: 60,
};

describe('effectiveService (DATA_MODEL §19.1): цена и длительность услуги в филиале', () => {
  it('включена, переопределений нет, валюты совпадают: цена и длительность каталога', () => {
    const r = effectiveService({
      service: SERVICE,
      locationCurrency: 'KZT',
      locationService: { enabled: true },
    });
    expect(r).toEqual({
      sellable: true,
      priceMinor: 800000n,
      currency: 'KZT',
      durationMinutes: 60,
      overridden: false,
    });
  });

  it('переопределение цены: цена филиала в валюте филиала', () => {
    const r = effectiveService({
      service: SERVICE,
      locationCurrency: 'KZT',
      locationService: { enabled: true, priceOverrideMinor: 950000n },
    });
    expect(r).toEqual({
      sellable: true,
      priceMinor: 950000n,
      currency: 'KZT',
      durationMinutes: 60,
      overridden: true,
    });
  });

  it('переопределение длительности', () => {
    const r = effectiveService({
      service: SERVICE,
      locationCurrency: 'KZT',
      locationService: { enabled: true, durationOverrideMinutes: 90 },
    });
    expect(r.sellable && r.durationMinutes).toBe(90);
  });

  it('услуга в архиве: не продаётся', () => {
    const r = effectiveService({
      service: { ...SERVICE, active: false },
      locationCurrency: 'KZT',
      locationService: { enabled: true },
    });
    expect(r).toEqual({ sellable: false, reason: 'SERVICE_INACTIVE' });
  });

  it('филиал услугу не включил, или строки филиала нет: не продаётся', () => {
    expect(
      effectiveService({ service: SERVICE, locationCurrency: 'KZT', locationService: null }),
    ).toEqual({ sellable: false, reason: 'NOT_ENABLED' });
    expect(
      effectiveService({
        service: SERVICE,
        locationCurrency: 'KZT',
        locationService: { enabled: false },
      }),
    ).toEqual({ sellable: false, reason: 'NOT_ENABLED' });
  });

  it('валюта каталога не валюта филиала и своей цены нет: не продаётся (Q-257)', () => {
    expect(
      effectiveService({
        service: SERVICE,
        locationCurrency: 'AED',
        locationService: { enabled: true },
      }),
    ).toEqual({ sellable: false, reason: 'CURRENCY_MISMATCH' });
  });

  it('валюта не та, но филиал задал свою цену: продаётся в валюте филиала (Q-257)', () => {
    expect(
      effectiveService({
        service: SERVICE,
        locationCurrency: 'AED',
        locationService: { enabled: true, priceOverrideMinor: 15000n },
      })
    ).toEqual({
      sellable: true,
      priceMinor: 15000n,
      currency: 'AED',
      durationMinutes: 60,
      overridden: true,
    });
  });
});

describe('appointmentWindow: конец записи считается от длительности', () => {
  it('60 минут от 10:00 заканчивается в 11:00', () => {
    const startsAt = new Date('2026-10-05T05:00:00.000Z');
    expect(appointmentWindow(startsAt, 60)).toEqual({
      startsAt,
      endsAt: new Date('2026-10-05T06:00:00.000Z'),
    });
  });

  it('длительность должна быть целой и больше нуля', () => {
    const startsAt = new Date('2026-10-05T05:00:00.000Z');
    expect(() => appointmentWindow(startsAt, 0)).toThrow(/длительность/i);
    expect(() => appointmentWindow(startsAt, -30)).toThrow(/длительность/i);
    expect(() => appointmentWindow(startsAt, 30.5)).toThrow(/длительность/i);
  });
});

// Asia/Almaty = UTC+5. Понедельник 05.10.2026.
const ALMATY = 'Asia/Almaty';
const MON_10 = { weekday: 1, timeFrom: '10:00', timeTo: '19:00' };

describe('fitsSchedule: запись внутри графика мастера и не в отсутствие', () => {
  it('внутри интервала рабочего дня', () => {
    expect(
      fitsSchedule({
        startsAt: new Date('2026-10-05T05:00:00.000Z'),
        endsAt: new Date('2026-10-05T06:00:00.000Z'),
        timezone: ALMATY,
        workingHours: [MON_10],
        timeOffs: [],
      }),
    ).toEqual({ ok: true });
  });

  it('кончается позже рабочего дня', () => {
    expect(
      fitsSchedule({
        startsAt: new Date('2026-10-05T13:30:00.000Z'),
        endsAt: new Date('2026-10-05T14:30:00.000Z'),
        timezone: ALMATY,
        workingHours: [MON_10],
        timeOffs: [],
      }),
    ).toEqual({ ok: false, reason: 'OUTSIDE_WORKING_HOURS' });
  });

  it('другой день недели: графика на него нет', () => {
    expect(
      fitsSchedule({
        startsAt: new Date('2026-10-06T05:00:00.000Z'),
        endsAt: new Date('2026-10-06T06:00:00.000Z'),
        timezone: ALMATY,
        workingHours: [MON_10],
        timeOffs: [],
      }),
    ).toEqual({ ok: false, reason: 'OUTSIDE_WORKING_HOURS' });
  });

  it('интервалов два с перерывом: запись через перерыв не проходит', () => {
    const hours = [
      { weekday: 1, timeFrom: '10:00', timeTo: '13:00' },
      { weekday: 1, timeFrom: '14:00', timeTo: '19:00' },
    ];
    expect(
      fitsSchedule({
        startsAt: new Date('2026-10-05T07:30:00.000Z'),
        endsAt: new Date('2026-10-05T09:30:00.000Z'),
        timezone: ALMATY,
        workingHours: hours,
        timeOffs: [],
      }),
    ).toEqual({ ok: false, reason: 'OUTSIDE_WORKING_HOURS' });
    expect(
      fitsSchedule({
        startsAt: new Date('2026-10-05T05:00:00.000Z'),
        endsAt: new Date('2026-10-05T07:00:00.000Z'),
        timezone: ALMATY,
        workingHours: hours,
        timeOffs: [],
      }),
    ).toEqual({ ok: true });
  });

  it('мастер в отсутствии в этот день', () => {
    expect(
      fitsSchedule({
        startsAt: new Date('2026-10-05T05:00:00.000Z'),
        endsAt: new Date('2026-10-05T06:00:00.000Z'),
        timezone: ALMATY,
        workingHours: [MON_10],
        timeOffs: [{ dateFrom: '2026-10-03', dateTo: '2026-10-07' }],
      }),
    ).toEqual({ ok: false, reason: 'TIME_OFF' });
  });

  it('день недели берётся в поясе филиала, а не в UTC', () => {
    // 04.10 23:30 UTC это уже 05.10 04:30 в Алматы: воскресенье по UTC, понедельник по филиалу
    const args = {
      startsAt: new Date('2026-10-05T05:00:00.000Z'),
      endsAt: new Date('2026-10-05T06:00:00.000Z'),
      workingHours: [MON_10],
      timeOffs: [],
    };
    expect(fitsSchedule({ ...args, timezone: ALMATY })).toEqual({ ok: true });
    // в поясе UTC+10 те же сутки уже 15:00, а в UTC-10 это ещё воскресенье
    expect(fitsSchedule({ ...args, timezone: 'Pacific/Honolulu' })).toEqual({
      ok: false,
      reason: 'OUTSIDE_WORKING_HOURS',
    });
  });
});

describe('assertTimeOffRange: отсутствие не кончается раньше начала', () => {
  it('один день допустим', () => {
    expect(() =>
      assertTimeOffRange({ dateFrom: '2026-10-05', dateTo: '2026-10-05' }),
    ).not.toThrow();
  });

  it('конец раньше начала отклоняется', () => {
    expect(() =>
      assertTimeOffRange({ dateFrom: '2026-10-07', dateTo: '2026-10-05' }),
    ).toThrow(/дат/i);
  });
});
