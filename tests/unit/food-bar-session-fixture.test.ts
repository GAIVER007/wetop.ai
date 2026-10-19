import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('food BAR fixture supplies the real owner and live session recovery contract', async () => {
  // Exercise the actual auth/me method without starting the database/API fixture process.
  const source = ts.createSourceFile('fixture-api.ts', readFileSync('tests/food-ui/fixture-api.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const controller = source.statements.find((s): s is ts.ClassDeclaration => ts.isClassDeclaration(s) && s.name?.text === 'FixtureController')!;
  const method = controller.members.find((m) => ts.isMethodDeclaration(m) && m.name.getText(source) === 'me')!;
  const javascript = ts.transpileModule(`class FixtureController { ${method.getText(source)} }; new FixtureController().me();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const result = await vm.runInNewContext(javascript, {
    user: 'synthetic-user', org: 'synthetic-org', role: 'OWNER',
    db: { organization: { findUniqueOrThrow: async () => ({ id: 'synthetic-org' }) } },
    currentBusinessId: () => 'synthetic-business', currentLocationId: () => 'synthetic-location', currentVertical: () => 'RESTAURANT',
  });
  expect(result.user.organizationId).toBe('synthetic-org');
  expect(result.user.organization.id).toBe(result.user.organizationId);
  expect(Date.parse(result.expiresAt)).toBeGreaterThan(Date.now());
  expect(result.context).toEqual({ businessId: 'synthetic-business', locationId: 'synthetic-location', vertical: 'RESTAURANT' });
});
