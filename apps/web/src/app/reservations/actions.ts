'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ApiError, reservationsApi } from '../../lib/api';

export interface ActionResult {
  error: string | null;
}

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
    const card = await reservationsApi.create({
      source: str(fd, 'source'),
      arrivalDate: str(fd, 'arrivalDate'),
      departureDate: str(fd, 'departureDate'),
      notes: str(fd, 'notes') ?? null,
      guest: {
        firstName: str(fd, 'firstName'),
        lastName: str(fd, 'lastName'),
        phone: str(fd, 'phone') ?? null,
      },
      items: [
        {
          accommodationTypeCode: str(fd, 'accommodationTypeCode'),
          ratePlanCode: str(fd, 'ratePlanCode'),
          adults: Number(str(fd, 'adults') ?? '1'),
          unitCode: str(fd, 'unitCode') ?? null,
        },
      ],
    });
    number = card.confirmationNumber;
  } catch (e) {
    return { error: describe(e) };
  }
  revalidatePath('/chessboard');
  redirect(`/reservations/${encodeURIComponent(number)}`);
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
    return { error: describe(e) };
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
    });
  } catch (e) {
    return { error: describe(e) };
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
): Promise<ActionResult> {
  try {
    await reservationsApi.extend(number, itemId, nights);
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
): Promise<ActionResult> {
  try {
    await reservationsApi.stay(number, itemId, action);
  } catch (e) {
    return { error: describe(e) };
  }
  revalidatePath('/chessboard');
  revalidatePath(`/reservations/${number}`);
  return { error: null };
}
