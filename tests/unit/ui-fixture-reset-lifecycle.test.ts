import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { expect, test } from 'vitest';

type Hook = (context: { request: object }) => Promise<void>;

// Execute actual lifecycle callbacks only: no browser, API server or test bodies.
function collectHooks(file: string, lifecycle: 'beforeEach' | 'afterEach') {
  const hooks: Hook[] = [];
  const register = Object.assign(() => {}, {
    beforeEach: (hook: Hook) => { if (lifecycle === 'beforeEach') hooks.push(hook); },
    afterEach: (hook: Hook) => { if (lifecycle === 'afterEach') hooks.push(hook); },
  });
  const source = readFileSync(new URL(`../ui/${file}`, import.meta.url), 'utf8');
  const code = transpileModule(source, {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    exports: {},
    require: (id: string) => {
      if (id === './fixtures') return { test: register, expect, FIXTURE_API: 'http://unit-only.invalid' };
      if (id === '@axe-core/playwright') return { default: class {} };
      throw new Error(`Unexpected source dependency: ${id}`);
    },
  });
  return hooks;
}

for (const [file, lifecycle] of [
  ['reports-finance.spec.ts', 'beforeEach'],
  ['quality.spec.ts', 'afterEach'],
] as const) {
  test(`${file} ${lifecycle} awaits a successful fixture reset`, async () => {
    const hooks = collectHooks(file, lifecycle);
    expect(hooks).toHaveLength(1);
    let release!: (value: { ok: () => boolean }) => void;
    const response = new Promise<{ ok: () => boolean }>((resolve) => { release = resolve; });
    const calls: string[] = [];
    let checked = false;
    let completed = false;
    const pending = hooks[0]!({ request: {
      post: (url: string) => { calls.push(url); return response; },
    } }).then(() => { completed = true; });
    await Promise.resolve();
    expect(calls).toEqual(['http://unit-only.invalid/__test/reset']);
    expect(completed).toBe(false);
    release({ ok: () => { checked = true; return true; } });
    await pending;
    expect(checked).toBe(true);
    expect(completed).toBe(true);
  });

  test(`${file} ${lifecycle} rejects an unsuccessful fixture reset`, async () => {
    const hooks = collectHooks(file, lifecycle);
    expect(hooks).toHaveLength(1);
    await expect(hooks[0]!({ request: {
      post: async () => ({ ok: () => false }),
    } })).rejects.toThrow();
  });
}
