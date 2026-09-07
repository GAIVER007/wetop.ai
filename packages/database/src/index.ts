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
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export type Db = PrismaClient;

/** Клиент внутри `db.$transaction(async (tx) => …)`. Импортёры принимают именно его. */
export type DbTx = Prisma.TransactionClient;
