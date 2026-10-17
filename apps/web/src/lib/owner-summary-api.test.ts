import { it, expect, vi } from 'vitest';
vi.mock('./api', () => ({ getJsonPublic: vi.fn() }));
import { getJsonPublic } from './api';
import { readOwnerSummary } from './owner-summary-api';
import { ownerSummaryEnabled } from './owner-summary';
it('rollout is default off', () => {
  expect(ownerSummaryEnabled(undefined)).toBe(false);
  expect(ownerSummaryEnabled('1')).toBe(false);
  expect(ownerSummaryEnabled('true')).toBe(true);
});
it('API errors reject, never fallback empty', async () => {
  vi.mocked(getJsonPublic).mockRejectedValueOnce(new Error('forbidden'));
  await expect(readOwnerSummary('week')).rejects.toThrow('forbidden');
  expect(getJsonPublic).toHaveBeenCalledWith('/owner-summary?period=week');
});
