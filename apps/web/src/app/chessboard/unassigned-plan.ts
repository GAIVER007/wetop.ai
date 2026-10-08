import { hospitalityWords as STATUS } from '../../lib/status/hospitality';
import type { ActionPreview, StayAvailability, UnassignedStay } from '../../lib/api';
import { displayDate } from '../../lib/display-date';
import { formatMoney } from '../../lib/money';
import { nightsBetween, pluralRu } from '../../lib/plural';

/**
 * Правила ящика «Брони без размещения» (ТЗ «Шахматка v2» §11–12, §64). Здесь только слова и выбор мест:
 * свободные места считает API (`/availability` на весь срок брони), назначение — команда `assign`,
 * деньги переезда в другую категорию — её предпросмотр. Своих правил посадки у ящика нет.
 */

/** Слово о брони в единственном числе, как в строке «Без ячейки» и на «Бронях» */

export interface UnassignedSummary {
  reservations: number;
  stays: number;
  /** «2 брони без назначенного места» — считаются брони, а не проживания (Q-209) */
  text: string;
  /** у групповой брони мест больше, чем броней: «3 места ждут назначения»; иначе null */
  detail: string | null;
}

export function unassignedSummary(stays: UnassignedStay[]): UnassignedSummary {
  const reservations = new Set(stays.map((s) => s.confirmationNumber)).size;
  return {
    reservations,
    stays: stays.length,
    text: `${pluralRu(reservations, ['бронь', 'брони', 'броней'])} без назначенного места`,
    detail:
      stays.length > reservations
        ? `${pluralRu(stays.length, ['место ждёт', 'места ждут', 'мест ждут'])} назначения`
        : null,
  };
}

export interface UnassignedCard {
  /** ключ карточки: бронь и проживание */
  key: string;
  number: string;
  /** id проживания для `assign`; null — старый ответ API без него, назначить из ящика нельзя */
  itemId: string | null;
  guest: string;
  /** «21 сент. → 23 сент., 2 ночи» */
  dates: string;
  /** «2 ночи» — карточка пишет даты в <time>, ночи — этим словом */
  nights: string;
  category: string;
  categoryCode: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
}

export function unassignedCard(s: UnassignedStay): UnassignedCard {
  const nights = pluralRu(nightsBetween(s.arrivalDate, s.departureDate), ['ночь', 'ночи', 'ночей']);
  return {
    key: `${s.confirmationNumber}/${s.itemId ?? s.arrivalDate}`,
    number: s.confirmationNumber,
    itemId: s.itemId ?? null,
    guest: s.guestLabel?.trim() || 'Гость не указан',
    dates: `${displayDate(s.arrivalDate)} → ${displayDate(s.departureDate)}, ${nights}`,
    nights,
    category: s.categoryName,
    categoryCode: s.categoryCode,
    status: STATUS[s.status] ?? s.status,
    arrivalDate: s.arrivalDate,
    departureDate: s.departureDate,
  };
}

export interface FreeChoice {
  /** свободные места категории брони на весь её срок */
  own: string[];
  /** другие категории с местами — по порядку категорий сетки; пустые не показываются */
  others: Array<{ code: string; name: string; units: string[] }>;
}

export function freeChoice(
  stay: Pick<UnassignedStay, 'categoryCode'>,
  availability: StayAvailability,
  categories: Array<{ code: string; name: string }>,
): FreeChoice {
  const units = (code: string) => availability.byCategory[code]?.availableUnitCodes ?? [];
  return {
    own: units(stay.categoryCode),
    others: categories
      .filter((c) => c.code !== stay.categoryCode)
      .map((c) => ({ code: c.code, name: c.name, units: units(c.code) }))
      .filter((c) => c.units.length > 0),
  };
}

export interface CrossCategoryQuestion {
  title: string;
  guest: string;
  /** «Двухместный номер → Мужской общий номер» */
  route: string;
  dates: string;
  money: string;
  note: string;
}

/**
 * Вопрос перед размещением в чужой категории (как окно переселения §27): команда `assign` переоценит всё
 * проживание, поэтому сумму называем до подтверждения. `null` — предпросмотр не ответил: действие не
 * запрещаем, но о деньгах не молчим.
 */
export function crossCategoryQuestion(
  card: UnassignedCard,
  unitCode: string,
  targetCategory: string,
  preview: ActionPreview | null,
): CrossCategoryQuestion {
  const money = (minor: string) => formatMoney(minor, preview?.currency);
  const diff = BigInt(preview?.differenceMinor ?? '0');
  const abs = (diff < 0n ? -diff : diff).toString();
  return {
    title: `Разместить бронь ${card.number} в ${unitCode}?`,
    guest: card.guest,
    route: `${card.category} → ${targetCategory}`,
    dates: card.dates,
    money: !preview
      ? 'Сумму посчитать не удалось — проверьте счёт после размещения.'
      : diff !== 0n
        ? `Разница стоимости: ${diff > 0n ? '+' : '−'}${money(abs)}`
        : 'Стоимость не изменится',
    note:
      preview?.newPriceMinor && diff !== 0n
        ? `Проживание станет ${money(preview.newPriceMinor)} вместо ${money(preview.currentPriceMinor)}.`
        : `Бронь займёт ${unitCode} на весь срок.`,
  };
}
