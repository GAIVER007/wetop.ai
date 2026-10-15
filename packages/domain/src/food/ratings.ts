import { foodObject, foodText } from './food';

/** Оценка официанта гостем (DATA_MODEL §39, ADR-169): 1–5 звёзд и необязательный комментарий */
export function parseOrderRating(raw: unknown): { stars: number; comment: string | null } {
  const b = foodObject(raw, ['stars', 'comment']);
  if (typeof b.stars !== 'number' || !Number.isInteger(b.stars) || b.stars < 1 || b.stars > 5)
    throw new Error('Оценка: от 1 до 5 звёзд');
  const comment =
    b.comment == null || (typeof b.comment === 'string' && !b.comment.trim()) ? null : foodText(b.comment, 500);
  return { stars: b.stars, comment };
}

/** Рейтинг: среднее с одним знаком после запятой; без оценок рейтинга нет */
export function ratingSummary(stars: readonly number[]): { average: number | null; count: number } {
  if (!stars.length) return { average: null, count: 0 };
  return { average: Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10, count: stars.length };
}
