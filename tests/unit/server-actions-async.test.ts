import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// Next.js rejects a 'use server' module that exports a non-async function, including TypeScript overload
// signatures ("Server Actions must be async functions"). The whole page then fails to compile in dev/UI runs.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

it('every export function in a use-server module is async', () => {
  const offenders = files('apps/web/src').flatMap((path) => {
    const source = readFileSync(path, 'utf8');
    if (!/^\s*['"]use server['"]/.test(source)) return [];
    return [...source.matchAll(/^export function (\w+)/gm)].map((m) => `${path}: ${m[1]}`);
  });
  expect(offenders).toEqual([]);
});
