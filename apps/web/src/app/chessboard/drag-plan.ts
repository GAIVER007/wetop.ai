/**
 * Перетаскивание брони по шахматке: администратор тянет клетку проживания на другую строку-ячейку.
 * Здесь только чистая часть — что едет в dataTransfer и что делать по броску; сам вызов
 * переселения остаётся в существующем server action (assignUnitAction), API не меняется.
 */
import { displayDate } from '../../lib/display-date';

export const DRAG_MIME = 'application/x-pms-stay';

export interface DragPayload {
  /** Номер брони */
  number: string;
  /** Проживание (reservation item) — его и переселяем */
  itemId: string;
  /** Дата взятой клетки — с неё и переселяем (YYYY-MM-DD по Алматы) */
  date: string;
  /** Ячейка, в которой клетка сейчас */
  unitCode: string;
}

export type MovePlan =
  | { kind: 'noop' }
  /** `title` и `detail` — вопрос и последствие для окна подтверждения (DESIGN.md §8, §14) */
  | { kind: 'move'; unitCode: string; fromDate: string; title: string; detail: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function encodeDrag(payload: DragPayload): string {
  return JSON.stringify(payload);
}

/** Чужой drop (файл, текст, ссылка) или битые данные — не бронь: возвращаем null, ничего не делаем. */
export function decodeDrag(raw: string): DragPayload | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === 'string' && p[k] !== '' ? (p[k] as string) : null);
  const number = str('number');
  const itemId = str('itemId');
  const date = str('date');
  const unitCode = str('unitCode');
  if (!number || !itemId || !date || !unitCode || !ISO_DATE.test(date)) return null;
  return { number, itemId, date, unitCode };
}

/** Бросок на ту же ячейку — не действие. На другую — переселение с даты взятой клетки, с вопросом. */
export function planMove(payload: DragPayload, target: { unitCode: string }): MovePlan {
  if (target.unitCode === payload.unitCode) return { kind: 'noop' };
  return {
    kind: 'move',
    unitCode: target.unitCode,
    fromDate: payload.date,
    title: `Переселить бронь ${payload.number}?`,
    detail: `С ${displayDate(payload.date)} проживание переедет из ячейки ${payload.unitCode} в ${target.unitCode} — прежняя ячейка освободится.`,
  };
}
