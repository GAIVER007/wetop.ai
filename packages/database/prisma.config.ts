// Конфигурация Prisma 7: строка подключения живёт ТОЛЬКО в .env корня репозитория.
// Для миграций нужен прямой доступ (порт 5432): DIRECT_URL, если задан, иначе DATABASE_URL.
// Транзакционный пул (порт 6543) для миграций не подходит (документация Prisma, PgBouncer).
import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../.env'), quiet: true });

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL (или DIRECT_URL) не задан в .env. Значение вписывает владелец, агенту не диктуется (SECURITY.md §3).',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url },
});
