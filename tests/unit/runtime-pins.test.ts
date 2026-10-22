import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Сторож версий среды (отчёт по уязвимостям 21.10.2026): Node в образах сервера и в CI закреплён точной версией
 * не ниже безопасного выпуска. Плавающий тег `node:24-alpine` давал любую сборку, в CI оказалась 24.22.0 при
 * безопасной 24.22.1. Поднимать минимум здесь же при следующем выпуске безопасности.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const MIN_NODE_24 = [24, 22, 1] as const;
const DOCKERFILES = ['deploy/Dockerfile', 'scripts/ops/watch/Dockerfile', 'scripts/ops/guard/Dockerfile'];

const atLeast = (version: string) => {
  const parts = version.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (parts[i]! > MIN_NODE_24[i]!) return true;
    if (parts[i]! < MIN_NODE_24[i]!) return false;
  }
  return true;
};

describe('версии Node закреплены и не ниже безопасной', () => {
  for (const file of DOCKERFILES) {
    it(file, () => {
      const froms = [...readFileSync(resolve(ROOT, file), 'utf8').matchAll(/^FROM\s+node:(\S+)/gm)].map((m) => m[1]!);
      expect(froms.length, file).toBeGreaterThan(0);
      for (const tag of froms) {
        const version = /^(\d+\.\d+\.\d+)-alpine$/.exec(tag)?.[1];
        expect(version, `${file}: тег ${tag} без точной версии`).toBeTruthy();
        expect(atLeast(version!), `${file}: ${version} ниже 24.22.1`).toBe(true);
      }
    });
  }
  it('.nvmrc (CI)', () => {
    const version = readFileSync(resolve(ROOT, '.nvmrc'), 'utf8').trim();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(atLeast(version)).toBe(true);
  });
});
