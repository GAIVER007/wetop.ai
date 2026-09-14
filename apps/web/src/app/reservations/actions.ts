'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ApiError, reservationsApi } from '../../lib/api';

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
      return {
        accommodationTypeCode: value('accommodationTypeCode'),
        ratePlanCode: value('ratePlanCode'),
        adults: Number(value('adults') ?? '1'),
        quantity,
        unitCode: quantity > 1 ? null : (value('unitCode') ?? null),
      };
    });
    const card = await reservationsApi.create({
      source: str(fd, 'source'),
      arrivalDate: str(fd, 'arrivalDate'),
      departureDate: str(fd, 'departureDate'),
      notes: str(fd, 'notes') ?? null,
      guest: {
        firstName: str(fd, 'firstName'),
        lastName: str(fd, 'lastName'),
        middleName: str(fd, 'middleName') ?? null,
        email: str(fd, 'email') ?? null,
        phone: str(fd, 'phone') ?? null,
      },
      items,
    });
    number = card.confirmationNumber;
  } catch (e) {
    return { error: describe(e), values: kept(fd), attempt: (_prev.attempt ?? 0) + 1 };
  }
  revalidatePath('/chessboard');
  redirect(`/reservations/${encodeURIComponent(number)}`);
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
