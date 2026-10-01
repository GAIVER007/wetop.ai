'use client';
import { useEffect, useState } from 'react';
import type { StayOffers } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { bookingPriceOffer } from './availability';

export function BookingPrice({
  arrival,
  departure,
  snapshot,
  single,
}: {
  arrival: string;
  departure: string;
  snapshot: Record<string, string>;
  single: boolean;
}) {
  const adults = Number(snapshot.adults || 1);
  const [result, setResult] = useState<StayOffers | null>(null);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void bookingPriceOffer(arrival, departure, adults).then((value) => {
        if (active) setResult(value);
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [arrival, departure, adults]);
  const offer = result?.byCategory[snapshot.accommodationTypeCode ?? ''];
  const matches =
    single &&
    Number(snapshot.quantity || 1) === 1 &&
    !snapshot.promoCode?.trim() &&
    result?.arrivalDate === arrival &&
    result.departureDate === departure &&
    result.guests === adults &&
    offer?.ratePlanCode === snapshot.ratePlanCode;
  return (
    <span className="booking-create__price">
      {matches && offer ? (
        <>
          <small>Предварительно за весь срок</small>
          <strong>{formatMoney(offer.totalMinor, result!.currency)}</strong>
        </>
      ) : (
        <small>Стоимость рассчитается при создании</small>
      )}
    </span>
  );
}
