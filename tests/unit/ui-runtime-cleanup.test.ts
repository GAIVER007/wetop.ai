import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Временные копии UI-стенда (`.wetop-main-ui-*`) убираются после прогона (уборка 22.10.2026): каждый локальный прогон
 * оставлял в workspace копию на ~56 МБ, к 22.10 их набралось 20 и лимит рабочих деревьев сервера (10) был занят.
 * Копию удаляет только тот процесс, который её создал; переданную через UI_ISOLATED_RUNTIME_ROOT не трогает;
 * UI_KEEP_RUNTIME=1 оставляет её для разбора.
 */
const MODULE = resolve(import.meta.dirname, '../ui/isolated-workers.ts');
const parent = mkdtempSync(join(tmpdir(), 'ui-runtime-cleanup-'));
afterAll(() => rmSync(parent, { recursive: true, force: true }));

function fakeRepo(name: string) {
  const repo = join(parent, name);
  for (const dir of ['tests/ui', 'apps/web', 'apps/site', 'apps/sites', 'node_modules', 'packages', 'scripts', 'tests/e2e', 'tests/tools'])
    mkdirSync(join(repo, dir), { recursive: true });
  for (const spec of ['a.spec.ts', 'b.spec.ts', 'a27-auth-boundary.spec.ts'])
    writeFileSync(join(repo, 'tests/ui', spec), "test('x', () => {});\n");
  writeFileSync(join(repo, 'apps/web/page.tsx'), 'export {};\n');
  writeFileSync(join(repo, 'packages/keep.txt'), 'источник не трогать\n');
  for (const file of ['package.json', 'package-lock.json', 'tsconfig.base.json']) writeFileSync(join(repo, file), '{}\n');
  return repo;
}

function runPrepare(repo: string, env: Record<string, string> = {}) {
  const code = `import(${JSON.stringify(MODULE)}).then((m) => { const r = m.prepareIsolatedUiWorkers(${JSON.stringify(repo)}); console.log('ROOT=' + r.root); })`;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', code], {
    cwd: resolve(import.meta.dirname, '../..'),
    env: { ...process.env, UI_RUNTIME_PARENT: parent, UI_ISOLATED_RUNTIME_ROOT: '', UI_KEEP_RUNTIME: '', ...env },
    encoding: 'utf8',
  });
  expect(result.status, result.stderr).toBe(0);
  return /ROOT=(.+)/.exec(result.stdout)![1]!.trim();
}

const runtimes = () => readdirSync(parent).filter((name) => name.startsWith('.wetop-main-ui-'));

describe('временная копия UI-стенда', () => {
  it('удаляется, когда создавший её процесс завершается; исходники и общие папки целы', () => {
    const repo = fakeRepo('repo-a');
    const root = runPrepare(repo);
    expect(existsSync(root)).toBe(false);
    expect(runtimes()).toEqual([]);
    expect(existsSync(join(repo, 'packages/keep.txt'))).toBe(true);
    expect(existsSync(join(repo, 'tests/ui/a.spec.ts'))).toBe(true);
  });

  it('UI_KEEP_RUNTIME=1 оставляет копию для разбора', () => {
    const root = runPrepare(fakeRepo('repo-b'), { UI_KEEP_RUNTIME: '1' });
    expect(existsSync(join(root, 'manifest.json'))).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });
});
