import { describe, expect, it } from 'vitest';
import { parseOrderRating, ratingSummary } from './ratings';

/** Оценка официанта гостем (DATA_MODEL §39, ADR-169) */
describe('оценка гостя', () => {
  it('целые 1–5 звёзд, комментарий необязателен', () => {
    expect(parseOrderRating({ stars: 5 })).toEqual({ stars: 5, comment: null });
    expect(parseOrderRating({ stars: 1, comment: ' Долго ждали ' })).toEqual({ stars: 1, comment: 'Долго ждали' });
    for (const stars of [0, 6, 4.5, '5'])
      expect(() => parseOrderRating({ stars })).toThrow();
  });
  it('рейтинг: среднее с одним знаком, без оценок нет рейтинга', () => {
    expect(ratingSummary([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
    expect(ratingSummary([])).toEqual({ average: null, count: 0 });
  });
});
