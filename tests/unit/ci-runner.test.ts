/**
 * Проверки GitHub Actions и свой раннер (`scripts/ops/ci-runner`, разбор 21.09.2026).
 *
 * Держит то, что ломается молча и обнаруживается через неделю:
 *  1. раннеру дали сокет Docker — код из любой ветки получает root на машине, где рядом чужие проекты
 *     и боевая PMS;
 *  2. проверки вернулись на боевой сервер: 03.10.2026 свой раннер там (2 ядра на всё) поднимал нагрузку до
 *     85 и ронял стойку, UI не помещался вовсе (ADR-139). Все проверки идут на раннерах GitHub, один раз на
 *     кандидата в выкладку (release-checks.yml), иначе 2000 бесплатных минут кончаются за неделю (21.09.2026);
 *  3. задача с базой уехала на свой раннер, где нет Docker для `services: postgres`, и падает не по делу;
 *  4. раннер взял задачу из запроса на слияние из чужого форка (ADR-137, замечание ментора 02.10.2026):
 *     защищает хук перед задачей в образе раннера; образ остаётся на случай отдельной машины под раннер;
 *  5. тесты бота выпали из проверок, и их красноту снова никто не видит (ADR-137).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const WORKFLOW_DIR = '.github/workflows';
/** Все файлы проверок: имя → текст */
const WORKFLOWS = Object.fromEntries(
  readdirSync(join(ROOT, WORKFLOW_DIR))
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => [f, read(`${WORKFLOW_DIR}/${f}`)]),
);
const RELEASE = WORKFLOWS['release-checks.yml'] ?? '';
const COMPOSE = read('scripts/ops/ci-runner/compose.yml');
const RUNNER_IMAGE = read('scripts/ops/ci-runner/Dockerfile');
const HOOK = join(ROOT, 'scripts/ops/ci-runner/job-started.sh');

/** Только то, что исполняется: в пояснениях те же слова стоят намеренно. */
const withoutComments = (text: string): string =>
  text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

/** Кусок файла от заголовка задачи до следующей задачи того же уровня */
function job(name: string, text = RELEASE): string {
  const start = text.indexOf(`\n  ${name}:\n`);
  expect(start, `задача ${name} не найдена`).toBeGreaterThan(-1);
  const rest = text.slice(start + 1);
  const next = rest.search(/\n {2}[a-z][a-z-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next);
}


describe('свой раннер CI', () => {
  it('раннеру не дают сокет Docker: это был бы root на машине с чужими проектами', () => {
    const run = withoutComments(COMPOSE);
    expect(run).not.toContain('docker.sock');
    expect(run).not.toContain('privileged');
  });

  it('потолки памяти и процессора заданы: браузерные проверки не душат боевую стойку', () => {
    const run = withoutComments(COMPOSE);
    expect(run).toMatch(/mem_limit:/);
    expect(run).toMatch(/cpus:/);
  });

  it('ни одна проверка не идёт на боевой сервер и ни одна не запускается на каждый пуш (ADR-139)', () => {
    for (const [file, text] of Object.entries(WORKFLOWS)) {
      const run = withoutComments(text);
      // свой раннер на боевом сервере 03.10.2026 поднимал нагрузку до 85 и ронял стойку
      expect(run, file).not.toContain('self-hosted');
      // на каждый пуш и PR бесплатных минут GitHub хватало на неделю (21.09.2026)
      const on = /\non:\n([\s\S]*?)\n(?=\S)/.exec(run)?.[1] ?? '';
      expect(on, file).not.toMatch(/pull_request/);
      expect(on, file).not.toMatch(/branches: \[[^\]]*\bmain\b/);
    }
  });

  it('перед выкладкой: lint, typecheck, unit, главная, бот, база и весь UI; по кнопке или пушем в release-candidate', () => {
    expect(RELEASE, '.github/workflows/release-checks.yml').not.toBe('');
    const triggers = withoutComments(/\non:\n([\s\S]*?)\n(?=\S)/.exec(RELEASE)?.[1] ?? '');
    expect(triggers).toContain('workflow_dispatch:');
    expect(triggers).toMatch(/push:\n\s+branches: \[release-candidate\]/);
    for (const name of ['fast', 'bot', 'db', 'ui-shard', 'ui'])
      expect(job(name), name).toMatch(/runs-on: ubuntu-24\.04/);
    const fast = withoutComments(job('fast'));
    for (const step of ['npm run lint', 'npm run typecheck', 'vitest run --project unit', 'npm run site:check'])
      expect(fast, step).toContain(step);
    expect(withoutComments(job('ui-shard'))).toMatch(/shard: \[1, 2, 3\]/);
    const summary = withoutComments(job('ui'));
    expect(summary).toContain('needs: ui-shard');
    expect(summary).toContain('test "$UI_RESULT" = success');
    // новый кандидат заменяет прежний: его итог уже никому не нужен, а минуты тратятся
    const block = /\nconcurrency:\n([\s\S]*?)\n(?=\S)/.exec(RELEASE)?.[1] ?? '';
    expect(withoutComments(block)).toMatch(/cancel-in-progress: true/);
    expect(withoutComments(RELEASE)).toMatch(/permissions:\n\s+contents: read/);
  });

  it('база и UI ждут быстрые проверки: при красном lint или unit минуты на них не тратятся', () => {
    for (const name of ['db', 'ui-shard']) expect(withoutComments(job(name)), name).toMatch(/needs: fast/);
  });

  it('наборы салона, ресторана и филиалов входят в гейт выкладки параллельно, на своей базе (MV8.5 DS0a)', () => {
    const vertical = withoutComments(job('ui-vertical'));
    expect(vertical).toMatch(/runs-on: ubuntu-24\.04/);
    expect(vertical).toMatch(/needs: fast/);
    expect(vertical).toMatch(/suite: \[beauty-ui, food-ui, branches-ui\]/);
    expect(vertical).toMatch(/fail-fast: false/);
    expect(vertical).toMatch(/timeout-minutes: \d+/);
    // подставные API трёх наборов читают схему pms_test локальной базы
    expect(vertical).toMatch(/image: postgres:16/);
    expect(vertical).toContain('npm run test:schema');
    expect(vertical).toContain('npx playwright test --config tests/${{ matrix.suite }}/playwright.config.ts');
  });

  it('тесты бота входят в проверки: pytest в apps/ai-seller на той же версии Python, что образ бота', () => {
    const bot = withoutComments(job('bot'));
    expect(bot).toContain('working-directory: apps/ai-seller');
    expect(bot).toMatch(/-m pytest/);
    const image = /^FROM python:(\d+\.\d+)/m.exec(read('apps/ai-seller/Dockerfile'));
    expect(image, 'apps/ai-seller/Dockerfile: FROM python:X.Y').not.toBeNull();
    expect(bot).toContain(`BOT_PYTHON: '${image![1]}'`);
    // uv закреплён версией и суммой: скачанный файл без сверки не запускается
    expect(bot).toMatch(/UV_SHA256: [0-9a-f]{64}/);
    expect(bot).toContain('sha256sum -c');
  });

  it('образ раннера без sudo: под no-new-privileges он не работает', () => {
    const image = withoutComments(RUNNER_IMAGE);
    expect(image).not.toContain('sudoers');
    expect(image).not.toMatch(/apt-get install[^\n]*\bsudo\b/);
  });

  it('образ раннера ставит всё, что Playwright просит для Chromium на Ubuntu 24.04', () => {
    const require = createRequire(import.meta.url);
    const core = dirname(require.resolve('playwright-core/package.json'));
    const source = ['lib/server/registry/nativeDeps.js', 'lib/coreBundle.js']
      .map((f) => join(core, f))
      .filter((f) => existsSync(f))
      .map((f) => readFileSync(f, 'utf8'))
      .find((text) => text.includes('ubuntu24.04-x64'));
    expect(source, 'список зависимостей Playwright для ubuntu24.04-x64 не найден').toBeDefined();
    const block = source!.slice(source!.indexOf('ubuntu24.04-x64'));
    const list = (key: string) =>
      [...(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`).exec(block)?.[1] ?? '').matchAll(/["']([^"']+)["']/g)].map((m) => m[1]!);
    const wanted = [...list('tools'), ...list('chromium')];
    expect(wanted.length, 'пакеты Playwright').toBeGreaterThan(20);
    const image = withoutComments(RUNNER_IMAGE);
    expect(wanted.filter((p) => !new RegExp(`(^|\\s)${p.replace(/[.+]/g, '\\$&')}(\\s|$)`, 'm').test(image))).toEqual([]);
  });

  it('проверки не слушают pull_request_target: там код форка шёл бы с правами репозитория', () => {
    for (const [file, text] of Object.entries(WORKFLOWS))
      expect(withoutComments(text), file).not.toContain('pull_request_target');
  });

  it('задача с базой остаётся на GitHub: ей нужен Docker для services: postgres', () => {
    const db = job('db');
    expect(db).toMatch(/runs-on: ubuntu-24\.04/);
    expect(db).toContain('services:');
    expect(db).toContain('postgres');
  });

  it('эталоны -linux снимает раннер GitHub по кнопке и кладёт отдельной веткой, не в main и не в release', () => {
    // разбор 03.10.2026: эталоны, снятые не на раннере, расходились с проверкой release-checks
    const text = WORKFLOWS['ui-snapshots.yml'] ?? '';
    expect(text, '.github/workflows/ui-snapshots.yml').not.toBe('');
    const run = withoutComments(text);
    const triggers = /\non:\n([\s\S]*?)\n(?=\S)/.exec(run)?.[1] ?? '';
    expect(triggers.trim()).toBe('workflow_dispatch:');
    // запись в репозиторий только у задачи со снимками, по умолчанию чтение
    expect(/\npermissions:\n\s+contents: read/.test(run)).toBe(true);
    expect(run).toContain('--update-snapshots=changed');
    expect(run).toContain("git add -- 'design/reference/kit/*-linux.png'");
    const pushes = [...run.matchAll(/git push[^\n]*/g)].map((m) => m[0]);
    expect(pushes).toEqual(['git push origin "HEAD:refs/heads/$BRANCH"']);
    expect(run).toMatch(/BRANCH: ci\/ui-snapshots-\$\{\{ github\.run_number \}\}/);
    expect(run).not.toMatch(/--force|\+HEAD|refs\/heads\/(main|release)/);
  });
});

const hasJq = spawnSync('jq', ['--version']).status === 0;

/** Хук перед задачей (job-started.sh): тот же bash и тот же jq, что в образе раннера */
describe.skipIf(!hasJq)('свой раннер не выполняет код из чужого форка (ADR-137)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const REPO = 'GAIVER007/wetop.ai';
  const runHook = (event: unknown) => {
    const dir = mkdtempSync(join(tmpdir(), 'wetop-ci-hook-'));
    dirs.push(dir);
    const path = join(dir, 'event.json');
    if (event !== undefined)
      writeFileSync(path, typeof event === 'string' ? event : JSON.stringify(event));
    const r = spawnSync('bash', [HOOK], {
      encoding: 'utf8',
      timeout: 10_000,
      env: { ...process.env, GITHUB_EVENT_PATH: event === undefined ? '' : path },
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const pr = (head: string | null) => ({
    action: 'opened',
    pull_request: { head: { repo: head && { full_name: head } }, base: { repo: { full_name: REPO } } },
    repository: { full_name: REPO },
  });

  it('образ раннера включает хук: переменная ACTIONS_RUNNER_HOOK_JOB_STARTED указывает на job-started.sh', () => {
    const image = withoutComments(RUNNER_IMAGE);
    const env = /^ENV ACTIONS_RUNNER_HOOK_JOB_STARTED=(\S+)$/m.exec(image);
    expect(env, 'ENV ACTIONS_RUNNER_HOOK_JOB_STARTED в Dockerfile раннера').not.toBeNull();
    const hookPath = env?.[1] ?? '';
    expect(image).toContain(`COPY job-started.sh ${hookPath}`);
    // вне тома раннера: том с настройкой переживает пересборку, а хук должен приходить с образом
    expect(hookPath.startsWith('/home/runner/actions-runner')).toBe(false);
  });

  // Отказ хука: код 1 и строка «WETOP:», а не падение самого скрипта (127 у отсутствующего файла тоже «не 0»)
  const refused = (r: { code: number | null; out: string }) => {
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('WETOP:');
  };

  it('запрос на слияние из форка: отказ, задача краснеет, а не пропускается', () => {
    const r = runHook(pr('stranger/wetop.ai'));
    refused(r);
    expect(r.out).toContain('stranger/wetop.ai');
  });

  it('форк уже удалён (head.repo пуст): чей код, не проверить, тоже отказ', () => {
    refused(runHook(pr(null)));
  });

  it('ветка самого репозитория и пуш в main выполняются', () => {
    for (const r of [
      runHook(pr(REPO)),
      runHook({ ref: 'refs/heads/main', repository: { full_name: REPO } }),
    ]) {
      expect(r.code, r.out).toBe(0);
      expect(r.out).toContain('WETOP: задача из самого репозитория');
    }
  });

  it('нет файла события или он битый: отказ, а не молчаливый пропуск проверки', () => {
    refused(runHook(undefined));
    refused(runHook('{битый'));
  });
});

/**
 * Скрипт запуска раннера (entrypoint.sh). Разбор 03.10.2026: в `.env` раннера стоял образец `RUNNER_TOKEN=…` из README,
 * многоточие ушло в заголовок запроса, регистрация падала с «Request headers must contain only ASCII characters», и
 * раннер с 21.09 ни разу не подключился: все задачи проверок стояли в очереди. Теперь токен и адрес проверяются до
 * регистрации, а отказ говорит словами, что не так. config.sh и run.sh здесь подставные.
 */
describe('скрипт запуска раннера: регистрация', () => {
  const ENTRY = join(ROOT, 'scripts/ops/ci-runner/entrypoint.sh');
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const start = (env: Record<string, string>, opts: { registered?: boolean } = {}) => {
    const home = mkdtempSync(join(tmpdir(), 'wetop-ci-entry-'));
    dirs.push(home);
    writeFileSync(join(home, 'config.sh'), `#!/bin/bash\necho "config $*" >> "${home}/calls"\n`, { mode: 0o755 });
    writeFileSync(join(home, 'run.sh'), `#!/bin/bash\necho "run" >> "${home}/calls"\n`, { mode: 0o755 });
    if (opts.registered) writeFileSync(join(home, '.runner'), '{}');
    const r = spawnSync('bash', [ENTRY], {
      encoding: 'utf8',
      timeout: 10_000,
      env: { PATH: process.env.PATH ?? '', RUNNER_HOME: home, ...env },
    });
    let calls = '';
    try {
      calls = readFileSync(join(home, 'calls'), 'utf8');
    } catch {
      /* ни одного вызова */
    }
    return { code: r.status, err: r.stderr, calls };
  };
  const URL = 'https://github.com/GAIVER007/wetop.ai';

  it('образец «…» вместо токена: отказ словами до регистрации, config.sh не зовётся', () => {
    const r = start({ RUNNER_REPO_URL: URL, RUNNER_TOKEN: '…' });
    expect(r.code).toBe(64);
    expect(r.err).toContain('RUNNER_TOKEN в .env раннера не похож на токен регистрации');
    expect(r.calls).toBe('');
  });

  it('токен с пробелом или в кавычках и адрес не GitHub: тоже отказ', () => {
    expect(start({ RUNNER_REPO_URL: URL, RUNNER_TOKEN: 'AAAABBBBCCCCDDDDEEEE FFFF' }).code).toBe(64);
    expect(start({ RUNNER_REPO_URL: URL, RUNNER_TOKEN: '"AAAABBBBCCCCDDDDEEEEFFFF"' }).code).toBe(64);
    const r = start({ RUNNER_REPO_URL: 'https://github.com/GAIVER007/wetop.ai …', RUNNER_TOKEN: 'AAAABBBBCCCCDDDDEEEEFFFF1' });
    expect(r.code).toBe(64);
    expect(r.err).toContain('RUNNER_REPO_URL');
  });

  it('настоящий токен: регистрация с меткой wetop, затем работа', () => {
    const r = start({ RUNNER_REPO_URL: URL, RUNNER_TOKEN: 'AAAABBBBCCCCDDDDEEEEFFFF1' });
    expect(r.code, r.err).toBe(0);
    expect(r.calls).toMatch(/^config --unattended --replace --url https:\/\/github\.com\/GAIVER007\/wetop\.ai --token AAAABBBBCCCCDDDDEEEEFFFF1 --name wetop-\S+ --labels wetop --work _work\nrun\n$/);
  });

  it('уже зарегистрирован (настройка в томе): токен не нужен и не проверяется', () => {
    const r = start({ RUNNER_REPO_URL: URL }, { registered: true });
    expect(r.code, r.err).toBe(0);
    expect(r.calls).toBe('run\n');
  });
});
