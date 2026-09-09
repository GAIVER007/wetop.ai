/**
 * @pms/database — PrismaClient по утверждённому DATA_MODEL.md.
 * Сгенерированный клиент лежит в ./generated (в git не попадает, создаётся `prisma generate`).
 * Строка подключения читается программой при запуске из окружения, не агентом (SECURITY.md).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from './generated/prisma/client';

export * from './generated/prisma/client';

export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  // Supabase Session pooler допускает 15 клиентов на проект: пул каждого процесса ограничен
  // (DATABASE_POOL_MAX, по умолчанию 5), а в API один клиент на процесс (apps/api PrismaService).
  const max = Number(process.env.DATABASE_POOL_MAX ?? 5);
  const adapter = new PrismaPg({
    connectionString,
    max: Number.isFinite(max) && max > 0 ? max : 5,
  });
  return new PrismaClient({ adapter });
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
