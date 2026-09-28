'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  ApiError,
  guestsApi,
  reservationsApi,
  type CancelPreview,
  type ExtendPreview,
  type MovePreview,
} from '../../lib/api';
import type { ActionPreview } from '../../lib/api';
import { AUTO_UNIT } from '../../lib/booking-link';

export interface ActionResult {
  error: string | null;
  /** Введённое администратором — форма не должна стираться вместе с отказом */
  values?: Record<string, string>;
  /** Номер попытки: React сбрасывает форму после server action, ключ по нему возвращает поля */
  attempt?: number;
}

const KEPT = [
  'arrivalDate',
  'departureDate',
  'fromDate',
  'children',
  'source',
  'channel',
  'externalId',
  'accommodationTypeCode',
  'ratePlanCode',
  'adults',
  'quantity',
  'unitCode',
  'firstName',
  'lastName',
  'middleName',
  'email',
  'phone',
  'notes',
  'placementIds',
  'guestId',
];
const kept = (fd: FormData): Record<string, string> =>
  Object.fromEntries(
    [...fd.entries()].filter(
      ([key, value]) =>
        typeof value === 'string' &&
        (KEPT.includes(key) ||
          /^item\.\d+\.(accommodationTypeCode|ratePlanCode|adults|quantity|unitCode)$/.test(key)),
    ),
  ) as Record<string, string>;

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

function describe(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

/** Создать бронь со стойки. Ошибка API (400/409/422) возвращается в форму текстом. */
export async function createReservationAction(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  let number: string;
  try {
    const ids = (str(fd, 'placementIds') ?? '0').split(',');
    if (
      ids.length > 88 ||
      ids.some((id) => !/^\d+$/.test(id)) ||
      new Set(ids).size !== ids.length
    ) {
      throw new Error('Некорректный список размещений. Обновите форму.');
    }
    const items = ids.map((id) => {
      const prefix = id === '0' ? '' : `item.${id}.`;
      const value = (name: string) => str(fd, `${prefix}${name}`);
      const quantity = Number(value('quantity') ?? '1');
      // «Автоматически» (AV3, ADR-110): место назначит API, как виджету сайта и каналу (Q-094)
      const auto = quantity === 1 && value('unitCode') === AUTO_UNIT;
      return {
        accommodationTypeCode: value('accommodationTypeCode'),
        ratePlanCode: value('ratePlanCode'),
        adults: Number(value('adults') ?? '1'),
        quantity,
        unitCode: quantity > 1 || auto ? null : (value('unitCode') ?? null),
        ...(auto ? { autoAssign: true } : {}),
      };
    });
    const card = await reservationsApi.create({
      source: str(fd, 'source'),
      // ADR-071: поля есть в форме только у источника OTA
      ...(fd.has('channel') ? { channel: str(fd, 'channel') ?? null } : {}),
      ...(fd.has('externalId') ? { externalId: str(fd, 'externalId') ?? null } : {}),
      arrivalDate: str(fd, 'arrivalDate'),
      departureDate: str(fd, 'departureDate'),
      notes: str(fd, 'notes') ?? null,
      // G6 (ТЗ «Гости v2» §33): выбран существующий гость — бронь на него, полей нового нет
      ...(str(fd, 'guestId')
        ? { guestId: str(fd, 'guestId') }
        : {
            guest: {
              firstName: str(fd, 'firstName'),
              lastName: str(fd, 'lastName'),
              middleName: str(fd, 'middleName') ?? null,
              email: str(fd, 'email') ?? null,
              phone: str(fd, 'phone') ?? null,
            },
          }),
      items,
    });
    number = card.confirmationNumber;
  } catch (e) {
    return { error: describe(e), values: kept(fd), attempt: (_prev.attempt ?? 0) + 1 };
  }
  revalidatePath('/chessboard');
  redirect(`/reservations/${encodeURIComponent(number)}`);
}

/** Гость, которого форма брони предлагает выбрать (G6, ТЗ «Гости v2» §33–34) */
export interface BookingGuest {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  /** визиты — проживания с заездом, как в списке гостей */
  visits: number;
}

/**
 * ТЗ «Гости v2» §34: набран полный телефон — сначала показать уже известных гостей, а не заводить
 * нового. Поиск — тот же, что в списке гостей (своя организация, телефон по цифрам); выбирает
 * человек, сам WETOP гостей не связывает. Сбой поиска — пустой список: бронь от него не зависит.
 */
export async function findGuestsByPhoneAction(phone: string): Promise<BookingGuest[]> {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return [];
  try {
    const found = await guestsApi.directory({ q: digits, page: '1', pageSize: '3' });
    return found.rows.map((g) => ({
      id: g.id,
      name: [g.lastName, g.firstName, g.middleName].filter(Boolean).join(' '),
      phone: g.phone,
      email: g.email,
      visits: g.staysCount,
    }));
  } catch {
    return [];
  }
}

/** Правка готовой брони: заметки и источник. Пустая заметка стирает прежнюю. */
export async function updateReservationAction(
  number: string,
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  try {
    await reservationsApi.update(number, {
      notes: str(fd, 'notes') ?? null,
      source: str(fd, 'source'),
      ...(fd.has('channel') ? { channel: str(fd, 'channel') ?? null } : {}),
      ...(fd.has('externalId') ? { externalId: str(fd, 'externalId') ?? null } : {}),
    });
  } catch (e) {
    return { error: describe(e), values: kept(fd), attempt: (_prev.attempt ?? 0) + 1 };
  }
  revalidatePath('/chessboard');
  revalidatePath(`/reservations/${number}`);
  return { error: null };
}

/** Гостей на проживании (Q-102): вместимость категории проверит API. */
export async function updateStayGuestsAction(
  number: string,
  itemId: string,
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  try {
    await reservationsApi.updateItem(number, itemId, {
      adults: Number(str(fd, 'adults')),
      ...(fd.has('children') ? { children: Number(str(fd, 'children') ?? '0') } : {}),
    });
  } catch (e) {
    return { error: describe(e), values: kept(fd), attempt: (_prev.attempt ?? 0) + 1 };
  }
  revalidatePath(`/reservations/${number}`);
  return { error: null };
}

export async function cancelReservationAction(number: string): Promise<ActionResult> {
  try {
    await reservationsApi.cancel(number);
  } catch (e) {
    return { error: describe(e) };
  }
  revalidatePath('/chessboard');
  revalidatePath(`/reservations/${number}`);
  return { error: null };
}

export async function changeDatesAction(
  number: string,
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  try {
    await reservationsApi.changeDates(number, {
      arrivalDate: str(fd, 'arrivalDate'),
      departureDate: str(fd, 'departureDate'),
      ratePlanCode: str(fd, 'ratePlanCode'),
    });
  } catch (e) {
    return { error: describe(e), values: kept(fd), attempt: (_prev.attempt ?? 0) + 1 };
  }
  revalidatePath('/chessboard');
  revalidatePath(`/reservations/${number}`);
  return { error: null };
}

export async function assignUnitAction(
  number: string,
  itemId: string,
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  try {
    await reservationsApi.assign(number, itemId, {
      unitCode: str(fd, 'unitCode'),
      fromDate: str(fd, 'fromDate'),
      ratePlanCode: str(fd, 'ratePlanCode'),
    });
  } catch (e) {
    return { error: describe(e), values: kept(fd), attempt: (_prev.attempt ?? 0) + 1 };
  }
  revalidatePath('/chessboard');
  revalidatePath(`/reservations/${number}`);
  return { error: null };
}

/** Заезд / выезд / незаезд по проживанию. */
/** T2: продлить проживание на ночь одной кнопкой. */
export async function extendStayAction(
  number: string,
  itemId: string,
  nights = 1,
  ratePlanCode?: string,
): Promise<ActionResult> {
  try {
    await reservationsApi.extend(number, itemId, nights, ratePlanCode);
  } catch (e) {
    return { error: describe(e) };
  }
  revalidatePath('/chessboard');
  revalidatePath(`/reservations/${number}`);
  return { error: null };
}

export async function stayAction(
  number: string,
  itemId: string,
  action: 'check-in' | 'check-out' | 'no-show',
  /** T3: подтверждение выселения с непогашенным счётом */
  withDebt = false,
): Promise<ActionResult> {
  try {
    await reservationsApi.stay(number, itemId, action, withDebt ? { withDebt: true } : {});
  } catch (e) {
    return { error: describe(e) };
  }
  revalidatePath('/chessboard');
  revalidatePath(`/reservations/${number}`);
  return { error: null };
}

/**
 * Предпросмотр действия для окна подтверждения (срез 7.3, Д5): только чтение, ничего не меняет.
 * Отказ не мешает действию — окно откроется и честно скажет, что сумму посчитать не удалось.
 */
export async function previewAction(
  number: string,
  itemId: string,
  query: Record<string, string>,
): Promise<ActionPreview | null> {
  try {
    return await reservationsApi.preview(number, itemId, query);
  } catch {
    return null;
  }
}

// ── Предпросмотр сумм до подтверждения (срез 7.3, Д5): только чтение, `null` — не загрузился ──
export async function movePreviewAction(
  number: string,
  itemId: string,
  unitCode: string,
  ratePlanCode?: string,
): Promise<MovePreview | null> {
  try {
    return await reservationsApi.movePreview(number, itemId, unitCode, ratePlanCode);
  } catch {
    return null;
  }
}

export async function extendPreviewAction(
  number: string,
  itemId: string,
  ratePlanCode?: string,
  /** Шахматка при продлении за край спрашивает сумму на выбранное число ночей (ТЗ v2 §29) */
  nights = 1,
): Promise<ExtendPreview | null> {
  try {
    return await reservationsApi.extendPreview(number, itemId, nights, ratePlanCode);
  } catch {
    return null;
  }
}

export async function cancelPreviewAction(
  number: string,
  reason: 'cancel' | 'no_show',
  itemId?: string,
): Promise<CancelPreview | null> {
  try {
    return await reservationsApi.cancelPreview(number, reason, itemId);
  } catch {
    return null;
  }
}
