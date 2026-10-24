/**
 * Напоминания клиентам салона (docs/decisions/2026-10-21-salon-reminders-loyalty.md, §1).
 * Чистые функции: когда напоминать, каким текстом и ссылка «Написать в WhatsApp». Текст собирается в момент
 * отправки, в очереди его нет (персональные данные не лежат в очереди).
 */

export const DEFAULT_REMINDER_HOURS: readonly number[] = [24, 2];
export const REMINDER_MAX_ATTEMPTS = 5;
export const REMINDER_TEMPLATE_MAX = 1000;
export const REMINDER_PLACEHOLDERS = ['имя', 'услуга', 'дата', 'время', 'мастер', 'салон', 'адрес', 'телефон'] as const;
export type ReminderPlaceholder = (typeof REMINDER_PLACEHOLDERS)[number];
export type ReminderVariables = Record<ReminderPlaceholder, string>;

export const DEFAULT_REMINDER_TEMPLATE =
  'Здравствуйте, {имя}! Напоминаем о записи в {салон}: {услуга}, {дата} в {время}, мастер {мастер}. ' +
  'Адрес: {адрес}. Если планы изменились, позвоните нам: {телефон}.';

export const CONFIRMATION_TEMPLATE =
  'Здравствуйте, {имя}! Вы записаны в {салон}: {услуга}, {дата} в {время}, мастер {мастер}. Адрес: {адрес}. ' +
  'Телефон: {телефон}.';

/** Плановые моменты напоминаний: за N часов до начала, только будущие, без повторов, по возрастанию */
export function reminderDueTimes(startsAt: Date, hoursBefore: readonly number[], now: Date): Date[] {
  const unique = [...new Set(hoursBefore.filter((h) => Number.isInteger(h) && h > 0))];
  return unique
    .map((h) => new Date(startsAt.getTime() - h * 3_600_000))
    .filter((due) => due.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
}

/** Значения подстановок: дата «23 октября» и время «10:30» по поясу филиала (AGENTS.md §13) */
export function reminderVariables(input: {
  customerName: string;
  serviceName: string;
  startsAt: Date;
  timezone: string;
  masterName: string;
  salonName: string;
  address: string | null;
  phone: string | null;
}): ReminderVariables {
  const date = new Intl.DateTimeFormat('ru-RU', { timeZone: input.timezone, day: 'numeric', month: 'long' }).format(input.startsAt);
  const time = new Intl.DateTimeFormat('ru-RU', {
    timeZone: input.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(input.startsAt);
  return {
    имя: input.customerName.trim(),
    услуга: input.serviceName.trim(),
    дата: date,
    время: time,
    мастер: input.masterName.trim(),
    салон: input.salonName.trim(),
    адрес: (input.address ?? '').trim(),
    телефон: (input.phone ?? '').trim(),
  };
}

/** Подставить значения; незнакомое поле остаётся как написано, пустые места не дают двойных пробелов */
export function renderReminder(template: string | null | undefined, vars: ReminderVariables): string {
  const source = template && template.trim() ? template : DEFAULT_REMINDER_TEMPLATE;
  return source
    .replace(/\{([^{}]{1,20})\}/g, (whole, key: string) =>
      (REMINDER_PLACEHOLDERS as readonly string[]).includes(key) ? vars[key as ReminderPlaceholder] : whole,
    )
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ([!?.,:;])/g, '$1')
    .trim();
}

/** Ссылка wa.me с готовым текстом; номер только цифрами, казахстанская 8 в начале становится 7 */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Пауза перед следующей попыткой: 5, 10, 20 минут и так далее, не больше 6 часов */
export function reminderBackoffMs(attempts: number): number {
  return Math.min(5 * 60_000 * 2 ** Math.max(0, attempts - 1), 6 * 3_600_000);
}

export interface ReminderSettingsInput {
  expectedRevision: number;
  enabled: boolean;
  hoursBefore: number[];
  template: string | null;
  whatsappTemplateName: string | null;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

const SETTINGS_KEYS = ['expectedRevision', 'enabled', 'hoursBefore', 'template', 'whatsappTemplateName'];

export function parseReminderSettings(raw: unknown): Parsed<ReminderSettingsInput> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'Пришлите настройки напоминаний' };
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some((key) => !SETTINGS_KEYS.includes(key))) return { ok: false, reason: 'Лишние поля в настройках' };
  const revision = body['expectedRevision'];
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0)
    return { ok: false, reason: 'Проверьте версию настроек' };
  if (typeof body['enabled'] !== 'boolean') return { ok: false, reason: 'Укажите, включены ли напоминания' };
  const hours = body['hoursBefore'];
  if (
    !Array.isArray(hours) ||
    hours.length < 1 ||
    hours.length > 3 ||
    hours.some((h) => typeof h !== 'number' || !Number.isInteger(h) || h < 1 || h > 168)
  )
    return { ok: false, reason: 'За сколько часов: от одного до трёх значений, каждое от 1 до 168 часов' };
  const template = body['template'] == null ? '' : body['template'];
  if (typeof template !== 'string' || template.trim().length > REMINDER_TEMPLATE_MAX)
    return { ok: false, reason: `Текст напоминания до ${REMINDER_TEMPLATE_MAX} знаков` };
  const name = body['whatsappTemplateName'] == null ? '' : body['whatsappTemplateName'];
  // имя шаблона Meta: строчные латинские буквы, цифры и подчёркивание
  if (typeof name !== 'string' || (name.trim() !== '' && !/^[a-z0-9_]{1,100}$/.test(name.trim())))
    return { ok: false, reason: 'Имя шаблона WhatsApp: строчные латинские буквы, цифры и знак подчёркивания' };
  return {
    ok: true,
    value: {
      expectedRevision: revision,
      enabled: body['enabled'],
      hoursBefore: [...new Set(hours as number[])].sort((a, b) => b - a),
      template: template.trim() || null,
      whatsappTemplateName: name.trim() || null,
    },
  };
}

// ───────────── просьба отзыва после визита ─────────────

/** Через сколько часов после визита просим отзыв */
export const REVIEW_REQUEST_DELAY_HOURS = 2;
/** Окно вежливой отправки по поясу филиала: с 10:00 до 21:00 */
const REVIEW_REQUEST_FROM_HOUR = 10;
const REVIEW_REQUEST_TO_HOUR = 21;

/**
 * Когда просить отзыв: через 2 часа после конца визита или после «Выполнено», что позже. Ночью и поздно вечером
 * не пишем: время до 10:00 и с 21:00 по поясу филиала переносится на ближайшие 10:00 (AGENTS.md §13).
 */
export function reviewRequestDueAt(input: { endsAt: Date; doneAt: Date; timezone: string }): Date {
  const base = new Date(Math.max(input.endsAt.getTime(), input.doneAt.getTime()) + REVIEW_REQUEST_DELAY_HOURS * 3_600_000);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: input.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(base);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const hour = part('hour');
  const sinceMidnightMs = ((hour * 60 + part('minute')) * 60 + part('second')) * 1000 + base.getUTCMilliseconds();
  if (hour >= REVIEW_REQUEST_FROM_HOUR && hour < REVIEW_REQUEST_TO_HOUR) return base;
  const targetMs = (hour < REVIEW_REQUEST_FROM_HOUR ? REVIEW_REQUEST_FROM_HOUR : 24 + REVIEW_REQUEST_FROM_HOUR) * 3_600_000;
  return new Date(base.getTime() + targetMs - sinceMidnightMs);
}

/** Текст просьбы отзыва: коротко, имя и ссылка на страницу отзыва */
export function reviewRequestText(customerName: string, url: string): string {
  const name = customerName.trim();
  return `Спасибо, что были у нас${name ? `, ${name}` : ''}! Оцените визит: ${url}`;
}

/** Полный адрес страницы отзыва: адрес стойки и путь приглашения `/reviews/<ключ>` */
export function reviewUrl(appUrl: string, reviewPath: string): string {
  return `${appUrl.replace(/\/+$/, '')}/${reviewPath.replace(/^\/+/, '')}`;
}
