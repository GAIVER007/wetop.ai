import { reminderDueTimes } from '../beauty/reminders';

/**
 * Напоминания гостям ресторана о брони стола (DATA_MODEL §61, миграция 152; решение владельца 23.10.2026 «Да, делай по
 * этой схеме»). Расписание, повтор, ссылка WhatsApp и разбор настроек общие с салоном (beauty/reminders); здесь правила
 * брони стола и свои подстановки: у ресторана нет мастера и услуги, есть число гостей.
 */
export const FOOD_REMINDER_PLACEHOLDERS = ['имя', 'дата', 'время', 'гостей', 'ресторан', 'адрес', 'телефон'] as const;
export type FoodReminderPlaceholder = (typeof FOOD_REMINDER_PLACEHOLDERS)[number];
export type FoodReminderVariables = Record<FoodReminderPlaceholder, string>;

export const FOOD_DEFAULT_REMINDER_TEMPLATE =
  'Здравствуйте, {имя}! Напоминаем о брони в {ресторан}: {дата} в {время}, {гостей}. Адрес: {адрес}. Телефон: {телефон}.';
export const FOOD_CONFIRMATION_TEMPLATE =
  'Здравствуйте, {имя}! Столик забронирован в {ресторан}: {дата} в {время}, {гостей}. Адрес: {адрес}. Телефон: {телефон}.';

/** Тексты гостям на языке организации (ORG-LOCALE-20261026) */
type FoodLocale = 'ru' | 'kk' | 'en';
const FOOD_TEMPLATES: Record<FoodLocale, { reminder: string; confirmation: string }> = {
  ru: { reminder: FOOD_DEFAULT_REMINDER_TEMPLATE, confirmation: FOOD_CONFIRMATION_TEMPLATE },
  kk: {
    reminder: 'Сәлеметсіз бе, {имя}! {ресторан} брондауыңызды еске саламыз: {дата}, {время}, {гостей}. Мекенжай: {адрес}. Телефон: {телефон}.',
    confirmation: 'Сәлеметсіз бе, {имя}! {ресторан} үстел брондалды: {дата}, {время}, {гостей}. Мекенжай: {адрес}. Телефон: {телефон}.',
  },
  en: {
    reminder: 'Hello, {имя}! This is a reminder of your table booking at {ресторан}: {дата} at {время}, {гостей}. Address: {адрес}. Phone: {телефон}.',
    confirmation: 'Hello, {имя}! Your table at {ресторан} is booked: {дата} at {время}, {гостей}. Address: {адрес}. Phone: {телефон}.',
  },
};
export const foodDefaultReminderTemplate = (locale: FoodLocale = 'ru') => FOOD_TEMPLATES[locale].reminder;
export const foodConfirmationTemplate = (locale: FoodLocale = 'ru') => FOOD_TEMPLATES[locale].confirmation;
const FOOD_INTL: Record<FoodLocale, string> = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-GB' };
const FOOD_ALIASES: Record<string, FoodReminderPlaceholder> = {
  name: 'имя', date: 'дата', time: 'время', guests: 'гостей', restaurant: 'ресторан', address: 'адрес', phone: 'телефон',
};

/** Брони этих состояний ещё ждут гостя: им напоминаем */
export const FOOD_REMINDER_STATUSES: readonly string[] = ['BOOKED', 'CONFIRMED'];

/**
 * Какие строки очереди нужны брони сейчас. Гость с улицы (WALK_IN) уже в зале, ему не напоминают. Подтверждение
 * только при создании брони с сайта (`confirm`), повторная синхронизация его не просит.
 */
export function foodReminderWanted(input: {
  startsAt: Date;
  status: string;
  source: string;
  enabled: boolean;
  hoursBefore: readonly number[];
  now: Date;
  confirm?: boolean | undefined;
}): { reminders: Date[]; confirmation: boolean } {
  const live = input.enabled && FOOD_REMINDER_STATUSES.includes(input.status) && input.source !== 'WALK_IN';
  if (!live) return { reminders: [], confirmation: false };
  return {
    reminders: reminderDueTimes(input.startsAt, input.hoursBefore, input.now),
    confirmation: input.confirm === true && input.source === 'WEBSITE',
  };
}

function guests(n: number, locale: FoodLocale = 'ru'): string {
  if (locale === 'en') return `${n} ${n === 1 ? 'guest' : 'guests'}`;
  if (locale === 'kk') return `${n} қонақ`;
  const mod10 = n % 10,
    mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? 'гость' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'гостя' : 'гостей';
  return `${n} ${word}`;
}

/** Значения подстановок: дата и время по поясу филиала (AGENTS.md §13) */
export function foodReminderVariables(input: {
  customerName: string;
  startsAt: Date;
  timezone: string;
  partySize: number;
  restaurantName: string;
  address: string | null;
  phone: string | null;
  /** язык организации; без него русский */
  locale?: FoodLocale;
}): FoodReminderVariables {
  const intl = FOOD_INTL[input.locale ?? 'ru'];
  const date = new Intl.DateTimeFormat(intl, { timeZone: input.timezone, day: 'numeric', month: 'long' }).format(input.startsAt);
  const time = new Intl.DateTimeFormat(intl, { timeZone: input.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    input.startsAt,
  );
  return {
    имя: input.customerName.trim(),
    дата: date,
    время: time,
    гостей: guests(input.partySize, input.locale),
    ресторан: input.restaurantName.trim(),
    адрес: (input.address ?? '').trim(),
    телефон: (input.phone ?? '').trim(),
  };
}

/** Подставить значения; незнакомое поле остаётся как написано; пустые «Адрес:» и «Телефон:» убираются */
export function renderFoodReminder(template: string | null | undefined, vars: FoodReminderVariables): string {
  const source = template && template.trim() ? template : FOOD_DEFAULT_REMINDER_TEMPLATE;
  return source
    .replace(/\{([^{}]{1,20})\}/g, (whole, raw: string) => {
      const key = FOOD_ALIASES[raw] ?? raw;
      return (FOOD_REMINDER_PLACEHOLDERS as readonly string[]).includes(key) ? vars[key as FoodReminderPlaceholder] : whole;
    })
    .replace(/\s*(Адрес|Телефон|Address|Phone|Мекенжай):\s*\./g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ([!?.,:;])/g, '$1')
    .trim();
}
