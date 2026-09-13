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
import { createHmac } from 'node:crypto';
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
