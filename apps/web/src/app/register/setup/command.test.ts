import { afterEach, describe, expect, it, vi } from 'vitest';
import { committedCommand, progressRequest } from './command';
import type { SharedOnboardingState } from '../../../lib/api';
const before: SharedOnboardingState = {
  vertical: 'BEAUTY',
  businessId: 'business',
  locationId: 'location',
  flowVersion: 1,
  currentStep: 'business',
  draft: {
    businessName: 'Before',
    locationName: 'Location',
    timezone: 'Asia/Almaty',
    currency: 'KZT',
  },
  updatedAt: 'v1',
  completedAt: null,
  canEdit: true,
};
afterEach(() => vi.unstubAllGlobals());
describe('onboarding uncertain command', () => {
  it('acknowledges a saved draft after a lost response, without repeating next', () => {
    const draft = { ...before.draft, businessName: 'Saved' };
    expect(
      committedCommand(
        before,
        { ...before, updatedAt: 'v2', currentStep: 'location', draft },
        { action: 'next', draft, updatedAt: 'v1' },
      ),
    ).toBe(true);
  });
  it('never treats another writer or another branch as our commit', () => {
    const command = { action: 'save' as const, draft: before.draft, updatedAt: 'v1' };
    expect(
      committedCommand(
        before,
        { ...before, updatedAt: 'v2', draft: { businessName: 'Someone else' } },
        command,
      ),
    ).toBe(false);
    expect(
      committedCommand(before, { ...before, updatedAt: 'v2', locationId: 'foreign' }, command),
    ).toBe(false);
    expect(committedCommand(before, before, command)).toBe(false);
  });
  for (const reason of [
    new TypeError('connection refused'),
    new DOMException('timeout', 'TimeoutError'),
  ])
    it(`keeps failure distinguishable from an invalid session: ${reason.name}`, async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(reason));
      expect(await progressRequest()).toMatchObject({ status: 503 });
    });
  for (const status of [503, 409, 401, 403])
    it(`preserves API status ${status} for explicit recovery`, async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(Response.json({ error: 'refused' }, { status })),
      );
      expect(await progressRequest()).toMatchObject({ status, error: 'refused' });
    });
});
