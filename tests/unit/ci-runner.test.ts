/**
 * Свой раннер GitHub Actions (`scripts/ops/ci-runner`, разбор 21.09.2026).
 *
 * Держит то, что ломается молча и обнаруживается через неделю:
 *  1. раннеру дали сокет Docker — код из любой ветки получает root на машине, где рядом чужие проекты
 *     и боевая PMS;
 *  2. тяжёлые задачи вернулись на раннеры GitHub, где минуты выбраны и ничего не запускается;
 *  3. задача с базой уехала на свой раннер, где нет Docker для `services: postgres`, и падает не по делу.
 *  4. раннер на боевом сервере взял задачу из запроса на слияние из чужого форка (ADR-137, замечание ментора
 *     02.10.2026): защищает хук перед задачей в образе раннера, а не условие в checks.yml;
 *  5. тесты бота выпали из проверок, и их красноту снова никто не видит (ADR-137).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const WORKFLOW = read('.github/workflows/checks.yml');
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
function job(name: string): string {
  const start = WORKFLOW.indexOf(`\n  ${name}:\n`);
  expect(start, `задача ${name} не найдена`).toBeGreaterThan(-1);
  const rest = WORKFLOW.slice(start + 1);
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

  it('тяжёлые задачи идут на свой раннер: минуты GitHub выбраны', () => {
    for (const name of ['fast', 'ui-shard', 'ui', 'bot'])
      expect(job(name), name).toMatch(/runs-on: \[self-hosted, linux, x64, wetop\]/);
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

  it('прогон main не отменяется следующим пушем: иначе при частых слияниях у main нет ни одного итога', () => {
    const block = /\nconcurrency:\n([\s\S]*?)\n(?=\S)/.exec(WORKFLOW)?.[1] ?? '';
    expect(withoutComments(block)).toMatch(/cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  });

  it('проверки не слушают pull_request_target: там код форка шёл бы с правами репозитория', () => {
    expect(withoutComments(WORKFLOW)).not.toContain('pull_request_target');
  });

  it('задача с базой остаётся на GitHub: ей нужен Docker для services: postgres', () => {
    const db = job('db');
    expect(db).toMatch(/runs-on: ubuntu-24\.04/);
    expect(db).toContain('services:');
    expect(db).toContain('postgres');
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
