/**
 * Пробный период (срез 13, ADR-046).
 *
 * Четырнадцать дней с момента создания организации (решение владельца 27.09.2026, ADR-102; было 7 — ADR-046).
 * По истечении организация не удаляется и вход не закрывается: она читает свои данные, но не пишет, пока главный
 * администратор не подтвердит оплату (Q-144 — Б). Данные человека остаются на месте — иначе первый же забытый триал
 * превращается в потерю чужой работы.
 */

export const TRIAL_DAYS = 14;

export type OrganizationStatus = 'TRIAL' | 'ACTIVE' | 'READ_ONLY' | 'SUSPENDED';

export function trialEndsAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

export function daysLeft(trialEnd: Date, now: Date): number {
  const ms = trialEnd.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/** Что организации разрешено прямо сейчас. Пишем только в TRIAL и ACTIVE. */
export function canWrite(status: OrganizationStatus, trialEnd: Date | null, now: Date): boolean {
  if (status === 'ACTIVE') return true;
  if (status !== 'TRIAL') return false;
  return trialEnd !== null && now < trialEnd;
}

/** Статус, в который организация должна перейти сама, когда срок вышел. */
export function statusAfterTrial(
  status: OrganizationStatus,
  trialEnd: Date | null,
  now: Date,
): OrganizationStatus {
  if (status !== 'TRIAL') return status;
  if (trialEnd === null || now < trialEnd) return status;
  return 'READ_ONLY';
}

/** Что стойка и API говорят, когда запись закрыта: срок вышел или организация переведена в «только чтение» */
export const READ_ONLY_MESSAGE =
  'Пробный период закончился — оплатите подписку. Данные доступны для просмотра, изменения — после оплаты.';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Закрыт ли этот запрос для организации без права записи (ADR-102). Закрыты только изменяющие методы. Не закрыты:
 * вход, выход и пароль (`/auth/*`) — иначе человек застрянет; раздел «Платформа» главного администратора — он и
 * подтверждает оплату. Нет организации в сессии — правило молчит, это решает замок входа.
 */
export function writeBlocked(input: {
  method: string;
  path: string;
  organization: { status: OrganizationStatus; trialEndsAt: Date | null } | null;
  platformAdmin: boolean;
  now: Date;
}): boolean {
  if (READ_METHODS.has(input.method.toUpperCase())) return false;
  if (!input.organization) return false;
  const path = input.path.split('?')[0] ?? '';
  if (path === '/auth' || path.startsWith('/auth/')) return false;
  if (input.platformAdmin && (path === '/platform' || path.startsWith('/platform/'))) return false;
  return !canWrite(input.organization.status, input.organization.trialEndsAt, input.now);
}
