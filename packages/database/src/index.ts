/**
 * @pms/database — PrismaClient по утверждённому DATA_MODEL.md.
 * Сгенерированный клиент лежит в ./generated (в git не попадает, создаётся `prisma generate`).
 * Строка подключения читается программой при запуске из окружения, не агентом (SECURITY.md).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient, type Prisma } from './generated/prisma/client';
import { databasePoolTimeouts } from './pool';
import { TenantPool, type TenantOf } from './rls';
import { resolveDatabaseSchema } from './schema';

export * from './generated/prisma/client';
export { databaseSchemaName, resolveDatabaseSchema } from './schema';
export { DATABASE_POOL_DEFAULTS, databasePoolTimeouts } from './pool';
export { RLS_NO_TENANT_TABLES, RLS_TENANT_TABLES, TenantPool, applyTenant, type TenantOf } from './rls';
export { assertRlsAtStartup, rlsRoleProblem, type RlsProbe } from './rls-startup';
export { NEW_PROPERTY_DEFAULTS, createPropertyInChain, type PropertyInChainData } from './property-chain';

/** Размер пула: `DATABASE_POOL_MAX` для основного, `DATABASE_APP_POOL_MAX` для роли организации (RLS) */
function poolMax(value: string | undefined, fallback: number): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function createPrismaClient(
  connectionString = process.env.DATABASE_URL,
  // ADR-042: автотесты работают в схеме pms_test того же проекта, рабочие данные — в public
  schema = resolveDatabaseSchema(process.env.DATABASE_SCHEMA),
  /**
   * Row Level Security (DATA_MODEL §17, ADR-103): кто делает запрос. Задан — запросы организации идут ролью
   * `wetop_app` (`DATABASE_APP_URL`) с переменной `app.org_id`, остальные — по `connectionString`. Нет
   * `DATABASE_APP_URL` — обе дороги ведут в один пул прежней роли: поведение как до RLS.
   */
  tenant?: { of: TenantOf; appConnectionString?: string | undefined },
): PrismaClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const config = (url: string, max: number): pg.PoolConfig => ({
    connectionString: url,
    max,
    // ADR-043: подключение, место в пуле и ответ базы ограничены сроком — мёртвое соединение не вешает процесс
    ...databasePoolTimeouts(process.env),
    // Опция schema ниже меняет только SQL, который строит Prisma; прямой SQL ($queryRaw) идёт по search_path соединения.
    // Параметр при подключении Session pooler Supabase пропускает (проверено 14.09.2026) — схема действует с первого запроса.
    ...(schema ? { options: `-c search_path=${schema},public` } : {}),
  });
  // Supabase Session pooler допускает 15 клиентов на проект: пул каждого процесса ограничен
  // (DATABASE_POOL_MAX, по умолчанию 5), а в API один клиент на процесс (apps/api PrismaService).
  const max = poolMax(process.env.DATABASE_POOL_MAX, 5);
  const options = schema ? { schema, disposeExternalPool: true } : { disposeExternalPool: true };
  let adapter: PrismaPg;
  if (tenant) {
    const service = new pg.Pool(config(connectionString, max));
    const appUrl = tenant.appConnectionString?.trim();
    // С RLS соединений два пула: служебных и организации. Их сумма держится в потолке пулера (§17.2)
    const app = appUrl ? new pg.Pool(config(appUrl, poolMax(process.env.DATABASE_APP_POOL_MAX, 5))) : service;
    adapter = new PrismaPg(new TenantPool(service, app, tenant.of), options);
  } else {
    adapter = new PrismaPg(config(connectionString, max), schema ? { schema } : undefined);
  }
  // SECURITY.md §7: без аргументов вызова в тексте ошибки — заметка брони или имя гостя не уедут в last_error и журнал
  return new PrismaClient({ adapter, errorFormat: 'minimal' });
}

export type Db = PrismaClient;

/** Клиент внутри `db.$transaction(async (tx) => …)`. Импортёры принимают именно его. */
export type DbTx = Prisma.TransactionClient;

/**
 * Овербукинг остановила БАЗА (exclusion constraint `allocations_no_overlap_per_unit`, миграция
 * 20260909000003). Prisma 7 + adapter-pg оборачивают PostgreSQL 23P01 в P2039 с исходным кодом
 * внутри meta.driverAdapterError.cause. Домен и API опираются на эту проверку, а не на текст сообщения.
 */
export function isOverlapViolation(e: unknown): boolean {
  const err = e as {
    code?: string;
    meta?: { driverAdapterError?: { cause?: { code?: string; originalCode?: string } } };
  };
  const cause = err?.meta?.driverAdapterError?.cause;
  return cause?.code === '23P01' || cause?.originalCode === '23P01';
}

export {
  ensureFolioWithAccommodation,
  ensureSingleActiveCharge,
  recordExternalPayment,
} from './folio';
