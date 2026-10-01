'use server';
import { reservationsApi } from '../../../lib/api';

/** Uses the authenticated selected branch; the create action checks availability again. */
export async function checkBookingAvailability(arrival: string, departure: string) {
  const valid = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!valid(arrival) || !valid(departure) || departure <= arrival) {
    return { availability: null, error: 'Проверьте даты заезда и выезда.' };
  }
  try {
    return { availability: await reservationsApi.availability(arrival, departure), error: '' };
  } catch {
    return { availability: null, error: 'Не удалось проверить свободные места.' };
  }
}

export async function bookingPriceOffer(arrival: string, departure: string, guests: number) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(arrival) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(departure) ||
    departure <= arrival ||
    !Number.isInteger(guests) ||
    guests < 1 ||
    guests > 100
  )
    return null;
  try {
    return await reservationsApi.offers(arrival, departure, guests);
  } catch {
    return null;
  }
}
