'use server';
import { chessboardApi, financeApi, reservationsApi, type StayAvailability } from '../../lib/api';

/** Что показывает предпросмотр брони в календаре сверх клетки: точные даты и суммы по счёту проживания */
export interface StayPreviewData {
  arrivalDate: string;
  departureDate: string;
  currency: string;
  guestHref: string | null;
  /** Суммы счёта проживания, тиыны строкой (ADR-008); null — счёт не загрузился или ещё не открыт */
  money: {
    chargedMinor: string;
    paidMinor: string;
    refundedMinor: string;
    balanceMinor: string;
  } | null;
}

/**
 * Данные одного предпросмотра (ТЗ «Шахматка v2» §23): грузятся по выбранной брони, а не для каждой
 * плашки — сетка по-прежнему приходит одним ответом (§69). Только чтение теми же GET, что карточка;
 * телефона, документов и номеров из каналов здесь нет — в предпросмотре они не нужны. Отказ счёта
 * не роняет даты (частичный сбой §36); отказ карточки — `null`, окно предложит открыть бронь.
 */
export async function stayPreviewAction(
  number: string,
  itemId: string,
): Promise<StayPreviewData | null> {
  try {
    const [card, finance] = await Promise.all([
      chessboardApi.reservation(number),
      financeApi.reservation(number).catch(() => null),
    ]);
    const item = card.items.find((i) => i.id === itemId);
    if (!item) return null;
    const folio = finance?.folios.find((f) => f.reservationItemId === itemId) ?? null;
    return {
      arrivalDate: item.arrivalDate,
      departureDate: item.departureDate,
      currency: card.currency,
      guestHref: card.primaryGuest ? `/guests/${encodeURIComponent(card.primaryGuest.id)}` : null,
      money: folio
        ? {
            chargedMinor: folio.chargedMinor,
            paidMinor: folio.paidMinor,
            refundedMinor: folio.refundedMinor,
            balanceMinor: folio.balanceMinor,
          }
        : null,
    };
  } catch {
    return null;
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Свободные места на весь срок брони без ячейки (ТЗ «Шахматка v2» §12): ящик «Брони без размещения»
 * зовёт это по выбранной брони, а не для каждой карточки (условие владельца к PR 6 — без N+1). Тот же
 * `GET /availability`, что «Свободные места»; `null` — не загрузилось, ящик предложит повторить.
 */
export async function stayAvailabilityAction(
  arrival: string,
  departure: string,
): Promise<StayAvailability | null> {
  if (!ISO_DATE.test(arrival) || !ISO_DATE.test(departure) || departure <= arrival) return null;
  try {
    return await reservationsApi.availability(arrival, departure);
  } catch {
    return null;
  }
}
