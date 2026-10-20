import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Source contract only: actual pending transitions are exercised by tests/ui/confirm-helper.spec.ts.
describe('confirmation helper terminal outcomes', () => {
  const source = readFileSync('tests/e2e/confirm.ts', 'utf8');
  it('does not treat a renamed pending button as completion', () => {
    expect(source).not.toContain("await expect(dialog.getByRole('button', { name: button, exact: true })).toHaveCount(0)");
    expect(source).toContain('previousAlerts');
    expect(source).toContain("button === 'Выселить'");
    expect(source).toContain('await next.isEnabled()');
    expect(source).toContain("throw new Error(outcome)");
  });
});
