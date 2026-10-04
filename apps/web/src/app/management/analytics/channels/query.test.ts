import { describe, expect, it } from 'vitest';
import { channelLabel, channelsCsv, channelsHref, parseChannelsQuery, sameDatesYearBefore } from './query';

describe('«Эффективность каналов»: адрес отчёта, подписи, выгрузка', () => {
  it('по умолчанию: текущий месяц по дате заезда, без сравнения, порядок по доходу', () => {
    expect(parseChannelsQuery({}, '2026-10-03')).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
      compare: false,
      compareFrom: '2025-10-01',
      compareTo: '2025-10-31',
      channel: '',
      sort: 'revenue',
      empty: false,
      error: null,
    });
  });

  it('сравнение берёт свой период; неверные даты: сообщение и месяц по умолчанию', () => {
    const q = parseChannelsQuery(
      { from: '2026-09-01', to: '2026-09-30', compare: '1', cfrom: '2026-08-01', cto: '2026-08-31', empty: '1', sort: 'adr', channel: 'Agoda' },
      '2026-10-03',
    );
    expect(q).toMatchObject({ compare: true, compareFrom: '2026-08-01', compareTo: '2026-08-31', empty: true, sort: 'adr', channel: 'Agoda' });
    expect(parseChannelsQuery({ from: '2026-10-31', to: '2026-10-01' }, '2026-10-03')).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
      error: 'Окончание периода раньше начала',
    });
    expect(parseChannelsQuery({ sort: 'price' }, '2026-10-03').sort).toBe('revenue');
  });

  it('несуществующая дата (13-й месяц, 31 апреля): сообщение, а не падение страницы', () => {
    expect(parseChannelsQuery({ from: '2026-13-01', to: '2026-13-05' }, '2026-10-03').error).toBe(
      'Даты периода: в виде ДД.ММ.ГГГГ',
    );
    expect(parseChannelsQuery({ from: '2026-04-31', to: '2026-05-01' }, '2026-10-03').from).toBe('2026-10-01');
  });

  it('тот же период годом раньше: 29 февраля: в 28', () => {
    expect(sameDatesYearBefore('2028-02-29')).toBe('2027-02-28');
    expect(sameDatesYearBefore('2026-10-31')).toBe('2025-10-31');
  });

  it('адрес сохраняет отбор и меняет только нужное', () => {
    const q = parseChannelsQuery({ compare: '1', empty: '1' }, '2026-10-03');
    expect(channelsHref(q, { sort: 'nights' })).toBe(
      '/management/analytics/channels?from=2026-10-01&to=2026-10-31&compare=1&cfrom=2025-10-01&cto=2025-10-31&empty=1&sort=nights',
    );
  });

  it('строка канала: OTA своим именем, прямые источники словами стойки', () => {
    expect(channelLabel({ label: 'Booking.com', source: 'OTA' })).toBe('Booking.com');
    expect(channelLabel({ label: 'DESK', source: 'DESK' })).toBe('Стойка');
    expect(channelLabel({ label: 'WEBSITE', source: 'WEBSITE' })).toBe('Сайт');
  });

  it('CSV: «;», BOM, суммы с запятой, итог последней строкой', () => {
    const csv = channelsCsv({
      from: '2026-10-01',
      to: '2026-10-31',
      channels: [],
      rows: [
        { label: 'Booking.com', source: 'OTA', channel: 'Booking.com', bookings: 2, revenueMinor: '5300000', revenueShare: 74.6, nights: 5, nightsShare: 62.5, adrMinor: '1060000' },
      ],
      totals: { revenueMinor: '5300000', nights: 5, adrMinor: '1060000', bookings: 2 },
    });
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Канал;Брони;Доход;Доля дохода, %;Ночи;Доля ночей, %;Средняя стоимость ночи');
    expect(csv).toContain('Booking.com;2;53000,00;74,6;5;62,5;10600,00');
    expect(csv.trimEnd().split('\r\n').at(-1)).toBe('Итого;2;53000,00;100;5;100;10600,00');
  });
});
