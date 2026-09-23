/**
 * Что из пачки карточек Exely переносить в PMS — переходный период, ADR-064 (Q-165 и метка ручных броней).
 * Чистые функции, без БД и сети: cli-sync-day.ts и cli-import-reservations.ts применяют их до транзакции,
 * чтобы одна непонятная карточка не роняла весь прогон, а бронь, которую смена сама завела в Exely за
 * переключённый канал, не приехала в PMS второй раз.
 */
import { ExelyImportError } from './errors';
import type { ReservationImportRecord } from './normalize-reservation';

/**
 * Метка ручной брони: смена заводит в Exely бронь переключённого канала и пишет в комментарий
 * «WETOP <номер брони PMS>» (форма утверждена владельцем 23.09.2026). Слово — заглавными, отдельно,
 * за ним через пробел номер. Коды каналов вида «BDC-WETOP-…» меткой не считаются: после WETOP там дефис.
 */
const MARKER = /(?:^|\s)WETOP\s+([A-Za-z0-9][A-Za-z0-9-]{3,})/;

/** Номер брони PMS из комментария Exely или null, если метки нет. */
export function wetopMarker(comment: string | null | undefined): string | null {
  if (!comment) return null;
  const m = MARKER.exec(comment);
  return m ? m[1]! : null;
}

/**
 * Итог проверки метки на одной брони Exely — для листа смены (шаг 9 плана ADR-064). Текст комментария не
 * печатается: в нём могут быть данные гостя.
 */
export function markerCheckLine(booking: string, comment: string | null | undefined): string {
  const pms = wetopMarker(comment);
  if (pms)
    return `Бронь ${booking}: метка найдена — WETOP ${pms}. Досинхронизация эту бронь не перенесёт: она уже в PMS.`;
  const again = 'Досинхронизация перенесёт её в PMS второй раз — поправьте комментарий.';
  if (!comment?.trim())
    return `Бронь ${booking}: комментарий заказчика пуст — метки нет. Метку надо вписать в поле, которое Exely отдаёт как «Комментарий заказчика». ${again}`;
  if (/wetop/i.test(comment))
    return `Бронь ${booking}: «WETOP» в комментарии есть, но не в формате метки — нужно заглавными, пробел, номер брони PMS, например «WETOP BDC-1234567». ${again}`;
  return `Бронь ${booking}: в комментарии заказчика метки нет. ${again}`;
}

/** Похоже ли на номер брони Exely: `20260923-513903-1265432109` */
export const EXELY_BOOKING_NUMBER = /^\d{8}-\d+-\d+$/;

/** Итог поиска метки среди броней, изменённых за сутки (проверка без номера брони). */
export function markerSearchSummary(checked: number, found: number, malformed: number): string {
  const head = `Проверено броней Exely, изменённых за сутки: ${checked}; с меткой WETOP: ${found}${malformed ? `; с «WETOP» не по форме: ${malformed}` : ''}.`;
  if (found > 0 || malformed > 0) return head;
  return (
    `${head} Метки нет ни в одной. Если вы её вписали и сохранили — значит, это поле Exely не отдаёт как ` +
    '«Комментарий заказчика»: попробуйте другое поле комментария в форме брони.'
  );
}

/** Карточка не перенесена: причина — для отчёта прогона и неисправности (без данных гостя). */
export interface SkippedCard {
  booking: string;
  reason: string;
}
/** Карточка с меткой: бронь уже живёт в PMS под номером pmsNumber. */
export interface MirroredCard {
  booking: string;
  pmsNumber: string;
}

/**
 * Разбор карточек по одной (Q-165): ошибка разбора (`ExelyImportError`) пропускает только эту карточку.
 * Любая другая ошибка — не про карточку (сеть, код) — останавливает прогон, как и раньше.
 */
export function normalizeEach<T>(
  cards: readonly T[],
  bookingOf: (card: T) => string,
  normalize: (card: T) => ReservationImportRecord,
): { records: ReservationImportRecord[]; skipped: SkippedCard[] } {
  const records: ReservationImportRecord[] = [];
  const skipped: SkippedCard[] = [];
  for (const card of cards) {
    try {
      records.push(normalize(card));
    } catch (e) {
      if (!(e instanceof ExelyImportError)) throw e;
      skipped.push({ booking: bookingOf(card), reason: e.message });
    }
  }
  return { records, skipped };
}

const holdsUnit = (status: string) => status !== 'CANCELLED' && status !== 'NO_SHOW';

/**
 * До транзакции: запись с меткой не переносится; запись с категорией или единицей, которых нет в фонде PMS,
 * пропускается (Q-165) — иначе `importReservations` бросает внутри транзакции и не переносится ничего.
 * Единица проверяется только у проживаний, которые занимают место: отменённому импорт ячейку не ищет.
 */
export function screenRecords(
  records: readonly ReservationImportRecord[],
  known: { accommodationTypeCodes: ReadonlySet<string>; exelyRoomNumbers: ReadonlySet<string> },
): { importable: ReservationImportRecord[]; mirrored: MirroredCard[]; skipped: SkippedCard[] } {
  const importable: ReservationImportRecord[] = [];
  const mirrored: MirroredCard[] = [];
  const skipped: SkippedCard[] = [];
  for (const r of records) {
    const pmsNumber = wetopMarker(r.notes);
    if (pmsNumber) {
      mirrored.push({ booking: r.confirmationNumber, pmsNumber });
      continue;
    }
    const badType = r.items.find((it) => !known.accommodationTypeCodes.has(it.accommodationTypeCode));
    if (badType) {
      skipped.push({
        booking: r.confirmationNumber,
        reason: `Бронь ${r.confirmationNumber}: категории ${badType.accommodationTypeCode} нет в фонде PMS`,
      });
      continue;
    }
    const badUnit = r.items.find(
      (it) =>
        it.exelyRoomNumber !== null &&
        holdsUnit(it.status) &&
        !known.exelyRoomNumbers.has(it.exelyRoomNumber),
    );
    if (badUnit) {
      skipped.push({
        booking: r.confirmationNumber,
        reason: `Бронь ${r.confirmationNumber}: единицы «${badUnit.exelyRoomNumber}» нет в фонде PMS`,
      });
      continue;
    }
    importable.push(r);
  }
  return { importable, mirrored, skipped };
}
