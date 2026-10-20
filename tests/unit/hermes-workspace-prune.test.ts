/**
 * Ночная уборка кэшей в копиях агента Hermes (`scripts/ops/hermes-workspace-prune.sh`, решение владельца 18.10.2026).
 * Скрипт исполняется по-настоящему на временном каталоге; docker подставной. Держит главное: удаляются только
 * node_modules и .next* в давно стоящих копиях; свежая копия, исходники, .git и отчёты остаются; --dry-run не удаляет.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve(import.meta.dirname, '../../scripts/ops/hermes-workspace-prune.sh');
let dir: string;
let root: string;
let bin: string;

function file(path: string, ageHours: number) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, 'x');
  const at = new Date(Date.now() - ageHours * 3_600_000);
  utimesSync(path, at, at);
}

// состарить все файлы копии, кроме .git
function age(path: string, hours: number) {
  const at = new Date(Date.now() - hours * 3_600_000);
  for (const e of readdirSync(path, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const p = join(path, e.name);
    if (e.isDirectory()) age(p, hours);
    else utimesSync(p, at, at);
  }
}

function git(cwd: string, ...args: string[]) {
  const r = spawnSync('git', ['-c', 'user.email=t@example.test', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

function run(args: string[] = []) {
  const r = spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      HERMES_WORKSPACE: root,
      HERMES_USER: 'no-such-hermes-user-for-tests',
      HERMES_IDLE_MINUTES: '360',
      HERMES_MAIN: 'main',
      HERMES_BACKUPS: join(dir, 'backups'),
    },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hermes-prune-'));
  root = join(dir, 'workspace');
  bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'docker'), `#!/usr/bin/env bash\necho "docker $*" >> "${join(dir, 'docker.log')}"\n`);
  chmodSync(join(bin, 'docker'), 0o755);
  // давно стоящая копия: файлы старше суток
  file(join(root, 'old/src/app.ts'), 30);
  file(join(root, 'old/.git/HEAD'), 30);
  file(join(root, 'old/reports/run.md'), 30);
  file(join(root, 'old/node_modules/pkg/index.js'), 30);
  file(join(root, 'old/apps/web/.next/build.js'), 30);
  file(join(root, 'old/tree/node_modules/pkg/index.js'), 30);
  // свежая копия: исходник правили час назад
  file(join(root, 'fresh/src/app.ts'), 1);
  file(join(root, 'fresh/node_modules/pkg/index.js'), 30);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('scripts/ops/hermes-workspace-prune.sh', () => {
  it('убирает только кэши давно стоящей копии; свежая копия, исходники, .git и отчёты остаются', () => {
    const r = run();
    expect(r.code, r.out).toBe(0);
    expect(existsSync(join(root, 'old/node_modules'))).toBe(false);
    expect(existsSync(join(root, 'old/apps/web/.next'))).toBe(false);
    expect(existsSync(join(root, 'old/tree/node_modules'))).toBe(false);
    expect(existsSync(join(root, 'old/src/app.ts'))).toBe(true);
    expect(existsSync(join(root, 'old/.git/HEAD'))).toBe(true);
    expect(existsSync(join(root, 'old/reports/run.md'))).toBe(true);
    expect(existsSync(join(root, 'fresh/node_modules/pkg/index.js'))).toBe(true);
    expect(readFileSync(join(dir, 'docker.log'), 'utf8')).toContain('docker builder prune -f');
    expect(r.out).toContain('hermes-workspace-prune: освобождено');
  });

  it('--dry-run ничего не удаляет и не трогает docker', () => {
    const r = run(['--dry-run']);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('убралось бы: ./old/node_modules');
    expect(existsSync(join(root, 'old/node_modules/pkg/index.js'))).toBe(true);
    expect(existsSync(join(dir, 'docker.log'))).toBe(false);
  });

  it('несвежее рабочее дерево сохраняется и удаляется; основной клон и свежее дерево остаются', () => {
    const main = join(root, 'main');
    mkdirSync(main, { recursive: true });
    git(main, 'init', '-q');
    writeFileSync(join(main, 'a.txt'), 'a');
    git(main, 'add', 'a.txt');
    git(main, 'commit', '-qm', 'init');
    git(main, 'worktree', 'add', '-q', '-b', 'feat-stale', '../stale');
    git(main, 'worktree', 'add', '-q', '-b', 'feat-fresh', '../fresh-wt');
    const stale = join(root, 'stale');
    writeFileSync(join(stale, 'a.txt'), 'changed');
    writeFileSync(join(stale, 'new.txt'), 'untracked');
    git(stale, 'commit', '-qam', 'unpushed');
    writeFileSync(join(stale, 'a.txt'), 'dirty');
    age(main, 72);
    age(stale, 72);

    const dry = run(['--dry-run']);
    expect(dry.code, dry.out).toBe(0);
    expect(dry.out).toContain('удалилась бы (рабочее дерево');
    expect(existsSync(stale)).toBe(true);

    const r = run();
    expect(r.code, r.out).toBe(0);
    expect(existsSync(stale)).toBe(false);
    expect(existsSync(join(root, 'fresh-wt/a.txt'))).toBe(true);
    expect(existsSync(join(main, 'a.txt'))).toBe(true);
    expect(git(main, 'worktree', 'list')).not.toContain('stale');
    const day = readdirSync(join(dir, 'backups')).find((d) => d.startsWith('workspace-'))!;
    const saved = join(dir, 'backups', day, 'stale');
    expect(readFileSync(join(saved, 'tracked.patch'), 'utf8')).toContain('+dirty');
    expect(readFileSync(join(saved, 'status.txt'), 'utf8')).toContain('new.txt');
    expect(git(main, 'bundle', 'list-heads', join(saved, 'unpushed.bundle'))).toContain('refs/heads/feat-stale');
  });
});
