import pg from 'pg';

/**
 * Row Level Security (DATA_MODEL v1.13 §17, ADR-103, план `plans/rls-2026-09-27.md`).
 *
 * Две роли базы: `wetop_app` — запросы организации (на неё действуют политики), служебная — фоновые циклы, вебхуки,
 * служебные ключи, вход, «Платформа» и скрипты (политики на неё не действуют). Пул сам выбирает роль по контексту
 * запроса: организация есть — `wetop_app` и переменная `app.org_id`, нет — служебная роль. Код репозиториев не
 * меняется, а запрос организации мимо резолвера объекта всё равно упирается в базу.
 */

/** Таблицы под RLS — политика `rls_tenant` на каждой (миграция `20260927000028_rls_policies`) */
export const RLS_TENANT_TABLES: readonly string[] = [
  'organizations',
  'memberships',
  'sessions',
  'invites',
  'user_errors',
  'seller_profiles',
  'organization_extensions',
  'seller_agents',
  'wizard_drafts',
  'properties',
  'guests',
  'audit_logs',
  'buildings',
  'accommodation_types',
  'inventory_units',
  'reservations',
  'rate_plans',
  'channel_mappings',
  'services',
  'payments',
  'tracked_sites',
  'promo_codes',
  'floors',
  'physical_rooms',
  'reservation_items',
  'stay_guests',
  'allocations',
  'guest_documents',
  'housekeeping_events',
  'inventory_blocks',
  'rate_plan_accommodation_types',
  'daily_rates',
  'restrictions',
  'folios',
  'charges',
  'payment_allocations',
  'refunds',
  'web_sessions',
  'web_pageviews',
  'web_events',
  'wizard_jobs',
  'wizard_messages',
  // Platform P1 (ADR-104 §18): бизнес — организация в строке; филиал — через родителя-Business.
  // Политики — в миграции 20260927000030_platform_p1_business_location
  'businesses',
  'locations',
  // Касса (DATA_MODEL §21): политики — в миграциях 20261002000040_cashbox и …041
  'cash_categories',
  'cash_operations',
  'cash_reconciliations',
  // Запросы оплаты (DATA_MODEL §24, ADR-143): политика — в миграции 20261003000045_payment_requests
  'payment_requests',
  // Фискальные чеки по запросу (DATA_MODEL §26): политика — в миграции 20261003000047_fiscal_receipts
  'fiscal_receipts',
  // Намерения брони ИИ-продавца (DATA_MODEL §25): политика — в миграции 20261003000046_seller_booking_intents
  'seller_booking_intents',
  // Загрузка конкурентов (DATA_MODEL §23): политики в миграции 20261003000044_competitor_occupancy
  'competitors',
  'competitor_occupancy',
];

/**
 * Таблицы без RLS — осознанно (§17.3): их читает служебный путь, а стойке они отдаются через API. `users` — чтобы
 * показывать имена авторов журнала и коллег; почты чужих организаций API наружу не отдаёт.
 */
export const RLS_NO_TENANT_TABLES: readonly string[] = [
  'users',
  'password_resets',
  'email_verifications',
  'platform_admins',
  'wizard_sessions',
  'wizard_surveys',
  'wizard_events',
  'external_events',
  'channel_outbox',
  'system_incidents',
];

/** Кто делает запрос: организация — строка uuid; служебный путь — `null` */
export type TenantOf = () => string | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TaggedClient = pg.PoolClient & { wetopOrg?: string };

/**
 * Поставить соединению переменную организации, если она не та, что уже стоит. Переменная сессионная
 * (`set_config(..., false)`): пулер Supabase в режиме сессий держит соединение за этим клиентом, и она живёт до
 * следующей выдачи. Пустая строка — ни одной строки у `wetop_app`.
 */
export async function applyTenant(
  client: TaggedClient,
  organizationId: string | null,
): Promise<void> {
  const value = organizationId && UUID.test(organizationId) ? organizationId : '';
  if (client.wetopOrg === value) return;
  await client.query(`SELECT set_config('app.org_id', $1, false)`, [value]);
  client.wetopOrg = value;
}

/**
 * Пул, который Prisma видит как один: запрос организации идёт в пул `wetop_app` с её переменной, служебный — в
 * служебный пул. Адаптер `@prisma/adapter-pg` зовёт `query` для одиночных запросов и `connect` для транзакций —
 * оба пути здесь. Организация берётся в момент выдачи соединения: транзакция целиком идёт от одной организации.
 */
export class TenantPool extends pg.Pool {
  constructor(
    private readonly service: pg.Pool,
    private readonly app: pg.Pool,
    private readonly tenantOf: TenantOf,
  ) {
    // Сам этот пул соединений не открывает: он только раздаёт соединения двух настоящих
    super({ max: 1 });
  }

  /** Какой пул и какая организация у текущего запроса */
  private route(): { pool: pg.Pool; organizationId: string | null } {
    const organizationId = this.tenantOf();
    return organizationId
      ? { pool: this.app, organizationId }
      : { pool: this.service, organizationId: null };
  }

  private async checkout(): Promise<pg.PoolClient> {
    const { pool, organizationId } = this.route();
    const client = (await pool.connect()) as TaggedClient;
    try {
      // Служебному соединению переменная тоже ставится пустой: если оба пула — одна роль (до переключения),
      // соединение не унесёт организацию прошлого запроса
      await applyTenant(client, organizationId);
    } catch (e) {
      client.release(e as Error);
      throw e;
    }
    return client;
  }

  // Перегрузки pg.Pool: адаптер Prisma пользуется только формой с промисом
  override connect(): Promise<pg.PoolClient>;
  override connect(
    callback: (
      err: Error | undefined,
      client: pg.PoolClient | undefined,
      done: (release?: unknown) => void,
    ) => void,
  ): void;
  override connect(
    callback?: (
      err: Error | undefined,
      client: pg.PoolClient | undefined,
      done: (release?: unknown) => void,
    ) => void,
  ): Promise<pg.PoolClient> | void {
    const promise = this.checkout();
    if (!callback) return promise;
    promise.then(
      (client) =>
        callback(undefined, client, (release?: unknown) => client.release(release as Error)),
      (err: Error) => callback(err, undefined, () => undefined),
    );
  }

  override query(...args: unknown[]): never {
    // Форма с колбэком адаптеру не нужна — только промис
    const run = async () => {
      const client = await this.checkout();
      try {
        return await (client.query as (...a: unknown[]) => Promise<unknown>)(...args);
      } finally {
        client.release();
      }
    };
    return run() as never;
  }

  override async end(): Promise<void> {
    await Promise.all([this.service.end(), this.app === this.service ? undefined : this.app.end()]);
  }
}
