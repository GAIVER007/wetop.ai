import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

/**
 * `db:local` накатывает миграции через `prisma migrate deploy`, а `packages/database/prisma.config.ts` выбирает
 * адрес так: DIRECT_URL, если задан, иначе DATABASE_URL — и дочитывает оба из .env корня, не перетирая уже
 * заданные. Скрипт задавал только DATABASE_URL, поэтому DIRECT_URL из .env (прямой адрес рабочей базы)
 * перебивал локальную, и миграции молча — вывод уходит в /dev/null — накатывались на рабочую базу
 * (проверка по SECURITY.md, 24.09.2026). Заглушка npm повторяет это правило выбора адреса.
 */
it('local-db start migrates the local database even when .env carries DIRECT_URL', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wetop-local-db-migrate-'));
  const bin = join(dir, 'bin');
  const data = join(dir, 'data');
  mkdirSync(bin);
  mkdirSync(data);
  writeFileSync(join(data, 'PG_VERSION'), '16');
  const executable = (name: string, body: string) =>
    writeFileSync(join(bin, name), `#!/bin/sh\nset -eu\n${body}\n`, { mode: 0o755 });
  // База уже запущена; настоящий здесь только скрипт, процессы базы и npm — заглушки
  executable('pg_ctl', 'exit 0');
  executable('id', 'echo 1000');
  executable('psql', 'echo 1');
  executable('npx', 'exit 0');
  // Как prisma.config.ts: DIRECT_URL из окружения, иначе из .env (DOTENV_DIRECT_URL), иначе DATABASE_URL
  executable('npm', [
    'case "$*" in',
    '  *migrate:deploy*) echo "${DIRECT_URL:-${DOTENV_DIRECT_URL:-${DATABASE_URL:-}}}" > "$AUDIT_DIR/migrate-target";;',
    'esac',
  ].join('\n'));
  const inherited = { ...process.env };
  delete inherited.DIRECT_URL;
  delete inherited.DATABASE_URL;
  try {
    const result = spawnSync('bash', [resolve('scripts/ops/local-db.sh'), 'start'], {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...inherited,
        PATH: `${bin}:${process.env.PATH}`,
        PMS_LOCAL_PGDATA: data,
        PMS_LOCAL_PGPORT: '55443',
        AUDIT_DIR: dir,
        DOTENV_DIRECT_URL: 'postgresql://owner@db.example.invalid:5432/postgres',
      },
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readFileSync(join(dir, 'migrate-target'), 'utf8').trim()).toBe(
      'postgresql://postgres@127.0.0.1:55443/pmslocal',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 15_000); // The child has its own 10 s bound; report its result before the runner times out.
