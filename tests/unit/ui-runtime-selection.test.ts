import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { selectUiRuntimes } from '../ui/runtime-selection';

const runtimes = () => [
  { index: 0, root: '/worker-0', uiDir: '/worker-0/tests/ui', webOrigin: 'http://localhost:3100', siteOrigin: 'http://localhost:3200', fixtureOrigin: 'http://localhost:3300', testMatch: ['a.spec.ts', 'c.spec.ts'] },
  { index: 1, root: '/worker-1', uiDir: '/worker-1/tests/ui', webOrigin: 'http://localhost:3101', siteOrigin: 'http://localhost:3201', fixtureOrigin: 'http://localhost:3301', testMatch: ['b.spec.ts', 'd.spec.ts'] },
];
const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');

describe('UI runtime selection', () => {
  it.each([undefined, '2'])('preserves the original two runtimes and origins for %s', (count) => {
    const input = runtimes();
    expect(selectUiRuntimes(input, count)).toBe(input);
  });

  it('collapses to worker zero with the exact complete spec union without mutation', () => {
    const input = runtimes();
    const before = structuredClone(input);
    const selected = selectUiRuntimes(input, '1');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toEqual({ ...input[0], testMatch: ['a.spec.ts', 'c.spec.ts', 'b.spec.ts', 'd.spec.ts'] });
    expect(selected[0]).not.toBe(input[0]);
    expect(selected.flatMap((worker) => worker.testMatch).sort()).toEqual(input.flatMap((worker) => worker.testMatch).sort());
    expect(new Set(selected[0]!.testMatch).size).toBe(4);
    expect(input).toEqual(before);
  });

  it('preserves every spec when one partition is empty', () => {
    const input = runtimes();
    input[0]!.testMatch = [];
    expect(selectUiRuntimes(input, '1')[0]!.testMatch).toEqual(input[1]!.testMatch);
  });

  it.each(['', '0', '3', '01', '1.0', 'one'])('rejects invalid explicit count %s', (count) => {
    expect(() => selectUiRuntimes(runtimes(), count)).toThrow(/UI_RUNTIME_WORKERS/);
  });

  it.each([0, 1, 3])('rejects missing or unexpected input runtimes: %s', (length) => {
    const input = Array.from({ length }, () => runtimes()[0]!);
    expect(() => selectUiRuntimes(input, '1')).toThrow(/two runtimes/);
  });

  it.each([undefined, '1', '2'])('rejects duplicate specs rather than silently dropping coverage for %s', (count) => {
    const input = runtimes();
    input[1]!.testMatch.push('a.spec.ts');
    expect(() => selectUiRuntimes(input, count)).toThrow(/duplicate/i);
  });

  it('wires the same selected list to servers and projects without importing the config', () => {
    const source = read('tests/ui/playwright.config.ts');
    expect(source).toContain("selectUiRuntimes(isolated.workers, process.env.UI_RUNTIME_WORKERS)");
    expect(source).toContain('selectedWorkers.flatMap(');
    expect(source).toContain('projects: selectedWorkers.map(');
    expect(source).not.toContain('isolated.workers.flatMap(');
    expect(source).not.toContain('projects: isolated.workers.map(');
    expect(source.match(/command:/g)).toHaveLength(4); // type declaration plus API, app and site
  });

  it('requests one runtime only in the five-shard CI job, keeping one scheduler', () => {
    const source = read('.github/workflows/release-checks.yml');
    const job = source.split('\n  ui-shard:\n')[1]!.split('\n  ui-vertical:\n')[0]!;
    expect(job).toContain("UI_RUNTIME_WORKERS: '1'");
    expect(source.match(/UI_RUNTIME_WORKERS:/g)).toHaveLength(1);
    expect(job).toContain('shard: [1, 2, 3, 4, 5]');
    expect(job).toContain('UI_SHARD: ${{ matrix.shard }}/5');
    expect(job).toContain('--workers=1');
  });
});
