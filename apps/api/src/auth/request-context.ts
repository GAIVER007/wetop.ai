import { AsyncLocalStorage } from 'node:async_hooks';
import { can, type MembershipRole, type Permission } from '@pms/domain';

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
  /** Роль вошедшего в его организации (DATA_MODEL §16.1, ADR-083); у служебного ходока нет */
  role?: MembershipRole | null;
  /** Главный администратор платформы (§16.2) */
  platformAdmin?: boolean;
  /**
   * Публичный путь сайта организации (виджет брони, котировка продавца): человека нет, но объект — её, а не объект
   * по имени (план tenant-isolation-2026-09-26 п. 4). Прав владельца и автора в журнале это не даёт.
   */
  organizationScope?: boolean;
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

/** Выполнить публичный путь от имени организации её сайта: объект — этой организации, человека за запросом нет */
export function withOrganizationScope<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
  return storage.run({ userId: null, organizationId, organizationScope: true }, fn);
}

/**
 * Запрос ограничен одной организацией: вошедший человек или публичный путь её сайта. Выбор объекта идёт по организации;
 * служебный ходок (скрипт, сторож, импорт) — как раньше, объект по имени.
 */
export function actsForOrganization(): boolean {
  return hasSignedInActor() || storage.getStore()?.organizationScope === true;
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

/** Роль вошедшего в его организации. `null` — за запросом нет человека (или роль не передана) */
export function currentRole(): MembershipRole | null {
  return storage.getStore()?.role ?? null;
}

/**
 * Разрешено ли текущему запросу то, что может только владелец организации (ADR-083): вошедший владелец — да,
 * служебный ходок — да (он и есть владелец, как и для объекта), вошедший с другой или неизвестной ролью — нет.
 */
export function actorIsOwner(): boolean {
  return !hasSignedInActor() || currentRole() === 'OWNER';
}

/**
 * Есть ли у текущего запроса право (ADR-101, DATA_MODEL §16.5) — для проверок внутри действия, которые не решить по
 * маршруту: корректировка счёта на уменьшение, кнопки продавца. Служебный ходок — да, как `actorIsOwner`; вошедший —
 * по таблице прав его роли; неизвестная роль — нет.
 */
export function actorMay(permission: Permission): boolean {
  return !hasSignedInActor() || can(currentRole(), permission);
}

/** Главный администратор платформы — только вошедший с отметкой: служебные ключи раздел «Платформа» не открывают */
export function actorIsPlatformAdmin(): boolean {
  return hasSignedInActor() && storage.getStore()?.platformAdmin === true;
}
