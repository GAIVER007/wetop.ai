/**
 * Пробный период (срез 13, ADR-046).
 *
 * Семь дней с момента создания организации. По истечении организация не удаляется и не блокируется
 * молча: она переходит в режим только чтение, продление руками владельца. Данные человека остаются
 * на месте — иначе первый же забытый триал превращается в потерю чужой работы.
 */

export const TRIAL_DAYS = 7;

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
