import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * scripts/ops/promote-release.sh, перемотка `release` только по зелёным проверкам (разбор 01.10.2026,
 * reports/order-2026-10-01, пункт 8). GitHub здесь подставной: `gh` в PATH отдаёт check-runs из FAKE_CHECKS,
 * репозиторий временный с bare-origin. Проверяется, что скрипт не трогает `release`, пока обязательная задача
 * красная или не завершена, берёт только вершины из `main`, не откатывает назад и спрашивает «да» владельца.
 */
const SCRIPT = resolve('scripts/ops/promote-release.sh');
const REQUIRED = 'fast,ui';
let dir: string;
let origin: string;
let dev: string;
let bin: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function commit(file: string, message: string, branch = 'main'): string {
  mkdirSync(join(dev, file, '..'), { recursive: true });
  writeFileSync(join(dev, file), `${message}\n`);
  git(dev, 'add', file);
  git(dev, 'commit', '-qm', message);
  git(dev, 'push', '-q', 'origin', `HEAD:${branch}`);
  return git(dev, 'rev-parse', 'HEAD');
}

type Run = { name: string; status: string; conclusion: string | null };
function run(target: string, checks: Run[], extra: string[] = [], env: Record<string, string> = {}) {
  const r = spawnSync('bash', [SCRIPT, target, ...extra], {
    cwd: dev,
    encoding: 'utf8',
    timeout: 20_000,
    input: env.ANSWER ?? '',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      FAKE_CHECKS: checks.map((c) => JSON.stringify(c)).join('\n'),
      REQUIRED_CHECKS: REQUIRED,
      RELEASE_REPO: 'owner/repo',
      ...env,
    },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}
const release = () => git(dev, 'rev-parse', 'origin/release');
const ok = (name: string): Run => ({ name, status: 'completed', conclusion: 'success' });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'promote-release-'));
  origin = join(dir, 'origin.git');
  dev = join(dir, 'dev');
  bin = join(dir, 'bin');
  mkdirSync(bin);
  git(dir, 'init', '-q', '--bare', '--initial-branch=main', origin);
  git(dir, 'clone', '-q', origin, dev);
  git(dev, 'config', 'user.email', 't@example.test');
  git(dev, 'config', 'user.name', 'test');
  commit('README.md', 'init');
  git(dev, 'push', '-q', 'origin', 'HEAD:release');
  git(dev, 'fetch', '-q', 'origin');
  // Подставной gh: как `gh api --paginate … --jq '.check_runs[]'`, по объекту на строку
  writeFileSync(join(bin, 'gh'), '#!/usr/bin/env bash\nprintf "%s\\n" "$FAKE_CHECKS"\n');
  chmodSync(join(bin, 'gh'), 0o755);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('scripts/ops/promote-release.sh', () => {
  it('обязательные проверки зелёные и владелец сказал «да»: release перематывается на коммит', () => {
    const target = commit('a.txt', 'feature');
    const r = run(target, [ok('fast'), ok('ui'), ok('db')], [], { ANSWER: 'да\n' });
    expect(r.out).toContain('зелёные');
    expect(r.code).toBe(0);
    expect(release()).toBe(target);
  });

  it('обязательная задача красная: отказ, release не тронута', () => {
    const before = release();
    const target = commit('a.txt', 'feature');
    const r = run(target, [ok('fast'), { name: 'ui', status: 'completed', conclusion: 'failure' }], ['--yes']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('«ui» красная');
    expect(release()).toBe(before);
  });

  it('проверка ещё идёт или не запускалась: отказ', () => {
    const before = release();
    const target = commit('a.txt', 'feature');
    const running = run(target, [ok('fast'), { name: 'ui', status: 'in_progress', conclusion: null }], ['--yes']);
    expect(running.code).toBe(1);
    expect(running.out).toContain('ещё идёт');
    const missing = run(target, [ok('fast')], ['--yes']);
    expect(missing.code).toBe(1);
    expect(missing.out).toContain('не запускалась');
    expect(release()).toBe(before);
  });

  it('необязательная задача красная: тоже отказ: красный db не прячется за «необязательно»', () => {
    const target = commit('a.txt', 'feature');
    const r = run(target, [ok('fast'), ok('ui'), { name: 'db', status: 'completed', conclusion: 'failure' }], ['--yes']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('«db» красная');
  });

  it('коммит не из main: отказ: ветка выкладки не обходит main', () => {
    const before = release();
    const stray = commit('b.txt', 'hotfix on branch', 'hotfix');
    const r = run(stray, [ok('fast'), ok('ui')], ['--yes']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('не в origin/main');
    expect(release()).toBe(before);
  });

  it('перемотка назад: отказ: откат делается руками', () => {
    const first = git(dev, 'rev-parse', 'HEAD');
    const second = commit('a.txt', 'feature');
    git(dev, 'push', '-q', 'origin', `${second}:release`);
    const r = run(first, [ok('fast'), ok('ui')], ['--yes']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('откат');
    expect(release()).toBe(second);
  });

  it('без «да» владельца release не трогается, --dry-run только показывает', () => {
    const before = release();
    const target = commit('a.txt', 'feature');
    const no = run(target, [ok('fast'), ok('ui')], [], { ANSWER: 'нет\n' });
    expect(no.code).toBe(1);
    expect(release()).toBe(before);
    const dry = run(target, [ok('fast'), ok('ui')], ['--dry-run']);
    expect(dry.code).toBe(0);
    expect(dry.out).toContain('dry-run');
    expect(release()).toBe(before);
  });
});
