/**
 * Где допустимо хранить настоящие персональные данные (ADR-009, ADR-018).
 *
 * Правило объекта: реальные ФИО, телефоны и почта гостей лежат только в production-БД в Казахстане.
 * Пока Q-070 (провайдер и регион БД) не закрыт, рабочая база — Supabase в Сингапуре, и всё, что
 * туда попадает, должно быть псевдонимизировано. Импорт из Exely это уже делал; брони, приходящие
 * из каналов живьём, — нет, и клали в сингапурскую базу настоящих гостей.
 *
 * Переключатель один: PII_STORAGE=real разрешает хранить настоящие данные и ставится только на
 * production-БД в РК. Любое другое значение (включая отсутствие) означает псевдонимизацию.
 *
 * Псевдоним детерминирован: одна и та же бронь всегда даёт одного и того же вымышленного гостя,
 * поэтому повторная ревизия не плодит дублей. Обратного преобразования нет: HMAC односторонний,
 * а исходные ФИО и телефон никуда не записываются.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { blankToNull } from './text';

export interface GuestIdentity {
  firstName: string;
  lastName: string;
  phone?: string | null | undefined;
  email?: string | null | undefined;
}

export class AnonymizeSaltMissingError extends Error {
  override readonly name = 'AnonymizeSaltMissingError';
  constructor() {
    super(
      'Нет соли для псевдонимов: задайте ANONYMIZE_SALT в .env (openssl rand -hex 32). ' +
        'Захардкоженной соли больше нет — с известной солью псевдоним перебирается по словарю. ' +
        'Настоящие ПД разрешает только PII_STORAGE=real (production-БД в РК, Q-070).',
    );
  }
}

/**
 * Соль берётся из ANONYMIZE_SALT, а если его нет — из уже заданного PII_ENCRYPTION_KEY.
 * Второй вариант нужен, чтобы удаление публичной соли из репозитория не остановило приём броней
 * до того, как владелец допишет строку в .env. Значение нигде не печатается.
 */
export function pseudonymSalt(env: NodeJS.ProcessEnv = process.env): string {
  const s = env['ANONYMIZE_SALT'] || env['PII_ENCRYPTION_KEY'] || '';
  if (!s) throw new AnonymizeSaltMissingError();
  return s;
}

export function realPiiAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env['PII_STORAGE'] === 'real';
}

/** Детерминированный вымышленный гость из ключа брони. `key` — внешний идентификатор, не ФИО. */
export function pseudonymizeGuest(
  guest: GuestIdentity,
  key: string,
  salt: string,
): GuestIdentity & { phone: string | null; email: string | null } {
  if (!salt) throw new AnonymizeSaltMissingError();
  // разделение назначений: та же соль может использоваться и для других производных значений
  const h = createHmac('sha256', salt).update(`guest-pseudonym\u0000${key}`).digest('hex');
  const digits = String(parseInt(h.slice(0, 8), 16) % 10_000_000).padStart(7, '0');
  return {
    firstName: 'Гость',
    lastName: `Канал-${h.slice(0, 6)}`,
    phone: guest.phone ? `+7000${digits}` : null,
    email: guest.email ? `guest-${h.slice(6, 12)}@example.invalid` : null,
  };
}

/**
 * Гость в том виде, в каком его можно записать в текущую базу.
 * PII_STORAGE=real — как пришёл; иначе — псевдоним.
 */
export function guestForStorage(
  guest: GuestIdentity,
  key: string,
  env: NodeJS.ProcessEnv = process.env,
): GuestIdentity & { phone: string | null; email: string | null } {
  // До выбора режима: пустой контакт от канала не должен ни лечь пустой строкой (real),
  // ни превратиться в выдуманный номер у псевдонима — '   ' истинна в JS
  const contacts = { ...guest, phone: blankToNull(guest.phone), email: blankToNull(guest.email) };
  if (realPiiAllowed(env)) return contacts;
  return pseudonymizeGuest(contacts, key, pseudonymSalt(env));
}

/**
 * Почта в свободном тексте. Совпадение начинается только на границе слова: без этого якоря выражение перебирало каждую
 * позицию длинного слова до конца — квадратичная работа, заметка в 100 КБ маскировалась секунды (аудит 26.09, С-38).
 */
const EMAIL_IN_TEXT = /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Международный номер: «+», код страны и ещё не меньше шести цифр, с пробелами, скобками, точками и дефисами */
const PHONE_INTL = /(?<![\w+])\+\d[\d\s().-]{6,}\d(?!\w)/g;
/** Казахстанский или российский номер без «+»: 11 цифр на 7 или 8. Номер брони канала после «BDC-» не задевается */
const PHONE_LOCAL = /(?<![\w-])[78][\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?![\w-])/g;

/**
 * Почта и телефоны в свободном тексте заменяются на `<почта>` и `<телефон>` (Q-169, SECURITY.md §2, §7).
 * Номера броней, даты, суммы и время остаются. Имена так не поймать — от них защищает только подсказка у поля.
 */
export function maskContacts(text: string): string {
  return text
    .replace(EMAIL_IN_TEXT, '<почта>')
    .replace(PHONE_INTL, '<телефон>')
    .replace(PHONE_LOCAL, '<телефон>');
}

/**
 * Свободный текст — заметка брони, заметка канала, комментарий гостя с сайта, назначение начисления — в том виде,
 * в каком его можно записать в текущую базу (Q-169, решение 24.09.2026): PII_STORAGE=real — как введён, иначе
 * с маской на почте и телефонах.
 */
export function freeTextForStorage(
  text: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (text === null || text === undefined) return null;
  return realPiiAllowed(env) ? text : maskContacts(text);
}

/** Какие данные гостей хранит эта база: `real` — как введено (база в РК), иначе только псевдонимы. */
export function piiStorageMode(env: NodeJS.ProcessEnv = process.env): 'real' | 'pseudonymized' {
  return realPiiAllowed(env) ? 'real' : 'pseudonymized';
}

export interface DeskGuestInput {
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  middleName?: string | null | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
}

/**
 * Гость, которого стойка вводит руками (ADR-072). С `PII_STORAGE=real` — как введено: края обрезаны, пустое —
 * NULL; обязательность имени проверяет вызывающий. Иначе введённое не сохраняется совсем: «Гость Стойка-xxxxxx»
 * без отчества и контактов. Метка случайная, а не от имени: у ручной брони нет ключа брони канала, а производное
 * от имени перебиралось бы по словарю; соль не нужна.
 */
export function deskGuestForStorage(
  typed: DeskGuestInput,
  env: NodeJS.ProcessEnv = process.env,
): {
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string | null;
  email: string | null;
} {
  if (realPiiAllowed(env))
    return {
      firstName: (typed.firstName ?? '').trim(),
      lastName: (typed.lastName ?? '').trim(),
      middleName: blankToNull(typed.middleName),
      phone: blankToNull(typed.phone),
      email: blankToNull(typed.email),
    };
  return {
    firstName: 'Гость',
    lastName: `Стойка-${randomBytes(3).toString('hex')}`,
    middleName: null,
    phone: null,
    email: null,
  };
}
