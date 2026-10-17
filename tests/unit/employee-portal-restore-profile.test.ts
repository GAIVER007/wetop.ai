import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('portal restore CI coverage', () => {
  it('runs the dedicated restore profile in release checks', () => {
    const workflow = readFileSync('.github/workflows/release-checks.yml', 'utf8');
    const dispatched = workflow.split('\n').some((line) => line.includes('tests/restore/employee-portal-grants-restore.config.ts'));
    expect(dispatched).toBe(true);
  });
  it('documents the dedicated restore runner and admin database, never pmslocal', () => {
    const readme = readFileSync('packages/database/prisma/migrations/20261016000129_employee_portal_grants/README.md', 'utf8');
    expect(readme).toContain('tests/restore/employee-portal-grants-restore.config.ts');
    expect(readme).toContain('127.0.0.1:55624/postgres');
    expect(readme).not.toContain('55613/pmslocal');
    expect(readme).not.toContain('tests/integration/employee-portal-grants-restore');
  });
  it('requires an explicit target rather than silently skipping restoration', () => {
    const source = readFileSync('tests/restore/employee-portal-grants-restore.test.ts', 'utf8');
    expect(source.includes('describe.skip')).toBe(false);
    expect(source.includes('Explicit disposable restore database URL required')).toBe(true);
  });
});
