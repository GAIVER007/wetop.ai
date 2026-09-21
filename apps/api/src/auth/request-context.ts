import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Кто делает текущий запрос — чтобы `audit_logs.user_id` заполнялся сам, а не в каждом репозитории руками
 * (ADR-023: «когда появится вход по пользователям, к записи добавится, кто именно»).
 *
 * Служебные ходоки — сторож, импорт из Exely, скрипты сверки — автора не имеют: их записи остаются без
 * пользователя, и это правда, а не пропуск.
 */
interface RequestActor {
  userId: string | null;
  /**
   * Организация вошедшего (ADR-061). `null` — за запросом нет человека: служебный ключ, сторож,
   * скрипт владельца. Такие ходоки видят объект целиком, и это осознанно: они и есть владелец.
   */
  organizationId: string | null;
}

const storage = new AsyncLocalStorage<RequestActor>();

export function withSignedInUser<T>(
  actor: RequestActor | string | null,
  fn: () => Promise<T>,
): Promise<T> {
  // Строка — прежний вызов «только автор»: оставлен, чтобы тесты и служебные пути не переписывать.
  const value: RequestActor =
    actor === null || typeof actor === 'string'
      ? { userId: actor, organizationId: null }
      : actor;
  return storage.run(value, fn);
}

export function currentUserId(): string | null {
  return storage.getStore()?.userId ?? null;
}

/** Организация текущего запроса. `null` — служебный ходок или запрос вне контекста. */
export function currentOrganizationId(): string | null {
  return storage.getStore()?.organizationId ?? null;
}

/**
 * Есть ли вообще человек за этим запросом. Отличает «служебный ходок» (видит всё) от «вошедший,
 * у которого своя организация» (видит только свой объект): по одному `organizationId` их не
 * различить — у вошедшего без членства он тоже был бы пустым.
 */
export function hasSignedInActor(): boolean {
  return storage.getStore()?.userId !== undefined ? storage.getStore()!.userId !== null : false;
}

type AuditCreateArgs = { data?: Record<string, unknown> | Array<Record<string, unknown>> };

/** Подставляет автора в аргументы `auditLog.create`. Явно указанный автор сильнее: его не перебиваем. */
export function attachAuthor<T extends AuditCreateArgs>(args: T, userId: string | null): T {
  if (!userId || !args || typeof args !== 'object' || !('data' in args) || !args.data) return args;
  const stamp = (row: Record<string, unknown>) =>
    row.userId === undefined ? { ...row, userId } : row;
  return {
    ...args,
    data: Array.isArray(args.data) ? args.data.map(stamp) : stamp(args.data),
  };
}
