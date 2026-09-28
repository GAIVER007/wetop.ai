import { describe, expect, it } from 'vitest';
import {
  RESET_CONFIRMATION,
  assertResetConfirmation,
  retainedIdentityTables,
} from './reset-to-onboarding';

describe('production reset to onboarding', () => {
  it('requires an exact explicit confirmation for apply mode', () => {
    expect(() => assertResetConfirmation(undefined)).toThrow(/RESET_CONFIRM/);
    expect(() => assertResetConfirmation('yes')).toThrow(/RESET_CONFIRM/);
    expect(() => assertResetConfirmation(RESET_CONFIRMATION)).not.toThrow();
  });

  it('retains only identity and migration tables before the targeted identity cleanup', () => {
    expect([...retainedIdentityTables].sort()).toEqual(
      ['_prisma_migrations', 'memberships', 'organizations', 'platform_admins', 'sessions', 'users'].sort(),
    );
  });
});
