import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLOSED_ACCESS,
  UNKNOWN_ACCESS,
  openToEveryRole,
  pageOpen,
  routeRule,
  type NavigationAccess,
} from './navigation';

/**
 * Сторож неизменности прав (план DS2 §12, ADR-107). DS2 меняет только меню и подсветку: право страницы (`routeRule`)
 * и решение `AccessGate` для каждого адреса приложения и каждой роли совпадают со снимком, снятым на `main` до DS2a
 * (`navigation-rights.baseline.json`). Расхождение — красное: это F7 (§15), отдельный PR прав, а не навигация.
 */
const APP = resolve(import.meta.dirname, '../app');

/** Подстановки динамических сегментов: по одному образцу на каждый вид адреса */
const SAMPLE: Record<string, string> = {
  id: '123',
  number: 'ABC',
  code: 'R01',
  token: 'tok',
  revisionId: 'rev-1',
};

function pageDirs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    // параллельные и перехватывающие маршруты (`@drawer`) отдают те же адреса, что и обычные страницы
    if (name.startsWith('@')) continue;
    out.push(...pageDirs(full));
  }
  if (readdirSync(dir).includes('page.tsx')) out.push(relative(APP, dir));
  return out;
}

/** Все адреса страниц приложения с образцами динамических сегментов */
function appPaths(): string[] {
  const paths = new Set<string>();
  for (const dir of pageDirs(APP)) {
    const segments = dir ? dir.split('/').filter((s) => !/^\(.*\)$/.test(s)) : [];
    let variants = [''];
    for (const seg of segments) {
      const optional = /^\[\[\.\.\.(.+)\]\]$/.exec(seg);
      const dynamic = /^\[(?:\.\.\.)?(.+)\]$/.exec(seg);
      if (optional) variants = variants.flatMap((v) => [v, `${v}/sample`]);
      else if (dynamic) variants = variants.map((v) => `${v}/${SAMPLE[dynamic[1]!] ?? 'sample'}`);
      else variants = variants.map((v) => `${v}/${seg}`);
    }
    for (const v of variants) paths.add(v || '/');
  }
  return [...paths].sort();
}

const ACCESS: Record<string, NavigationAccess> = {
  owner: { ...CLOSED_ACCESS, role: 'OWNER' },
  manager: { ...CLOSED_ACCESS, role: 'MANAGER' },
  staff: { ...CLOSED_ACCESS, role: 'STAFF' },
  signedOut: CLOSED_ACCESS,
  unknown: UNKNOWN_ACCESS,
  platformAdmin: { aiSeller: true, platform: true, role: 'OWNER' },
};

/** То же решение, что принимает `AccessGate` (components/access-gate.tsx): страница открыта, закрыта или не проверяется */
function gate(path: string, access: NavigationAccess): 'open' | 'denied' | 'unchecked' {
  const rule = routeRule(path);
  const check =
    rule?.requires && rule.requires !== 'platform' && !openToEveryRole(rule.requires)
      ? rule.requires
      : null;
  if (!check) return 'unchecked';
  return pageOpen(access, check) ? 'open' : 'denied';
}

function rightsSnapshot(paths: string[]) {
  return Object.fromEntries(
    paths.map((path) => {
      const rule = routeRule(path);
      return [
        path,
        {
          rule: rule ? { href: rule.href, label: rule.label, requires: rule.requires ?? null } : null,
          gate: Object.fromEntries(Object.entries(ACCESS).map(([who, a]) => [who, gate(path, a)])),
        },
      ];
    }),
  );
}

const BASELINE = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'navigation-rights.baseline.json'), 'utf8'),
) as { paths: string[]; snapshot: ReturnType<typeof rightsSnapshot> };

describe('DS2 rights invariance (routeRule and AccessGate)', () => {
  it('walks every page of the app, none lost since the baseline', () => {
    const now = appPaths();
    expect(now.length).toBeGreaterThan(80);
    expect(BASELINE.paths.filter((p) => !now.includes(p))).toEqual([]);
  });

  it('gives every baseline route the same rule and gate decision for every role', () => {
    expect(rightsSnapshot(BASELINE.paths)).toEqual(BASELINE.snapshot);
  });
});
