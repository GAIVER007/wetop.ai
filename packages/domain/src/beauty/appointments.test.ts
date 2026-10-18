import { describe, expect, it } from 'vitest';
import { nextStatuses, parseAppointmentInput, planAppointment, statusChange } from './appointments';

const service = { active: true, priceMinor: 800000n, currency: 'KZT', durationMinutes: 60 };
const week = [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }];
const almaty = 'Asia/Almaty';
// понедельник 12 октября 2026, 10:00 по Алматы это 05:00 UTC
const monday10 = new Date('2026-10-12T05:00:00Z');

describe('planAppointment', () => {
  it('считает окно и снимок цены по действующей цене филиала', () => {
    const plan = planAppointment({
      startsAt: monday10,
      timezone: almaty,
      service,
      locationCurrency: 'KZT',
      locationService: { enabled: true },
      workingHours: week,
      timeOffs: [],
    });
    expect(plan).toEqual({
      ok: true,
      value: {
        startsAt: monday10,
        endsAt: new Date('2026-10-12T06:00:00Z'),
        priceMinor: 800000n,
        currency: 'KZT',
        durationMinutes: 60,
      },
    });
  });

  it('берёт цену и длительность филиала, когда он их задал', () => {
    const plan = planAppointment({
      startsAt: monday10,
      timezone: almaty,
      service,
      locationCurrency: 'KZT',
      locationService: { enabled: true, priceOverrideMinor: 950000n, durationOverrideMinutes: 90 },
      workingHours: week,
      timeOffs: [],
    });
    expect(plan.ok && plan.value.priceMinor).toBe(950000n);
    expect(plan.ok && plan.value.endsAt.toISOString()).toBe('2026-10-12T06:30:00.000Z');
  });

  it('не пускает запись на услугу, которую филиал не оказывает', () => {
    const plan = planAppointment({
      startsAt: monday10,
      timezone: almaty,
      service,
      locationCurrency: 'KZT',
      locationService: null,
      workingHours: week,
      timeOffs: [],
    });
    expect(plan).toEqual({ ok: false, reason: 'Филиал эту услугу не оказывает' });
  });

  it('не пускает запись в валюте, которой филиал не знает', () => {
    const plan = planAppointment({
      startsAt: monday10,
      timezone: almaty,
      service: { ...service, currency: 'AED' },
      locationCurrency: 'KZT',
      locationService: { enabled: true },
      workingHours: week,
      timeOffs: [],
    });
    expect(plan).toEqual({ ok: false, reason: 'У услуги нет цены в валюте филиала' });
  });

  it('не пускает запись мимо графика мастера', () => {
    const plan = planAppointment({
      startsAt: new Date('2026-10-12T14:00:00Z'), // 19:00 по Алматы, после 18:00
      timezone: almaty,
      service,
      locationCurrency: 'KZT',
      locationService: { enabled: true },
      workingHours: week,
      timeOffs: [],
    });
    expect(plan).toEqual({ ok: false, reason: 'Мастер в это время не работает' });
  });

  it('не пускает запись в день отсутствия мастера', () => {
    const plan = planAppointment({
      startsAt: monday10,
      timezone: almaty,
      service,
      locationCurrency: 'KZT',
      locationService: { enabled: true },
      workingHours: week,
      timeOffs: [{ dateFrom: '2026-10-12', dateTo: '2026-10-13' }],
    });
    expect(plan).toEqual({ ok: false, reason: 'У мастера в этот день отсутствие' });
  });

  it('не пускает запись на услугу в архиве', () => {
    const plan = planAppointment({
      startsAt: monday10,
      timezone: almaty,
      service: { ...service, active: false },
      locationCurrency: 'KZT',
      locationService: { enabled: true },
      workingHours: week,
      timeOffs: [],
    });
    expect(plan).toEqual({ ok: false, reason: 'Услуга в архиве' });
  });
});

describe('statusChange', () => {
  it('ведёт запись по жизни: принята, подтверждена, выполнена', () => {
    expect(statusChange('BOOKED', 'CONFIRMED')).toEqual({ ok: true });
    expect(statusChange('CONFIRMED', 'DONE')).toEqual({ ok: true });
  });

  it('позволяет отменить и отметить незаезд до выполнения', () => {
    for (const from of ['BOOKED', 'CONFIRMED'] as const)
      for (const to of ['CANCELLED', 'NO_SHOW'] as const)
        expect(statusChange(from, to), `${from} → ${to}`).toEqual({ ok: true });
  });

  it('из выполненной, отменённой и незаезда дороги нет', () => {
    for (const from of ['DONE', 'CANCELLED', 'NO_SHOW'] as const) {
      const r = statusChange(from, 'BOOKED');
      expect(r.ok, from).toBe(false);
      expect(nextStatuses(from), from).toEqual([]);
    }
  });

  it('тот же статус не перевод', () => {
    expect(statusChange('BOOKED', 'BOOKED')).toEqual({
      ok: false,
      reason: 'Запись уже в этом состоянии',
    });
  });

  it('называет, что можно дальше', () => {
    expect(nextStatuses('BOOKED')).toEqual(['CONFIRMED', 'IN_PROGRESS', 'DONE', 'NO_SHOW', 'CANCELLED']);
    expect(nextStatuses('CONFIRMED')).toEqual(['IN_PROGRESS', 'DONE', 'NO_SHOW', 'CANCELLED']);
  });
});

describe('parseAppointmentInput', () => {
  it('принимает запись к существующему клиенту', () => {
    const r = parseAppointmentInput({
      employeeId: 'e1',
      serviceId: 's1',
      startsAt: '2026-10-12T05:00:00.000Z',
      customerId: 'c1',
      notes: ' первый визит ',
    });
    expect(r).toEqual({
      ok: true,
      value: {
        startsAt: new Date('2026-10-12T05:00:00.000Z'),
        items: [
          {
            employeeId: 'e1',
            serviceId: 's1',
            durationMinutes: null,
            basePriceMinor: null,
            discountMinor: 0n,
            discountPercent: null,
            surchargeMinor: 0n,
          },
        ],
        customer: { kind: 'existing', id: 'c1' },
        notes: 'первый визит',
      },
    });
  });

  it('принимает запись новому клиенту по имени и телефону', () => {
    const r = parseAppointmentInput({
      employeeId: 'e1',
      serviceId: 's1',
      startsAt: '2026-10-12T05:00:00.000Z',
      firstName: ' Айгуль ',
      lastName: 'Сериковна',
      phone: '+7 701 000 00 00',
    });
    expect(r.ok && r.value.customer).toEqual({
      kind: 'new',
      firstName: 'Айгуль',
      lastName: 'Сериковна',
      phone: '+7 701 000 00 00',
    });
  });

  it('принимает несколько последовательных услуг с ценой, длительностью и скидкой строки', () => {
    const r = parseAppointmentInput({
      startsAt: '2026-10-12T05:00:00.000Z',
      customerId: 'c1',
      items: [
        {
          employeeId: 'e1',
          serviceId: 's1',
          durationMinutes: 45,
          basePriceMinor: '900000',
          discountPercent: 10,
        },
        {
          employeeId: 'e2',
          serviceId: 's2',
          discountMinor: '50000',
          surchargeMinor: '10000',
        },
      ],
    });
    expect(r).toEqual({
      ok: true,
      value: {
        startsAt: new Date('2026-10-12T05:00:00.000Z'),
        items: [
          {
            employeeId: 'e1',
            serviceId: 's1',
            durationMinutes: 45,
            basePriceMinor: 900000n,
            discountMinor: 0n,
            discountPercent: 10,
            surchargeMinor: 0n,
          },
          {
            employeeId: 'e2',
            serviceId: 's2',
            durationMinutes: null,
            basePriceMinor: null,
            discountMinor: 50000n,
            discountPercent: null,
            surchargeMinor: 10000n,
          },
        ],
        customer: { kind: 'existing', id: 'c1' },
        notes: null,
      },
    });
  });

  it('отвергает пустые строки, дробные деньги и две скидки одной строки', () => {
    const base = {
      startsAt: '2026-10-12T05:00:00.000Z',
      customerId: 'c1',
    };
    expect(parseAppointmentInput({ ...base, items: [] })).toEqual({
      ok: false,
      reason: 'Добавьте хотя бы одну услугу',
    });
    expect(
      parseAppointmentInput({
        ...base,
        items: [{ employeeId: 'e1', serviceId: 's1', basePriceMinor: '10.5' }],
      }),
    ).toEqual({ ok: false, reason: 'Цена услуги должна быть целым числом в минимальных единицах' });
    expect(
      parseAppointmentInput({
        ...base,
        items: [
          {
            employeeId: 'e1',
            serviceId: 's1',
            discountMinor: '100',
            discountPercent: 10,
          },
        ],
      }),
    ).toEqual({ ok: false, reason: 'Укажите скидку суммой или процентом' });
  });

  it('требует клиента: без имени и без выбранного не записать', () => {
    const r = parseAppointmentInput({
      employeeId: 'e1',
      serviceId: 's1',
      startsAt: '2026-10-12T05:00:00.000Z',
    });
    expect(r).toEqual({ ok: false, reason: 'Выберите клиента или впишите имя' });
  });

  it('не пускает запись без мастера, услуги и времени', () => {
    expect(parseAppointmentInput({ serviceId: 's1', startsAt: '2026-10-12T05:00:00.000Z', customerId: 'c1' })).toEqual({
      ok: false,
      reason: 'Выберите мастера',
    });
    expect(parseAppointmentInput({ employeeId: 'e1', startsAt: '2026-10-12T05:00:00.000Z', customerId: 'c1' })).toEqual({
      ok: false,
      reason: 'Выберите услугу',
    });
    expect(parseAppointmentInput({ employeeId: 'e1', serviceId: 's1', customerId: 'c1' })).toEqual({
      ok: false,
      reason: 'Укажите время записи',
    });
    expect(
      parseAppointmentInput({ employeeId: 'e1', serviceId: 's1', startsAt: 'завтра', customerId: 'c1' }).ok,
    ).toBe(false);
  });
});

describe('статус «В процессе» (§58)', () => {
  it('начать можно из записанной и подтверждённой; из начатой только выполнить или отменить', () => {
    expect(nextStatuses('BOOKED')).toContain('IN_PROGRESS');
    expect(nextStatuses('CONFIRMED')).toContain('IN_PROGRESS');
    expect(nextStatuses('IN_PROGRESS')).toEqual(['DONE', 'CANCELLED']);
    expect(statusChange('IN_PROGRESS', 'NO_SHOW')).toEqual({ ok: false, reason: 'Из этого состояния запись так не меняют' });
    expect(statusChange('DONE', 'IN_PROGRESS').ok).toBe(false);
  });
});
