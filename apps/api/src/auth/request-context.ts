import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Кто делает текущий запрос — чтобы `audit_logs.user_id` заполнялся сам, а не в каждом репозитории руками
 * (ADR-023: «когда появится вход по пользователям, к записи добавится, кто именно»).
 *
 * Служебные ходоки — сторож, импорт из Exely, скрипты сверки — автора не имеют: их записи остаются без
 * пользователя, и это правда, а не пропуск.
 */
const storage = new AsyncLocalStorage<{ userId: string | null }>();

export function withSignedInUser<T>(userId: string | null, fn: () => Promise<T>): Promise<T> {
  return storage.run({ userId }, fn);
}

export function currentUserId(): string | null {
  return storage.getStore()?.userId ?? null;
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
