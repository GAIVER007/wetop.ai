/**
 * Что из пачки карточек Exely переносить в PMS (Q-165, решение владельца 23.09.2026). Нужно импорту дампа и
 * карточек Exely (`cli-import-reservations.ts`, слой Б в `reports/exely-code-audit-2026-09-20.md`): одна непонятная
 * карточка не роняет весь прогон, а пропускается с причиной в отчёте. Чистые функции, без БД и сети.
 */
import { ExelyImportError } from './errors';
import type { ReservationImportRecord } from './normalize-reservation';

/** Карточка не перенесена: причина — для отчёта прогона (без данных гостя). */
export interface SkippedCard {
  booking: string;
  reason: string;
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
 * До транзакции: запись с категорией или единицей, которых нет в фонде PMS, пропускается (Q-165) — иначе
 * `importReservations` бросает внутри транзакции и не переносится ничего. Единица проверяется только у проживаний,
 * которые занимают место: отменённому импорт ячейку не ищет.
 */
export function screenRecords(
  records: readonly ReservationImportRecord[],
  known: { accommodationTypeCodes: ReadonlySet<string>; exelyRoomNumbers: ReadonlySet<string> },
): { importable: ReservationImportRecord[]; skipped: SkippedCard[] } {
  const importable: ReservationImportRecord[] = [];
  const skipped: SkippedCard[] = [];
  for (const r of records) {
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
  return { importable, skipped };
}
