import { describe, expect, it } from 'vitest';
import { BOOKING_WINDOW, parseBookingRequest, parseQuoteRequest } from './request';

const today = '2026-09-12';
const good = {
  k: 'pms_5f3c9a1b2d4e',
  arrival: '2026-09-13',
  departure: '2026-09-15',
  category: 'category-single',
  adults: 1,
  guest: {
    firstName: '  Айгерим ',
    lastName: 'Тестова',
    phone: '+7 (701) 123-45-67',
    email: 'guest@example.com',
  },
  comment: 'Приеду поздно',
  website: '',
  v: 'visitor-0001',
  s: 'session-0001',
};

describe('запрос цен с сайта (quote)', () => {
  it('принимает даты в окне и гостей', () => {
    const r = parseQuoteRequest(
      { k: good.k, arrival: good.arrival, departure: good.departure, adults: '2' },
      today,
    );
    expect(r).toEqual({
      ok: true,
      value: {
        siteKey: good.k,
        arrivalDate: '2026-09-13',
        departureDate: '2026-09-15',
        adults: 2,
        promoCode: null,
      },
    });
  });
  it.each([
    ['заезд вчера', { arrival: '2026-09-11', departure: '2026-09-12' }],
    ['выезд не позже заезда', { arrival: '2026-09-13', departure: '2026-09-13' }],
    ['дальше окна', { arrival: '2027-09-13', departure: '2027-09-14' }],
    ['слишком долго', { arrival: '2026-09-13', departure: '2026-10-20' }],
    ['кривая дата', { arrival: '13.09.2026', departure: '2026-09-15' }],
    ['гостей 0', { arrival: '2026-09-13', departure: '2026-09-15', adults: 0 }],
    ['гостей 9', { arrival: '2026-09-13', departure: '2026-09-15', adults: 9 }],
    ['ключ не по форме', { k: 'G-XXX', arrival: '2026-09-13', departure: '2026-09-15' }],
  ])('отклоняет: %s', (_l, over) => {
    const r = parseQuoteRequest({ k: good.k, adults: 1, ...over }, today);
    expect(r.ok).toBe(false);
  });
  it('заезд сегодня допустим; окно — 365 дней и 30 ночей', () => {
    expect(
      parseQuoteRequest({ k: good.k, arrival: today, departure: '2026-09-13', adults: 1 }, today)
        .ok,
    ).toBe(true);
    expect(BOOKING_WINDOW).toEqual({ maxLeadDays: 365, maxNights: 30, maxAdults: 8 });
  });
});

describe('запрос брони с сайта (book)', () => {
  it('нормализует гостя: обрезает пробелы, телефон в +7…, почту в нижний регистр', () => {
    const r = parseBookingRequest(
      { ...good, guest: { ...good.guest, email: 'Guest@Example.COM' } },
      today,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({
      siteKey: good.k,
      arrivalDate: '2026-09-13',
      departureDate: '2026-09-15',
      categoryCode: 'category-single',
      adults: 1,
      promoCode: null,
      guest: {
        firstName: 'Айгерим',
        lastName: 'Тестова',
        phone: '+77011234567',
        email: 'guest@example.com',
      },
      comment: 'Приеду поздно',
      lang: 'ru',
      visitorKey: 'visitor-0001',
      sessionKey: 'session-0001',
    });
  });
  it('телефон 8 701… становится +7 701…; почта необязательна; комментарий обрезается до 500', () => {
    const r = parseBookingRequest(
      {
        ...good,
        guest: { ...good.guest, phone: '8 701 123 45 67', email: '' },
        comment: 'x'.repeat(700),
      },
      today,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.guest.phone).toBe('+77011234567');
    expect(r.value.guest.email).toBeNull();
    expect(r.value.comment).toHaveLength(500);
  });
  it.each([
    ['honeypot заполнен (бот)', { website: 'http://spam' }],
    ['нет имени', { guest: { ...good.guest, firstName: ' ' } }],
    ['нет фамилии', { guest: { ...good.guest, lastName: '' } }],
    ['телефон короткий', { guest: { ...good.guest, phone: '12345' } }],
    ['телефон с буквами', { guest: { ...good.guest, phone: 'позвоните' } }],
    ['почта кривая', { guest: { ...good.guest, email: 'not-an-email' } }],
    ['нет категории', { category: '' }],
    ['имя длиннее 80', { guest: { ...good.guest, firstName: 'A'.repeat(81) } }],
  ])('отклоняет: %s', (_l, over) => {
    const r = parseBookingRequest({ ...good, ...over }, today);
    expect(r.ok).toBe(false);
  });
  it('ключи счётчика необязательны и должны быть по форме', () => {
    const r = parseBookingRequest({ ...good, v: undefined, s: 'bad key!' }, today);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.visitorKey).toBeNull();
    expect(r.value.sessionKey).toBeNull();
  });
});

describe('промокод в запросе виджета (DATA_MODEL §20)', () => {
  const base = { k: good.k, arrival: '2026-09-13', departure: '2026-09-15', adults: 2 };
  it('приводит к верхнему регистру и обрезает пробелы', () => {
    const r = parseQuoteRequest({ ...base, promo: '  summer-10 ' }, today);
    expect(r.ok && r.value.promoCode).toBe('SUMMER-10');
  });
  it('пустой и отсутствующий — без промокода', () => {
    const r = parseQuoteRequest({ ...base, promo: '   ' }, today);
    expect(r.ok && r.value.promoCode).toBeNull();
    const r2 = parseQuoteRequest(base, today);
    expect(r2.ok && r2.value.promoCode).toBeNull();
  });
  it('введённый неверно — отказ словами, а не «без скидки»', () => {
    for (const promo of ['ab', 'лето', 'a b', 'x'.repeat(33)]) {
      const r = parseQuoteRequest({ ...base, promo }, today);
      expect(r).toEqual({ ok: false, reason: 'промокод записан неверно' });
    }
  });
});

describe('язык гостя в запросе брони (ADR-143, срез «подтверждение брони»)', () => {
  it('без языка — русский', () => {
    const r = parseBookingRequest(good, today);
    expect(r.ok && r.value.lang).toBe('ru');
  });
  it.each(['ru', 'kk', 'en', 'zh'] as const)('принимает %s', (lang) => {
    const r = parseBookingRequest({ ...good, lang }, today);
    expect(r.ok && r.value.lang).toBe(lang);
  });
  it('регистр и региональный хвост не мешают: EN-us → en, zh-CN → zh, kz → kk', () => {
    expect(parseBookingRequest({ ...good, lang: 'EN-us' }, today)).toMatchObject({
      value: { lang: 'en' },
    });
    expect(parseBookingRequest({ ...good, lang: 'zh-CN' }, today)).toMatchObject({
      value: { lang: 'zh' },
    });
    expect(parseBookingRequest({ ...good, lang: 'kz' }, today)).toMatchObject({
      value: { lang: 'kk' },
    });
  });
  it('незнакомый язык — русский, а не отказ: бронь важнее языка письма', () => {
    const r = parseBookingRequest({ ...good, lang: 'fr' }, today);
    expect(r.ok && r.value.lang).toBe('ru');
  });
});
