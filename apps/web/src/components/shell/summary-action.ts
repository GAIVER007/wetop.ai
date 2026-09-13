'use server';
import { deskApi, chessboardApi } from '../../lib/api';
export async function loadDeskSummary() {
  try {
    const day = await deskApi.today();
    const board = await chessboardApi.board(day.date, day.date).catch(() => null);
    return { day, availability: board?.summary[day.date] ?? null, error: null };
  } catch {
    return {
      day: null,
      availability: null,
      error: 'Не удалось получить сводку объекта. Попробуйте ещё раз.',
    };
  }
}
