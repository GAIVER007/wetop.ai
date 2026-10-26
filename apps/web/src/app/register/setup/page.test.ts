import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ role: 'OWNER', status: vi.fn(), redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }) }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, unstable_rethrow: vi.fn() }));
vi.mock('../../../lib/api', () => ({
  sharedOnboardingApi: { status: mocks.status },
  authApi: { me: async () => ({ context: { businessId: 'business', locationId: 'location' } }) },
  onboardingApi: { status: vi.fn() }, beautyApi: { services: vi.fn(), employees: vi.fn() },
}));
vi.mock('../../login/signed-in', () => ({ signedInUser: async () => ({ role: mocks.role }) }));
vi.mock('../../../i18n/server', () => ({ cookieLocale: async () => 'ru' }));
vi.mock('./shell', () => ({ OnboardingShell: () => null }));
import SetupPage from './page';

beforeEach(() => { vi.clearAllMocks(); mocks.role = 'OWNER'; });
describe('reopen salon setup', () => {
  it('does not grant setup access to an administrator through the reopen query', async () => {
    mocks.role = 'STAFF';
    mocks.status.mockResolvedValue({ vertical: 'BEAUTY', readiness: { ready: false } });
    await expect(SetupPage({ searchParams: Promise.resolve({ entry: 'reopen' }) })).rejects.toThrow('redirect:/today');
  });
  it('allows a manager to reopen the existing checklist', async () => {
    mocks.role = 'MANAGER';
    mocks.status.mockResolvedValue({ vertical: 'BEAUTY', readiness: { ready: true }, storedFlowVersion: 2, completedFlowVersion: 2 });
    await SetupPage({ searchParams: Promise.resolve({ entry: 'reopen' }) });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('opens the existing checklist for a ready legacy salon without resetting its state', async () => {
    const state = { vertical: 'BEAUTY', readiness: { ready: true }, storedFlowVersion: 1, completedFlowVersion: 1, profileApplied: false };
    mocks.status.mockResolvedValue(state);
    const result = await SetupPage({ searchParams: Promise.resolve({ entry: 'reopen' }) });
    expect(result.props.initial).toBe(state);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it('keeps the automatic entry redirect for a ready legacy salon', async () => {
    mocks.status.mockResolvedValue({ vertical: 'BEAUTY', readiness: { ready: true }, storedFlowVersion: 1 });
    await expect(SetupPage()).rejects.toThrow('redirect:');
  });
});
