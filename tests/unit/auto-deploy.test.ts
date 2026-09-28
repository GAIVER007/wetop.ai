/**
 * Автовыкладка стойки (`scripts/ops/auto-deploy.sh`, ADR-080, docs/deploy.md §1д).
 *
 * Скрипт исполняется по-настоящему: временный «GitHub» (голый репозиторий), клон «сервера» и подставной `docker`,
 * который записывает вызовы и отвечает на проверки живости. Держит то, что на боевой машине обнаружилось бы
 * поздно: выкладку миграции без владельца, затёртые локальные правки, выкладку поверх переписанной истории,
 * падение без отката и повторную тревогу раз в две минуты.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve(import.meta.dirname, '../../scripts/ops/auto-deploy.sh');
const TOKEN = 'tg-secret-token-123';

let dir: string;
let origin: string;
let server: string;
let dev: string;
let bin: string;
let state: string;
let calls: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function commit(file: string, text: string, message: string, force = false) {
  mkdirSync(join(dev, file, '..'), { recursive: true });
  writeFileSync(join(dev, file), text);
  git(dev, 'add', file);
  git(dev, 'commit', '-qm', message);
  git(dev, 'push', '-q', ...(force ? ['-f'] : []), 'origin', 'HEAD:release');
  return git(dev, 'rev-parse', 'HEAD');
}

function run(env: Record<string, string> = {}, args: string[] = []) {
  const r = spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      DEPLOY_REPO: server,
      DEPLOY_STATE_DIR: state,
      DEPLOY_HEALTH_WAIT: '2',
      DEPLOY_HEALTH_STEP: '1',
      FAKE_CALLS: calls,
      TELEGRAM_BOT_TOKEN: TOKEN,
      TELEGRAM_CHAT_ID: '-100',
      ...env,
    },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const dockerCalls = () => (existsSync(calls) ? readFileSync(calls, 'utf8') : '');
const head = () => git(server, 'rev-parse', 'HEAD');

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'auto-deploy-'));
  origin = join(dir, 'origin.git');
  server = join(dir, 'server');
  dev = join(dir, 'dev');
  bin = join(dir, 'bin');
  state = join(dir, 'state');
  calls = join(dir, 'calls.log');
  mkdirSync(bin);
  git(dir, 'init', '-q', '--bare', origin);
  git(dir, 'clone', '-q', origin, dev);
  git(dev, 'config', 'user.email', 't@example.test');
  git(dev, 'config', 'user.name', 'test');
  commit('deploy/compose.yml', 'services: {}\n', 'init');
  commit('packages/database/prisma/migrations/0001_init/migration.sql', 'select 1;\n', 'first migration');
  git(dir, 'clone', '-q', '--branch', 'release', origin, server);
  // Подставной docker: пишет вызовы; «больна» сборка, когда в клоне стоит коммит из FAKE_BAD_SHA
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env bash
echo "docker $*" >> "$FAKE_CALLS"
if [ "$1" = compose ] && [[ " $* " == *" exec "* ]]; then
  [ -n "\${FAKE_BAD_SHA:-}" ] && [ "$(git -C "$DEPLOY_REPO" rev-parse HEAD)" = "$FAKE_BAD_SHA" ] && exit 1
  [[ " $* " == *" api "* ]] && echo '{"status":"ok","database":"up"}'
fi
exit 0
`,
  );
  // Подставной curl: Telegram «принимает», вызов записывается — с токеном, чтобы проверить, что в журнал он не идёт
  // Настройки из stdin (`--config -`) пишутся отдельно: так видно, что токен не в аргументах, которые видны в `ps`
  writeFileSync(
    join(bin, 'curl'),
    '#!/usr/bin/env bash\necho "curl $*" >> "$FAKE_CALLS.curl"\n' +
      'if [[ " $* " == *" --config - "* ]]; then cat >> "$FAKE_CALLS.curl.stdin"; fi\nexit 0\n',
  );
  // auto-deploy runs on Linux, where util-linux provides flock. The test suite also runs on macOS,
  // so keep the server dependency inside the fake PATH instead of silently skipping every scenario.
  writeFileSync(join(bin, 'flock'), '#!/usr/bin/env bash\nexit 0\n');
  chmodSync(join(bin, 'docker'), 0o755);
  chmodSync(join(bin, 'curl'), 0o755);
  chmodSync(join(bin, 'flock'), 0o755);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('scripts/ops/auto-deploy.sh', () => {
  it('ветка не ушла вперёд — ничего не делает и молчит', () => {
    const r = run();
    expect(r.code).toBe(0);
    expect(r.out).toBe('');
    expect(dockerCalls()).toBe('');
  });

  it('новый коммит без миграций — выкладывает, проверяет и сообщает, токен в журнал не попадает', () => {
    const before = head();
    const target = commit('apps/web/page.txt', 'v2\n', 'new page');
    const r = run();
    expect(r.code, r.out).toBe(0);
    expect(head()).toBe(target);
    expect(dockerCalls()).toContain(`docker image tag pms-lux:latest pms-lux:rollback-${before.slice(0, 8)}`);
    expect(dockerCalls()).toMatch(/docker compose -f deploy\/compose\.yml up -d --build api web/);
    expect(dockerCalls()).toContain('exec -T api wget');
    expect(readFileSync(join(state, 'deployed'), 'utf8').trim()).toBe(target);
    expect(r.out).toContain(`${target.slice(0, 8)} выложен`);
    expect(readFileSync(`${calls}.curl.stdin`, 'utf8')).toContain('sendMessage');
    expect(r.out).not.toContain(TOKEN);
    // Аудит 25.09, С-15: токен бота был частью адреса в аргументах curl — его видел любой процесс через `ps`
    expect(readFileSync(`${calls}.curl`, 'utf8')).not.toContain(TOKEN);
    // второй запуск — выкладывать нечего
    expect(run().out).toBe('');
  });

  it('в обновлении миграция — не выкладывает, говорит один раз и ждёт владельца', () => {
    const before = head();
    commit('packages/database/prisma/migrations/0002_more/migration.sql', 'select 2;\n', 'migration');
    const r = run();
    expect(r.code).toBe(1);
    expect(r.out).toContain('миграции');
    expect(r.out).toContain('0002_more');
    // подсказка называет сам скрипт, а не временную копию, с которой он перезапускается (25.09: «/tmp/tmp.… --migrations-applied»)
    expect(r.out).toContain(`${SCRIPT} --migrations-applied`);
    expect(head()).toBe(before);
    expect(dockerCalls()).not.toContain('up -d');
    // тот же коммит — повторной тревоги нет
    const again = run();
    expect(again.code).toBe(0);
    expect(again.out).toBe('');
  });

  it('владелец применил миграции и назвал вершину — выкладывает ровно её', () => {
    const target = commit('packages/database/prisma/migrations/0002_more/migration.sql', 'select 2;\n', 'migration');
    const refusal = run();
    expect(refusal.code).toBe(1);
    // подсказка называет точную вершину — её владелец и передаёт
    expect(refusal.out).toContain(`--migrations-applied ${target.slice(0, 8)}`);
    const r = run({}, ['--migrations-applied', target.slice(0, 8)]);
    expect(r.code, r.out).toBe(0);
    expect(head()).toBe(target);
    expect(dockerCalls()).toMatch(/up -d --build api web/);
    // флаг — только на этот запуск: следующая миграция снова ждёт владельца
    commit('packages/database/prisma/migrations/0003_next/migration.sql', 'select 3;\n', 'next migration');
    const next = run();
    expect(next.code).toBe(1);
    expect(next.out).toContain('0003_next');
  });

  // Проверка исправлений 26.09: отказ на A, release ушёл на B, cron отказал и B; флаг без вершины не должен выложить B
  it('флаг без вершины не принимается и тогда, когда cron уже отказал следующей вершине', () => {
    commit('packages/database/prisma/migrations/0002_more/migration.sql', 'select 2;\n', 'migration');
    const before = head();
    expect(run().code).toBe(1);
    commit('packages/database/prisma/migrations/0003_next/migration.sql', 'select 3;\n', 'next migration');
    expect(run().code).toBe(1);
    const r = run({}, ['--migrations-applied']);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('вершин');
    expect(head()).toBe(before);
    expect(dockerCalls()).not.toContain('up -d');
  });

  // ТЗ аудита 25.09.2026, С-1: флаг без вершины разрешал бы ту вершину, что стоит СЕЙЧАС, а не ту,
  // чьи миграции применял владелец, — release могли перемотать между отказом и запуском
  it('--migrations-applied без вершины — отказ с подсказкой, ничего не выложено', () => {
    commit('packages/database/prisma/migrations/0002_more/migration.sql', 'select 2;\n', 'migration');
    expect(run().code).toBe(1);
    const before = head();
    const r = run({}, ['--migrations-applied']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('вершин');
    expect(head()).toBe(before);
    expect(dockerCalls()).not.toContain('up -d');
  });

  it('--migrations-applied с номером вершины выкладывает ровно её, другую — нет', () => {
    const target = commit('packages/database/prisma/migrations/0002_more/migration.sql', 'select 2;\n', 'migration');
    expect(run().code).toBe(1);
    expect(run({}, ['--migrations-applied', 'deadbeef']).code).not.toBe(0);
    const r = run({}, ['--migrations-applied', target.slice(0, 8)]);
    expect(r.code, r.out).toBe(0);
    expect(head()).toBe(target);
  });

  // Аудит 26.09, С-67: клон переключался на новую вершину до сборки. Прерванный запуск (нехватка памяти, перезагрузка)
  // оставлял клон на новой вершине с прежними контейнерами, и следующий запуск молча считал всё выложенным.
  it('прерванная выкладка: клон уже на новой вершине, но она не выложена — следующий запуск выкладывает', () => {
    expect(run().code).toBe(0); // первый запуск запоминает выложенное
    const target = commit('apps/web/page.txt', 'v2\n', 'new page');
    git(server, 'fetch', '-q', 'origin', 'release');
    git(server, 'checkout', '-q', '-B', 'release', target);
    const r = run();
    expect(r.code, r.out).toBe(0);
    expect(dockerCalls()).toMatch(/up -d --build api web/);
    expect(readFileSync(join(state, 'deployed'), 'utf8').trim()).toBe(target);
  });

  it('release перемотали после отказа — флаг со старой вершиной не выкладывает новую', () => {
    const applied = commit('packages/database/prisma/migrations/0002_more/migration.sql', 'select 2;\n', 'migration');
    expect(run().code).toBe(1);
    // пока владелец применял миграции, в release уехала ещё одна вершина с новой миграцией
    const moved = commit('packages/database/prisma/migrations/0003_next/migration.sql', 'select 3;\n', 'next migration');
    const before = head();
    const r = run({}, ['--migrations-applied', applied.slice(0, 8)]);
    expect(r.code).toBe(2);
    expect(r.out).toContain('не совпадает');
    expect(r.out).toContain(moved.slice(0, 8));
    expect(head()).toBe(before);
    expect(dockerCalls()).not.toContain('up -d');
    // с вершиной, которая стоит в release сейчас, — выкладывает
    const ok = run({}, ['--migrations-applied', moved]);
    expect(ok.code, ok.out).toBe(0);
    expect(head()).toBe(moved);
  });

  it('локальные правки в клоне — не затирает их', () => {
    writeFileSync(join(server, 'deploy/compose.yml'), 'services: {local: {}}\n');
    commit('apps/web/page.txt', 'v2\n', 'new page');
    const r = run();
    expect(r.code).toBe(1);
    expect(r.out).toContain('локальные правки');
    expect(readFileSync(join(server, 'deploy/compose.yml'), 'utf8')).toContain('local');
    expect(dockerCalls()).not.toContain('up -d');
  });

  it('историю ветки переписали — не выкладывает поверх', () => {
    commit('apps/web/page.txt', 'v2\n', 'v2');
    expect(run().code).toBe(0);
    git(dev, 'reset', '-q', '--hard', 'HEAD~1');
    commit('apps/web/other.txt', 'x\n', 'rewritten', true);
    const before = head();
    const r = run();
    expect(r.code).toBe(1);
    expect(r.out).toContain('история переписана');
    expect(head()).toBe(before);
  });

  it('после сборки не отвечает — возвращает прежний коммит и прежний образ', () => {
    const before = head();
    const target = commit('apps/web/page.txt', 'broken\n', 'broken');
    const r = run({ FAKE_BAD_SHA: target });
    expect(r.code).toBe(1);
    expect(head()).toBe(before);
    expect(dockerCalls()).toContain(`docker image tag pms-lux:rollback-${before.slice(0, 8)} pms-lux:latest`);
    expect(r.out).toContain(`возвращён ${before.slice(0, 8)}`);
    // сломанный коммит не пробует снова каждые две минуты
    expect(run({ FAKE_BAD_SHA: target }).out).toBe('');
  });
});
