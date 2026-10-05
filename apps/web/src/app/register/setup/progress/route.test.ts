import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../lib/api-error';
const api = vi.hoisted(() => ({ status: vi.fn(), save: vi.fn() }));
vi.mock('../../../../lib/api', () => ({ ApiError, sharedOnboardingApi: api }));
import { GET, POST } from './route';
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
const request = (origin = 'http://127.0.0.1:55823') =>
  new Request('http://localhost:55823/register/setup/progress', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'save', draft: { businessName: 'QA' }, updatedAt: null }),
  });
it('rejects cross-origin writes before calling the guarded API', async () => {
  vi.stubEnv('APP_URL', 'http://127.0.0.1:55823');
  expect((await POST(request('https://foreign.invalid'))).status).toBe(403);
  expect(api.save).not.toHaveBeenCalled();
});
it('requires an Origin even when a session cookie would be sent', async () => {
  const r = new Request('http://localhost:55823/register/setup/progress', {
    method: 'POST',
    body: '{}',
  });
  expect((await POST(r)).status).toBe(403);
  expect(api.save).not.toHaveBeenCalled();
});
it('accepts configured public origin behind a different internal host', async () => {
  vi.stubEnv('APP_URL', 'http://127.0.0.1:55823');
  api.save.mockResolvedValue({ draft: { businessName: 'QA' } });
  expect((await POST(request())).status).toBe(200);
});
for (const status of [401, 403, 409, 503])
  it(`propagates guarded API ${status} without inventing success`, async () => {
    api.status.mockRejectedValue(new ApiError(status, 'refused'));
    const r = await GET();
    expect(r.status).toBe(status);
    const body = await r.json();
    expect(body.state).toBeUndefined();
    expect(!!body.loginUrl).toBe(status === 401);
  });
