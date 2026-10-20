import { describe, expect, it } from 'vitest';
import { staffNotificationText, type StaffSiteEvent } from './site-notification';

/**
 * Сообщение сотруднику о брони с сайта (план `plans/staff-telegram-notifications-2026-10-20.md`): коротко, с тем, что
 * нужно сделать сразу (кто, когда, что, телефон), и ссылкой «Открыть в WETOP». Без длинных тире, деньги без float
 */
const base = { locationName: 'Luxx Aparts', guestName: 'Айгерим', guestPhone: '+77010000001', link: 'https://app.wetop.ai/reservations/r1', timezone: 'Asia/Almaty' };

describe('сообщение сотруднику о брони с сайта', () => {
  it('гостиница: номер брони, категория, даты, ночи, гости, сумма', () => {
    const e: StaffSiteEvent = {
      ...base,
      kind: 'SITE_BOOKING_HOTEL',
      confirmationNumber: '1234',
      categoryName: 'Стандарт',
      arrivalDate: '2026-10-21',
      departureDate: '2026-10-23',
      adults: 2,
      total: { minor: '4800000', currency: 'KZT' },
    };
    const m = staffNotificationText(e);
    expect(m.text).toContain('Новая бронь с сайта');
    expect(m.text).toContain('№1234');
    expect(m.text).toContain('Стандарт');
    expect(m.text).toContain('21–23 окт');
    expect(m.text).toContain('2 ночи');
    expect(m.text).toContain('2 гостя');
    expect(m.text).toMatch(/48[\s\u00a0\u202f]000 ₸/);
    expect(m.text).toContain('Гость: Айгерим, +7 701 000 00 01');
    expect(m.button).toEqual({ text: 'Открыть в WETOP', url: base.link });
  });

  it('салон: услуга, мастер, время в часовом поясе филиала, цена', () => {
    const m = staffNotificationText({
      ...base,
      kind: 'SITE_APPOINTMENT',
      serviceName: 'Маникюр с покрытием',
      employeeName: 'Мадина',
      startsAt: '2026-10-24T10:00:00.000Z',
      price: { minor: '900000', currency: 'KZT' },
    });
    expect(m.text).toContain('Новая запись с сайта');
    expect(m.text).toContain('Маникюр с покрытием');
    expect(m.text).toContain('Мастер: Мадина');
    expect(m.text).toContain('сб, 24 окт, 15:00');
    expect(m.text).toMatch(/9[\s\u00a0\u202f]000 ₸/);
  });

  it('салон без выбранного мастера: «любой мастер»', () => {
    const m = staffNotificationText({ ...base, kind: 'SITE_APPOINTMENT', serviceName: 'Стрижка', employeeName: null, startsAt: '2026-10-24T10:00:00.000Z', price: null });
    expect(m.text).toContain('Мастер: любой');
  });

  it('ресторан: дата, время, гости, комментарий', () => {
    const m = staffNotificationText({ ...base, kind: 'SITE_TABLE', startsAt: '2026-10-25T14:30:00.000Z', partySize: 4, comment: 'У окна' });
    expect(m.text).toContain('Бронь стола с сайта');
    expect(m.text).toContain('вс, 25 окт, 19:30');
    expect(m.text).toContain('4 гостя');
    expect(m.text).toContain('У окна');
  });

  it('заявка «Перезвоните»: имя, телефон, комментарий', () => {
    const m = staffNotificationText({ ...base, kind: 'SITE_LEAD', comment: 'Хочу на свадьбу 50 человек' });
    expect(m.text).toContain('Заявка с сайта');
    expect(m.text).toContain('Хочу на свадьбу 50 человек');
  });

  it('без длинного тире, длинный комментарий обрезается, пусто не ломает', () => {
    const m = staffNotificationText({ ...base, kind: 'SITE_LEAD', comment: 'а'.repeat(2000), guestPhone: null });
    expect(m.text).not.toContain('\u2014');
    expect(m.text.length).toBeLessThan(1200);
    expect(m.text).not.toContain('null');
  });

  it('склонения: 1 ночь, 5 ночей, 1 гость, 5 гостей', () => {
    const hotel = (n: number, a: number) =>
      staffNotificationText({ ...base, kind: 'SITE_BOOKING_HOTEL', confirmationNumber: '1', categoryName: 'Люкс', arrivalDate: '2026-10-21', departureDate: `2026-10-${21 + n}`, adults: a, total: null }).text;
    expect(hotel(1, 1)).toContain('1 ночь');
    expect(hotel(1, 1)).toContain('1 гость');
    expect(hotel(5, 5)).toContain('5 ночей');
    expect(hotel(5, 5)).toContain('5 гостей');
  });
});
