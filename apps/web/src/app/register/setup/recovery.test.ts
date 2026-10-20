import { expect, it } from 'vitest';
import { recoveryDecision } from './command';
import type { SharedOnboardingState } from '../../../lib/api';
const before: SharedOnboardingState = { vertical: 'FOOD_SERVICE', businessId: 'synthetic-business', locationId: 'synthetic-location', flowVersion: 1, currentStep: 'business', draft: { businessName: 'Before' }, updatedAt: 'v1', completedAt: null, canEdit: true };
it('reconciles the frozen failed next even after draft/action changes', () => {
  const failed = { action: 'next' as const, draft: { businessName: 'Committed' }, updatedAt: 'v1' };
  const latest = { ...before, draft: failed.draft, currentStep: 'location', updatedAt: 'v2' };
  expect(recoveryDecision(before, latest, failed)).toBe('committed');
  expect(recoveryDecision(before, latest, { ...failed, action: 'save', draft: { businessName: 'Edited' } })).toBe('conflict');
});
it.each(['businessId', 'locationId', 'flowVersion', 'vertical'] as const)('refuses foreign %s even with an unchanged version', (key) => {
  const latest = { ...before, [key]: key === 'flowVersion' ? 2 : 'foreign' } as SharedOnboardingState;
  expect(recoveryDecision(before, latest, { action: 'save', draft: before.draft, updatedAt: 'v1' })).toBe('conflict');
});
it('only permits a new deliberate write when guarded read proves no version change', () => {
  expect(recoveryDecision(before, before, { action: 'save', draft: before.draft, updatedAt: 'v1' })).toBe('uncommitted');
});
