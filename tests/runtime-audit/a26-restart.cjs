// Перезапуск настоящего API для A26 (tests/integration/auth-timezone-matrix-a26.test.ts вызывает его по
// `${A28_WORK_DIR}/a26-restart.cjs`): пояс процесса из A26_NODE_TZ, штатные роли, AUTH_REQUIRED=1, тот же preload
// с доказательством сетевой изоляции. Копирует сюда scripts/ci/runtime-audit.sh.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const work = process.env.A28_WORK_DIR || __dirname;
const root = process.env.AUDIT_REPO_ROOT;
if (!root) throw new Error('AUDIT_REPO_ROOT не задан');
const port = Number(process.env.AUDIT_PG_PORT || '55601');
const database = process.env.A28_PG_DATABASE || 'pmslocal';
const pidFile = path.join(work, 'a26-api.pid');

try {
  const previous = Number(fs.readFileSync(pidFile, 'utf8'));
  if (previous) process.kill(-previous, 'SIGTERM');
} catch {
  // первого запуска ещё не было
}
const stopped = Date.now() + 10_000;
while (Date.now() < stopped) {
  try {
    process.kill(-Number(fs.readFileSync(pidFile, 'utf8')), 0);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  } catch {
    break;
  }
}

const log = fs.openSync(path.join(work, 'a26-api.log'), 'a', 0o600);
const child = spawn('npm', ['run', 'start', '-w', 'apps/api'], {
  cwd: root,
  detached: true,
  stdio: ['ignore', log, log],
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    TZ: process.env.A26_NODE_TZ || 'UTC',
    NODE_OPTIONS: `--require=${path.join(root, 'tests/runtime-audit/api-network-proof.cjs')}`,
    AUDIT_EVIDENCE_DIR: process.env.AUDIT_EVIDENCE_DIR,
    AUDIT_PG_PORT: String(port),
    LANG: 'C',
    LC_ALL: 'C',
    CI: '1',
    NODE_ENV: 'test',
    DATABASE_URL: `postgresql://wetop_service@127.0.0.1:${port}/${database}`,
    DATABASE_APP_URL: `postgresql://wetop_app@127.0.0.1:${port}/${database}`,
    DATABASE_SCHEMA: 'pms_test',
    DATABASE_POOL_MAX: '2',
    DATABASE_APP_POOL_MAX: '2',
    API_HOST: '127.0.0.1',
    API_PORT: '4427',
    AUTH_REQUIRED: '1',
    CHANNEX_OUTBOX_WORKER: 'off',
    CHANNEX_FULL_SYNC: 'off',
    CHANNEX_PULL: 'off',
    GUARD: 'off',
    SELLER_SYNC: 'off',
    SITE_GENERATION_WORKER: 'off',
    USER_ERRORS_RETENTION: 'off',
    WIZARD_RETENTION: 'off',
    ANALYTICS_RETENTION: 'off',
  },
});
fs.writeFileSync(pidFile, String(child.pid), { mode: 0o600 });
child.unref();
