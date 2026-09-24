import { createHmac } from 'node:crypto';

/**
 * Подпись вошедшего для виджета ИИ-помощника (ТЗ ред. 1, П1; docs/assistant/README.md §1).
 *
 * Формат задаёт бот (`src/channels/widget_identity.py`, ветка `ai-seller`): платформа подписывает, бот только
 * проверяет. Любое расхождение в байтах бот не сообщает — он просто считает человека анонимом, и тот перестаёт видеть
 * свой диалог и свои ошибки. Поэтому формат держится эталоном ТЗ в тесте рядом.
 *
 * Строка под подписью — `user_id|email|org_id|role|issued_at`; токен — base64url строки без «=», точка, HMAC-SHA256
 * той же строки в hex. Секрет общий у платформы и помощника (`WIDGET_IDENTITY_SECRET`), лежит только в `.env`.
 */

/** Срок подписи — 12 часов, равен сроку смены по паролю (ADR-049) и `WIDGET_IDENTITY_TTL_SECONDS` помощника (ТЗ Б2) */
export const IDENTITY_TTL_SECONDS = 12 * 60 * 60;

const SEPARATOR = '|';

export interface IdentityFields {
  userId: string;
  email: string;
  organizationId: string;
  /** Ролей в платформе нет (ADR-023): пустая строка, бот читает её как None */
  role: string;
  /** Секунды Unix */
  issuedAt: number;
}

/** Поле строки под подписью: разделитель внутри значения — пробел, края обрезаны (как `_clean` у бота) */
function clean(value: string): string {
  return value.replaceAll(SEPARATOR, ' ').trim();
}

/** Строка, которую подписывает платформа и разбирает бот */
export function identityPayload(fields: IdentityFields): string {
  return [
    clean(fields.userId),
    clean(fields.email),
    clean(fields.organizationId),
    clean(fields.role),
    String(Math.trunc(fields.issuedAt)),
  ].join(SEPARATOR);
}

/** Токен для атрибута `data-identity`. Пустой секрет — отказ: подпись пустым ключом подделывается кем угодно */
export function signIdentity(secret: string, fields: IdentityFields): string {
  if (secret.trim() === '') throw new Error('Секрет подписи помощника пуст');
  const raw = Buffer.from(identityPayload(fields), 'utf8');
  const signature = createHmac('sha256', secret).update(raw).digest('hex');
  return `${raw.toString('base64url')}.${signature}`;
}
