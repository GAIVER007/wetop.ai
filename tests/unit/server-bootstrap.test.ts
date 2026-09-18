/**
 * `deploy/server-bootstrap.sh` — первичная настройка сервера одной командой (plans/server-kz-2026-09-17.md,
 * `docs/ops/server-setup-2026-09-18.md` §2). Владелец не должен вбивать дюжину команд руками; ему остаётся
 * создать сервер в панели, запустить скрипт и вставить вывод.
 *
 * Тест гоняет скрипт по-настоящему: заводит системного пользователя, генерирует ключ, клонирует репозиторий
 * из локальной «голой» копии, стоящей вместо GitHub. Поэтому идёт только от root на Linux (контейнер агента,
 * чистый сервер); на Mac и на раннере CI без root пропускается. Пользователь удаляется после теста.
 * Docker-часть пропускается флагом `--skip-docker` — демона здесь нет, она доказывается на сервере.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const SCRIPT = join(ROOT, 'deploy/server-bootstrap.sh');
const asRoot = process.platform === 'linux' && process.getuid?.() === 0;

const USER = `pmsbs${String(Date.now()).slice(-6)}`;
const HOME = `/home/${USER}`;
let bare = '';
let branch = '';

function run(extraEnv: Record<string, string>, args: string[] = []) {
  const res = spawnSync('bash', [SCRIPT, '--skip-docker', ...args], {
    encoding: 'utf8',
    env: { ...process.env, PMS_USER: USER, ...extraEnv },
    timeout: 120_000,
  });
  return { code: res.status ?? -1, out: res.stdout + res.stderr };
}

describe.skipIf(!asRoot)('deploy/server-bootstrap.sh (root, Linux)', () => {
  beforeAll(() => {
    const dir = mkdtempSync(join(tmpdir(), 'bootstrap-'));
    // mkdtemp даёт 0700 от root: пользователь системы не смог бы даже войти в каталог с голой копией
    chmodSync(dir, 0o755);
    bare = join(dir, 'wetop.git');
    // «GitHub» на этой машине: голая копия текущего репозитория со всеми ветками
    spawnSync('git', ['clone', '--bare', '--quiet', ROOT, bare]);
    branch = spawnSync('git', ['-C', ROOT, 'branch', '--show-current'], { encoding: 'utf8' }).stdout.trim();
  });
  afterAll(() => {
    spawnSync('deluser', ['--remove-home', USER], { stdio: 'ignore' });
    if (bare) rmSync(resolve(bare, '..'), { recursive: true, force: true });
  });

  // Установка пакетов — секунды; срок теста по умолчанию 5 с
  const SLOW = { timeout: 120_000 };

  it('репозиторий недоступен: печатает публичный ключ, просит добавить его в GitHub и выходит с кодом 3', SLOW, () => {
    const r = run({ REPO_URL: 'file:///nonexistent/wetop.git' }, ['--branch', branch]);
    expect(r.code, r.out).toBe(3);
    expect(r.out).toContain('ssh-ed25519');
    expect(r.out).toMatch(/Deploy key/i);
    // Пользователь и ключ уже заведены — второй запуск их не пересоздаёт
    expect(existsSync(`${HOME}/.ssh/wetop-deploy.pub`)).toBe(true);
    expect(readFileSync(`${HOME}/.ssh/config`, 'utf8')).toContain('Host github.com');
  });

  it('репозиторий доступен: клонирует нужную ветку, заводит папку туннеля и говорит, что дальше', SLOW, () => {
    // Голая копия лежит в каталоге root, а git пользователя отказывает чужому владельцу («dubious ownership»).
    // Это особенность стенда: на сервере адрес — ssh к GitHub. Пользователь уже заведён первым запуском.
    spawnSync('chown', ['-R', USER, bare]);
    const r = run({ REPO_URL: `file://${bare}` }, ['--branch', branch]);
    expect(r.code, r.out).toBe(0);
    expect(existsSync(`${HOME}/wetop/package.json`)).toBe(true);
    // Клон принадлежит пользователю системы; git от root в чужом каталоге молчит («dubious ownership»),
    // поэтому ветку спрашиваем от имени владельца — так же, как ей будут пользоваться на сервере
    const head = spawnSync(
      'runuser',
      ['-u', USER, '--', 'git', '-C', `${HOME}/wetop`, 'branch', '--show-current'],
      { encoding: 'utf8' },
    );
    expect(head.stdout.trim(), head.stderr).toBe(branch);
    expect(existsSync(`${HOME}/wetop/deploy/cloudflared`)).toBe(true);
    expect(r.out).toContain('deploy/.env');
    // Ключ и клон принадлежат пользователю системы, не root
    const owner = spawnSync('stat', ['-c', '%U', `${HOME}/wetop`], { encoding: 'utf8' }).stdout.trim();
    expect(owner).toBe(USER);
  });

  it('повторный запуск ничего не ломает и не дублирует', SLOW, () => {
    const before = readFileSync(`${HOME}/.ssh/config`, 'utf8');
    const r = run({ REPO_URL: `file://${bare}` }, ['--branch', branch]);
    expect(r.code, r.out).toBe(0);
    expect(readFileSync(`${HOME}/.ssh/config`, 'utf8')).toBe(before);
    expect(r.out).toMatch(/уже/);
  });
});
