import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it('local-db start does not add a second set of stays to the populated test schema', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wetop-local-db-start-'));
  const bin = join(dir, 'bin');
  const data = join(dir, 'data');
  mkdirSync(bin);
  mkdirSync(data);
  writeFileSync(join(data, 'PG_VERSION'), '16');
  const executable = (name: string, body: string) =>
    writeFileSync(join(bin, name), `#!/bin/sh\nset -eu\n${body}\n`, { mode: 0o755 });
  // The database is already running; orchestration is real, database processes are stubs.
  executable('pg_ctl', 'exit 0');
  executable('id', 'echo 1000');
  executable('psql', 'echo 1');
  executable('npm', `case "$*" in *test:schema*) touch "$AUDIT_DIR/test-schema-populated";; esac`);
  executable('npx', [
    'if [ "${DATABASE_SCHEMA:-}" = pms_test ] && [ -f "$AUDIT_DIR/test-schema-populated" ]; then',
    '  echo "23P01: second seed overlaps existing stays" >&2',
    '  exit 1',
    'fi',
    'echo "${DATABASE_SCHEMA:-public}" >> "$AUDIT_DIR/seeded-schemas"',
  ].join('\n'));
  try {
    const result = spawnSync('bash', [resolve('scripts/ops/local-db.sh'), 'start'], {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        PMS_LOCAL_PGDATA: data,
        PMS_LOCAL_PGPORT: '55442',
        AUDIT_DIR: dir,
      },
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readFileSync(join(dir, 'seeded-schemas'), 'utf8').trim()).toBe('public');
    expect(readFileSync(join(dir, 'test-schema-populated'), 'utf8')).toBe('');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
