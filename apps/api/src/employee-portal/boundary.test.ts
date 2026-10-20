import { describe, expect, it } from 'vitest';
import { profileInput, publicationInput, portfolioInput, policyInput, revision, objectInput } from './boundary';

describe('employee portal input boundary', () => {
  it('denies mass assignment instead of ignoring it', () => {
    expect(() => profileInput({ expectedProfileRevision: '2026-01-01T00:00:00.000001Z', expectedRevision: '0', userId: 'stolen' })).toThrow();
    expect(() => profileInput({ expectedProfileRevision: '2026-01-01T00:00:00.000001Z', expectedRevision: '0', published: true })).toThrow();
    expect(() => objectInput({ employeeId: 'other' }, ['serviceIds'])).toThrow();
  });
  it('validates revision and public profile fields', () => {
    expect(profileInput({ expectedProfileRevision: '2026-01-01T00:00:00.000001Z', expectedRevision: '0', headline: 'Master', practiceSinceYear: 2010 })).toEqual({ expectedProfileRevision: '2026-01-01T00:00:00.000001Z', expectedRevision: '0', headline: 'Master', practiceSinceYear: 2010 });
    expect(() => profileInput({ headline: 'No revision' })).toThrow();
    expect(() => profileInput({ expectedProfileRevision: '2026-01-01T00:00:00.000001Z', expectedRevision: '0', practiceSinceYear: 9999 })).toThrow();
    expect(() => revision('old', 'new')).toThrow();
  });
  it('never accepts truthy strings as consent or publication', () => {
    expect(() => publicationInput({ expectedRevision: '0', publicationConsent: 'true', published: true })).toThrow();
    expect(() => portfolioInput({ title: 'Work', published: 'true' })).toThrow();
    expect(publicationInput({ expectedRevision: '0', publicationConsent: false, published: false })).toMatchObject({ published: false });
  });
  it('accepts only the two approved Beauty percent bases', () => {
    expect(policyInput({ percentBasis: 'COMPLETED_SERVICES' })).toEqual({ percentBasis: 'COMPLETED_SERVICES' });
    expect(() => policyInput({ percentBasis: 'PAID_ORDERS' })).toThrow();
  });
});
