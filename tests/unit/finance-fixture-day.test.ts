import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { expect, test } from 'vitest';

// Execute the actual spec's hook/navigation without importing the UI config or starting services.
const source = readFileSync(new URL('../ui/finance-f2.spec.ts', import.meta.url), 'utf8');
const code = transpileModule(source, {
  compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
}).outputText;

test('finance period follows each reset across midnight, month and year boundaries', async () => {
  const { reset, navigate } = harness();
  for (const [today, from] of [
    ['2026-10-17', '2026-10-12'], ['2026-10-18', '2026-10-13'],
    ['2026-11-01', '2026-10-27'], ['2027-01-01', '2026-12-27'],
    ['2028-03-01', '2028-02-25'],
  ]) {
    await reset({ today });
    expect(await navigate()).toBe(`/finance?from=${from}&to=${today}#operations`);
  }
});

test('finance reset fails closed on absent, malformed or impossible calendar days', async () => {
  const { reset } = harness();
  for (const today of [undefined, null, 18, '', '2026-2-03', '2026-02-30', '2026-13-01', 'not-a-day']) {
    await expect(reset({ today })).rejects.toThrow('valid ISO calendar day');
  }
  await expect(reset(null)).rejects.toThrow('valid ISO calendar day');
  await expect(reset({ today: '2026-10-18' }, false)).rejects.toThrow();
});

function harness() {
  type Hook = (context: { request: object }) => Promise<void>;
  type Case = (context: { page: object }) => Promise<void>;
  let before: Hook;
  const cases: Case[] = [];
  const register = Object.assign((_name: string, fn: Case) => cases.push(fn), {
    beforeEach: (fn: Hook) => { before = fn; },
    afterEach: () => {}, setTimeout: () => {},
  });
  class FrozenDate extends Date {
    static override now() { return Date.parse('2026-10-17T12:00:00Z'); }
  }
  runInNewContext(code, {
    exports: {}, Date: FrozenDate,
    require: (id: string) => {
      if (id === './fixtures') return { test: register, expect, FIXTURE_API: 'http://unit-only.invalid' };
      if (id === 'node:fs') return { mkdirSync: () => {} };
      throw new Error(`Unexpected source dependency: ${id}`);
    },
  });
  return {
    reset: (body: unknown, ok = true) => before({ request: {
      post: async () => ({ ok: () => ok, json: async () => body }),
    } }),
    navigate: async () => {
      const stop = new Error('unit-only navigation capture');
      let actual: string | undefined;
      try {
        await cases[0]!({ page: {
          setViewportSize: async () => {},
          goto: async (url: string) => { actual = url; throw stop; },
        } });
      } catch (error) {
        if (error !== stop) throw error;
      }
      return actual;
    },
  };
}
