import type { ActionPreview, StayAvailability, UnassignedStay } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { countLabel, msg } from '../../i18n';
import { nightsBetween } from '../../lib/plural';
import { hospitalityStatus } from '../../lib/status/hospitality';
import { statusText } from '../../lib/status/types';
import { nightsLabel, RU, shortDate, type Lang } from './lang';

/**
 * Правила ящика «Брони без размещения» (ТЗ «Шахматка v2» §11–12, §64). Здесь только слова и выбор мест:
 * свободные места считает API (`/availability` на весь срок брони), назначение — команда `assign`,
 * деньги переезда в другую категорию — её предпросмотр. Своих правил посадки у ящика нет.
 */

export interface UnassignedSummary {
  reservations: number;
  stays: number;
  /** «2 брони без назначенного места» — считаются брони, а не проживания (Q-209) */
  text: string;
  /** у групповой брони мест больше, чем броней: «3 места ждут назначения»; иначе null */
  detail: string | null;
}

export function unassignedSummary(stays: UnassignedStay[], lang: Lang = RU): UnassignedSummary {
  const { t, locale } = lang;
  const reservations = new Set(stays.map((s) => s.confirmationNumber)).size;
  return {
    reservations,
    stays: stays.length,
    text: t('{count} без назначенного места', {
      count: countLabel(locale, t, reservations, [msg('бронь'), 'брони', msg('броней')]), // kk-allow: форма склонения
    }),
    detail:
      stays.length > reservations
        ? t('{count} назначения', {
            count: countLabel(locale, t, stays.length, [msg('место ждёт'), 'места ждут', msg('мест ждут')]), // kk-allow: форма склонения
          })
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

export function unassignedCard(s: UnassignedStay, lang: Lang = RU): UnassignedCard {
  const { t } = lang;
  const nights = nightsLabel(lang, nightsBetween(s.arrivalDate, s.departureDate));
  return {
    key: `${s.confirmationNumber}/${s.itemId ?? s.arrivalDate}`,
    number: s.confirmationNumber,
    itemId: s.itemId ?? null,
    guest: s.guestLabel?.trim() || t('Гость не указан'),
    dates: `${shortDate(lang, s.arrivalDate)} → ${shortDate(lang, s.departureDate)}, ${nights}`,
    nights,
    category: s.categoryName,
    categoryCode: s.categoryCode,
    status: t(statusText(hospitalityStatus, s.status)),
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
  lang: Lang = RU,
): CrossCategoryQuestion {
  const { t } = lang;
  const money = (minor: string) => formatMoney(minor, preview?.currency);
  const diff = BigInt(preview?.differenceMinor ?? '0');
  const abs = (diff < 0n ? -diff : diff).toString();
  return {
    title: t('Разместить бронь {number} в {unit}?', { number: card.number, unit: unitCode }),
    guest: card.guest,
    route: `${card.category} → ${targetCategory}`,
    dates: card.dates,
    money: !preview
      ? t('Сумму посчитать не удалось — проверьте счёт после размещения.')
      : diff !== 0n
        ? t('Разница стоимости: {sum}', { sum: `${diff > 0n ? '+' : '−'}${money(abs)}` })
        : t('Стоимость не изменится'),
    note:
      preview?.newPriceMinor && diff !== 0n
        ? t('Проживание станет {next} вместо {current}.', {
            next: money(preview.newPriceMinor),
            current: money(preview.currentPriceMinor),
          })
        : t('Бронь займёт {unit} на весь срок.', { unit: unitCode }),
  };
}
