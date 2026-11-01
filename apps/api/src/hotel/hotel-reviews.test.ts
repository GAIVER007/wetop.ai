import { describe, expect, it } from 'vitest';
import { hotelReviewDecision, parseHotelReview } from './hotel-reviews';

/**
 * Отзыв гостя гостиницы после выезда (HOTEL-REVIEWS-20261031, миграция 175): единая система с салоном. Ссылку
 * выдают только после выезда хотя бы одного проживания; после отправки новая не выдаётся; срок 30 дней.
 */
const NOW = new Date('2026-10-31T10:00:00Z');

describe('выдача ссылки на отзыв гостиницы', () => {
  it('до выезда нельзя: ни одного проживания в CHECKED_OUT', () => {
    expect(hotelReviewDecision({ itemStatuses: ['CHECKED_IN'], current: null, now: NOW })).toEqual({ ok: false, reason: 'NOT_CHECKED_OUT' });
  });
  it('после выезда: новая ссылка на 30 дней', () => {
    expect(hotelReviewDecision({ itemStatuses: ['CHECKED_OUT', 'CANCELLED'], current: null, now: NOW })).toEqual({
      ok: true,
      expiresAt: new Date('2026-11-30T10:00:00Z'),
      rotated: false,
    });
  });
  it('повторно: заменяет прежнюю; отзыв уже отправлен: нельзя', () => {
    expect(hotelReviewDecision({ itemStatuses: ['CHECKED_OUT'], current: { submittedAt: null }, now: NOW })).toMatchObject({ ok: true, rotated: true });
    expect(hotelReviewDecision({ itemStatuses: ['CHECKED_OUT'], current: { submittedAt: NOW }, now: NOW })).toEqual({ ok: false, reason: 'SUBMITTED' });
  });
});

describe('форма отзыва гостя', () => {
  it('оценка 1–5 целым, комментарий до 2000 знаков, лишние поля нельзя', () => {
    expect(parseHotelReview({ stars: 5, comment: '  Чисто и тихо  ' })).toEqual({ stars: 5, comment: 'Чисто и тихо' });
    expect(parseHotelReview({ stars: 4 })).toEqual({ stars: 4, comment: null });
    for (const bad of [{ stars: 0 }, { stars: 6 }, { stars: 4.5 }, { stars: '5' }, { stars: 5, comment: 'x'.repeat(2001) }, { stars: 5, phone: '1' }, null, []])
      expect(() => parseHotelReview(bad)).toThrow();
  });
});
