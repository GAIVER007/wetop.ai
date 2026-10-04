import { describe, expect, it } from 'vitest';
import { bookingConfirmationLetter, type BookingLetterInput } from './booking-letter';

const base: BookingLetterInput = {
  to: 'guest@example.com',
  lang: 'ru',
  guestFirstName: 'Айгерим',
  propertyName: 'Хостел Тест',
  confirmationNumber: 'WEB-1042',
  categoryName: 'Двухместный номер',
  arrivalDate: '2026-10-14',
  departureDate: '2026-10-17',
  nights: 3,
  adults: 2,
  totalMinor: '2400000',
  currency: 'KZT',
  checkInTime: '14:00',
  checkOutTime: '12:00',
};

describe('письмо гостю с подтверждением брони (ADR-144)', () => {
  it('русский: номер, даты, время, сумма и оплата при заселении', () => {
    const m = bookingConfirmationLetter(base);
    expect(m.to).toBe('guest@example.com');
    expect(m.subject).toBe('Бронь WEB-1042 подтверждена: Хостел Тест');
    expect(m.text).toContain('Здравствуйте, Айгерим!');
    expect(m.text).toContain('Номер брони: WEB-1042');
    expect(m.text).toContain('Заезд: 14.10.2026 с 14:00');
    expect(m.text).toContain('Выезд: 17.10.2026 до 12:00');
    expect(m.text).toContain('Двухместный номер, гостей: 2, ночей: 3');
    expect(m.text).toContain('Сумма: 24 000 ₸. Оплата при заселении.');
  });

  it.each([
    ['kk', 'WEB-1042 брондау расталды: Хостел Тест', 'Брондау нөмірі: WEB-1042'],
    ['en', 'Booking WEB-1042 confirmed: Хостел Тест', 'Booking number: WEB-1042'],
    ['zh', '预订 WEB-1042 已确认：Хостел Тест', '预订号：WEB-1042'],
  ] as const)('%s: тема и номер на языке гостя', (lang, subject, numberLine) => {
    const m = bookingConfirmationLetter({ ...base, lang });
    expect(m.subject).toBe(subject);
    expect(m.text).toContain(numberLine);
    expect(m.text).toContain('24 000 ₸');
  });

  it('тиыны не теряются: 1 234 567,89 ₸', () => {
    const m = bookingConfirmationLetter({ ...base, totalMinor: '123456789' });
    expect(m.text).toContain('Сумма: 1 234 567,89 ₸.');
  });

  it('без длинного тире (правило проекта) и без ссылок: письмо нельзя спутать с фишингом', () => {
    for (const lang of ['ru', 'kk', 'en', 'zh'] as const) {
      const m = bookingConfirmationLetter({ ...base, lang });
      expect(m.text).not.toContain('—');
      expect(m.subject).not.toContain('—');
      expect(m.text).not.toMatch(/https?:\/\//);
    }
  });
});
