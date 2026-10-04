import { describe, expect, it } from 'vitest';
import { onboardingFlow, moveOnboarding } from './registry';

describe('MV3 onboarding adapters', () => {
  it('uses canonical vertical and fails closed for URL garbage', () => {
    expect(() => onboardingFlow('restaurant')).toThrow();
    expect(() => onboardingFlow(undefined)).toThrow();
    expect(onboardingFlow('HOSPITALITY').steps.map((s) => s.id)).toEqual(['hotel']);
  });
  it.each(['BEAUTY', 'FOOD_SERVICE'])('%s has shared steps only', (vertical) => {
    const flow = onboardingFlow(vertical);
    expect(flow.steps.map((s) => s.id)).toEqual(['business', 'location', 'review']);
    expect(flow.steps.every((s) => !s.skippable)).toBe(true);
  });
  it('moves forward and back without permitting unknown or forbidden skip', () => {
    const flow = onboardingFlow('BEAUTY');
    expect(moveOnboarding(flow, 'business', 'next')).toBe('location');
    expect(moveOnboarding(flow, 'location', 'back')).toBe('business');
    expect(moveOnboarding(flow, 'business', 'back')).toBe('business');
    expect(() => moveOnboarding(flow, 'location', 'skip')).toThrow();
    expect(() => moveOnboarding(flow, 'tables', 'next')).toThrow();
    expect(moveOnboarding(flow, 'review', 'next')).toBe('review');
  });
  it('only existing Hospitality postponement can be skipped', () => {
    expect(onboardingFlow('HOSPITALITY').steps[0]!.skippable).toBe(true);
  });
});
