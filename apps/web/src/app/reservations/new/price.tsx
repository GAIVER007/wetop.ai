'use client';
import { useEffect, useState } from 'react';
import { formatMoney } from '../../../lib/money';
import { bookingQuote } from './availability';
import { AUTO_UNIT } from '../../../lib/booking-link';
import { displayDate } from '../../../lib/display-date';
import { intlLocale, msg } from '../../../i18n';
import { useLocale, useT } from '../../../i18n/locale-provider';

export function useBookingQuote(
  arrival: string,
  departure: string,
  snapshot: Record<string, string>,
  placementIds: string[],
  valid: boolean,
  attempt: number,
) {
  const [retry, setRetry] = useState(0);
  const input = {
    source: 'DESK',
    arrivalDate: arrival,
    departureDate: departure,
    ...(snapshot.promoCode?.trim() ? { promoCode: snapshot.promoCode.trim() } : {}),
    items: placementIds.map((id) => {
      const prefix = id === '0' ? '' : `item.${id}.`;
      const quantity = Number(snapshot[`${prefix}quantity`] || 1);
      const unit = snapshot[`${prefix}unitCode`];
      return {
        accommodationTypeCode: snapshot[`${prefix}accommodationTypeCode`] || '',
        ratePlanCode: snapshot[`${prefix}ratePlanCode`] || '',
        adults: Number(snapshot[`${prefix}adults`] || 1),
        quantity,
        unitCode: quantity > 1 || unit === AUTO_UNIT ? null : unit || null,
        ...(quantity === 1 && unit === AUTO_UNIT ? { autoAssign: true } : {}),
      };
    }),
  };
  const key = JSON.stringify({ input, retry, attempt });
  const [result, setResult] = useState<{
    key: string;
    quote: {
      totalMinor: string;
      currency: string;
      nights?: Array<{ date: string; priceMinor: string }>;
    } | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    setResult(null);
    if (!valid) return;
    let active = true;
    const timer = window.setTimeout(() => {
      const { input: payload } = JSON.parse(key);
      void bookingQuote(payload)
        .then((value) => {
          if (active) setResult({ key, ...value });
        })
        .catch(() => {
          if (active)
            setResult({
              key,
              quote: null,
              error: msg('Не удалось рассчитать стоимость. Повторите расчёт.'),
            });
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [key, valid]);
  const current = valid && result?.key === key ? result : null;
  return {
    ready: Boolean(current?.quote),
    quote: current?.quote ?? null,
    error: current?.error ?? '',
    retry: () => setRetry((n) => n + 1),
  };
}

export function BookingPrice({ state }: { state: ReturnType<typeof useBookingQuote> }) {
  const t = useT();
  return (
    <span className="booking-create__price" role="status">
      {state.quote ? (
        <>
          <small>{t('За весь срок')}</small>
          <strong>{formatMoney(state.quote.totalMinor, state.quote.currency)}</strong>
        </>
      ) : (
        <small>{state.error ? t(state.error) : t('Рассчитываем стоимость…')}</small>
      )}
      {state.error && (
        <button type="button" className="btn btn--secondary btn--sm" onClick={state.retry}>
          {t('Повторить расчёт')}
        </button>
      )}
    </span>
  );
}

/**
 * «Детализация цены по дням» (образец — форма брони Exely, поручение 03.10): цена каждой ночи
 * по всей брони из того же расчёта, что итог; средняя — целым тиыном вниз, сумма ночей равна итогу.
 */
export function PriceByNight({ state }: { state: ReturnType<typeof useBookingQuote> }) {
  const t = useT();
  const locale = useLocale();
  const nights = state.quote?.nights ?? [];
  if (!state.quote || nights.length === 0) return null;
  const { currency, totalMinor } = state.quote;
  const average = BigInt(totalMinor) / BigInt(nights.length);
  return (
    <details className="booking-create__nights" data-testid="price-by-night">
      <summary>{t('Детализация цены по дням')}</summary>
      <table className="booking-create__nights-table">
        <tbody>
          {nights.map((n) => (
            <tr key={n.date}>
              <th scope="row">{displayDate(n.date, 'full', intlLocale(locale))}</th>
              <td>{formatMoney(n.priceMinor, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="booking-create__nights-sum" data-testid="price-by-night-sum">
        {t('Всего ночей: {n}, средняя стоимость ночи: {average}', {
          n: nights.length,
          average: formatMoney(average.toString(), currency),
        })}
      </p>
    </details>
  );
}
