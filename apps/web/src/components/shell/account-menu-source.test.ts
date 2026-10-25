import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps session logout and removes language controls from the account menu', () => {
  const source = readFileSync(new URL('./account-menu.tsx', import.meta.url), 'utf8');
  expect(source).not.toContain('LocaleSwitch');
  expect(source).toContain('action={signOut}');
});
