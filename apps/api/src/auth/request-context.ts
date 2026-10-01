import { AsyncLocalStorage } from 'node:async_hooks';
import { can, type MembershipRole, type Permission } from '@pms/domain';

/** Рабочая область запроса (Platform P2, К1; план P2 §3–§4, ADR-120): вычисляется API, снаружи не приходит */
export type RequestScope = 'ORGANIZATION' | 'BUSINESS' | 'LOCATION';
export type BusinessVertical = 'HOSPITALITY' | 'BEAUTY';

/**
 * Кто делает текущий запрос — чтобы `audit_logs.user_id` заполнялся сам, а не в каждом репозитории руками
 * (ADR-023: «когда появится вход по пользователям, к записи добавится, кто именно»).
 *
 * Служебные процессы — сторож и скрипты сверки — автора не имеют: их записи остаются без
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
  /**
   * Служебный доступ к базе внутри запроса человека (RLS, DATA_MODEL §17): раздел «Платформа» главного администратора
   * читает все организации. Кто автор — не меняется; меняется только роль базы.
   */
  serviceDatabase?: boolean;
  /**
   * Scope вошедшего (Platform P2, К1): `auth/scope.ts` вычисляет его из указателя `X-Wetop-Scope` и проверяет на каждом
   * запросе. Нет указателя или он не прошёл — ORGANIZATION. У служебного ходока scope нет.
   */
  scope?: RequestScope;
  /** Business выбора — только после проверки: принадлежит организации вошедшего и не в архиве */
  businessId?: string;
  /** Филиал выбора — только после проверки: принадлежит этому Business и не в архиве */
  locationId?: string;
  /** Направление — из строки Business, никогда не приходит снаружи */
  vertical?: BusinessVertical;
}

const storage = new AsyncLocalStorage<RequestActor>();

/**
 * Запустить в контексте и дождаться ВНУТРИ него. Запрос Prisma ленивый: уходит в базу только на `then`. Верни помощник
 * его не дождавшись — запрос выполнился бы снаружи, в чужом контексте: другой организацией или без неё (RLS, §17).
 */
function runAwaited<T>(value: RequestActor, fn: () => Promise<T>): Promise<T> {
  return storage.run(value, async () => await fn());
}

export function withSignedInUser<T>(
  actor: RequestActor | string | null,
  fn: () => Promise<T>,
): Promise<T> {
  // Строка — прежний вызов «только автор»: оставлен, чтобы тесты и служебные пути не переписывать.
  const value: RequestActor =
    actor === null || typeof actor === 'string'
      ? { userId: actor, organizationId: null }
      : actor;
  return runAwaited(value, fn);
}

/** Выполнить публичный путь от имени организации её сайта: объект — этой организации, человека за запросом нет */
export function withOrganizationScope<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
  return runAwaited({ userId: null, organizationId, organizationScope: true }, fn);
}

/**
 * Запрос ограничен одной организацией: вошедший человек или публичный путь её сайта. Выбор объекта идёт по организации;
 * служебный ходок (скрипт, сторож, импорт) — как раньше, объект по имени.
 */
export function actsForOrganization(): boolean {
  return hasSignedInActor() || storage.getStore()?.organizationScope === true;
}

/**
 * Организация для роли базы `wetop_app` (RLS, DATA_MODEL §17, ADR-103): вошедший человек или публичный путь сайта
 * организации. `null` — служебный путь: фоновые циклы, вебхуки, служебные ключи, вход и «Платформа».
 */
export function databaseTenant(): string | null {
  const store = storage.getStore();
  if (!store || store.serviceDatabase) return null;
  return store.organizationId ?? null;
}

/**
 * Выполнить расчёт в scope филиала внутри текущего запроса (Platform P3, ADR-130): сводка по филиалам считает те же
 * показатели, что экран одного объекта, по очереди для каждого филиала организации вошедшего. Организация и человек те
 * же, меняется только выбор; вне запроса человека (служебный ходок) вызывать нечего.
 */
export function withScopeOf<T>(
  scope: Pick<RequestActor, 'scope' | 'businessId' | 'locationId' | 'vertical'>,
  fn: () => Promise<T>,
): Promise<T> {
  const store = storage.getStore();
  if (!store || store.userId === null) throw new Error('withScopeOf: нет запроса человека');
  return runAwaited({ ...store, ...scope }, fn);
}

/** Выполнить внутри запроса человека служебной ролью базы — только для раздела «Платформа» (§17.2) */
export function withServiceDatabase<T>(fn: () => Promise<T>): Promise<T> {
  const store = storage.getStore();
  return runAwaited({ ...(store ?? { userId: null, organizationId: null }), serviceDatabase: true }, fn);
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

/**
 * Подставляет автора и организацию в аргументы `auditLog.create`. Явно указанные значения сильнее:
 * их не перебиваем. Организация — Phase 1 изоляции (ADR-100 §17.2): запись журнала с рождения знает,
 * чья она, тем же механизмом, что и подпись автора.
 */
export function attachAuthor<T extends AuditCreateArgs>(
  args: T,
  userId: string | null,
  organizationId: string | null = null,
): T {
  if ((!userId && !organizationId) || !args || typeof args !== 'object' || !('data' in args) || !args.data)
    return args;
  const stamp = (row: Record<string, unknown>) => ({
    ...row,
    ...(userId && row.userId === undefined ? { userId } : {}),
    ...(organizationId && row.organizationId === undefined ? { organizationId } : {}),
  });
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
 * Есть ли у текущего запроса право (ADR-107, DATA_MODEL §16.5) — для проверок внутри действия, которые не решить по
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

/** Scope текущего запроса. `null` — за запросом нет человека (служебный ходок) или запрос вне контекста. */
export function currentScope(): RequestScope | null {
  const store = storage.getStore();
  if (!store || !hasSignedInActor()) return null;
  return store.scope ?? 'ORGANIZATION';
}

/** Проверенный Business выбора; `null` — scope организации или служебный ходок */
export function currentBusinessId(): string | null {
  return hasSignedInActor() ? (storage.getStore()?.businessId ?? null) : null;
}

/** Проверенный филиал выбора; `null` — scope организации или Business, служебный ходок */
export function currentLocationId(): string | null {
  return hasSignedInActor() ? (storage.getStore()?.locationId ?? null) : null;
}

/** Направление выбранного Business; `null`, пока Business не выбран */
export function currentVertical(): BusinessVertical | null {
  return hasSignedInActor() ? (storage.getStore()?.vertical ?? null) : null;
}

/** Фактический scope для ответа стойке (`GET /auth/me`, план P2 §4б) */
export function scopeView() {
  return {
    scope: currentScope() ?? 'ORGANIZATION',
    businessId: currentBusinessId(),
    locationId: currentLocationId(),
    vertical: currentVertical(),
  };
}
