import { AsyncLocalStorage } from 'node:async_hooks';
import { currentUserId } from '../auth/request-context';

/**
 * Кто действует в текущем запросе (срез 13, этап 8; ADR-023 обещал автора в `audit_logs`).
 *
 * Хранится в `AsyncLocalStorage`, а не передаётся параметром: журнал пишут семь хранилищ через
 * десятки служб, и протаскивать `userId` через каждую сигнатуру значило бы править половину API
 * ради одной колонки. Middleware учётных записей кладёт сюда автора по куке или `Bearer`;
 * `currentActor()` читает его там, где создаётся строка журнала. Запрос без сессии (стойка за
 * Cloudflare Access, сторож, синхронизация) — автор `null`, как и было до среза 13.
 */
export interface Actor {
  userId: string;
  organizationId: string;
}

const storage = new AsyncLocalStorage<Actor>();

export function runAsActor<T>(actor: Actor, fn: () => T): T {
  return storage.run(actor, fn);
}

export function currentActor(): Actor | null {
  return storage.getStore() ?? null;
}

/**
 * Для строки журнала: `user_id` автора или `null`. Одно место, чтобы семь хранилищ не расходились.
 *
 * Два входа живут рядом (Q-146): вошедшего по коду на почту сюда кладёт `ActorMiddleware`, вошедшего
 * по паролю — замок `SessionGuard` через контекст запроса (`auth/request-context`). Хранилища зовут
 * одну функцию и получают автора в обоих случаях; явный `null` отсюда расширение Prisma не перебивает,
 * поэтому второй источник читается здесь, а не в нём.
 */
export function auditUserId(): string | null {
  return currentActor()?.userId ?? currentUserId();
}
