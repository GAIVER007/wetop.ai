'use server';
import { MAX_CHESSBOARD_DAYS } from '@pms/domain';
import { chessboardApi, type ChessboardRow } from '../../lib/api';
import { serverT } from '../../i18n/server';

/** Календарь за отрезок для «Быстрого отчёта» гостиницы: только чтение, не дольше предела календаря */
export async function loadHotelReportRows(
  from: string,
  to: string,
): Promise<{ rows?: ChessboardRow[]; error?: string }> {
  const t = await serverT();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to)
    return { error: t('Выберите корректный период') };
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  if (days > MAX_CHESSBOARD_DAYS) return { error: t('Не более {n} дней', { n: MAX_CHESSBOARD_DAYS }) };
  try {
    return { rows: (await chessboardApi.board(from, to)).rows };
  } catch {
    return { error: t('Не удалось загрузить брони за период. Повторите попытку.') };
  }
}
