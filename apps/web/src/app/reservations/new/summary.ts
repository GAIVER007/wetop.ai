import { AUTO_UNIT } from '../../../lib/booking-link';
import { displayDate } from '../../../lib/display-date';
import { nightsBetween } from '../../../lib/plural';
import { countLabel, intlLocale, msg, translator, type DeskLocale, type Translate } from '../../../i18n';
import { SOURCES } from '../sources';
import type { BookingGuest } from '../actions';

/**
 * Что именно создастся: даты, размещения, источник, гость. Без цен (их считает сервер, `POST /reservations/quote`).
 * Строки сводки читают липкая строка сути формы (`booking-digest`) и блок «Проверить детали брони».
 */
export function summarize(
  props: {
    arrival: string;
    departure: string;
    categories: Array<{ code: string; name: string }>;
    piiStorage: 'real' | 'pseudonymized';
  },
  placementIds: string[],
  snapshot: Record<string, string>,
  picked: BookingGuest | null,
  locale: DeskLocale = 'ru',
  t: Translate = translator(locale),
) {
  const dash = '—';
  const nights = nightsBetween(props.arrival, props.departure);
  const placements = placementIds.map((id) => {
    const field = (name: string) => (id === '0' ? name : `item.${id}.${name}`);
    const category = props.categories.find(
      (c) => c.code === snapshot[field('accommodationTypeCode')],
    );
    const quantity = Math.max(1, Number(snapshot[field('quantity')] ?? '1') || 1);
    const adults = Math.max(1, Number(snapshot[field('adults')] ?? '1') || 1);
    const unit = snapshot[field('unitCode')];
    const where =
      quantity > 1
        ? t('{places}, номера назначит система', {
            places: countLabel(locale, t, quantity, [msg('место'), 'места', msg('мест')]), // kk-allow: форма склонения
          })
        : unit === AUTO_UNIT
          ? t('номер назначит система')
          : unit
            ? t('номер {unit}', { unit })
            : t('номер назначим позже');
    // WET-02 (ТЗ QA 01.10.2026): `adults` относится к одному месту, `quantity` размножает размещение,
    // так же создаёт бронь API: гостей в размещении столько, сколько мест, умноженных на гостей на место
    const guests = quantity * adults;
    return `${category?.name ?? dash}, ${where}, ${countLabel(locale, t, guests, [msg('гость'), 'гостя', msg('гостей')])}`; // kk-allow: форма склонения
  });
  return {
    nights,
    arrival: props.arrival,
    departure: props.departure,
    datesText:
      nights > 0
        ? `${displayDate(props.arrival, 'short', intlLocale(locale))} → ${displayDate(props.departure, 'short', intlLocale(locale))}, ${countLabel(locale, t, nights, [msg('ночь'), 'ночи', msg('ночей')])}` // kk-allow: форма склонения
        : dash,
    placements,
    source: t(SOURCES.find(([value]) => value === snapshot['source'])?.[1] ?? dash),
    guest: picked
      ? picked.name
      : props.piiStorage === 'real'
        ? [snapshot['lastName'], snapshot['firstName']].filter(Boolean).join(' ').trim() || dash
        : t('Автоматическая карточка'),
  };
}
