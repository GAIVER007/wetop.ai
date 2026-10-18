import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../lib/api-error';
const api = vi.hoisted(() => ({ status: vi.fn(), save: vi.fn() }));
vi.mock('../../../../lib/api', () => ({ ApiError, sharedOnboardingApi: api }));
import { GET, POST } from './route';
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

for (const body of [
  'null', '[]', '{', '{"action":"delete","draft":{},"updatedAt":null}',
  '{"action":"save","draft":[],"updatedAt":null}',
  ...[['save'], {}, { toString: null }, null, 7].map((action) =>
    JSON.stringify({ action, draft: {}, updatedAt: null })),
])
  it(`rejects malformed command ${body} without calling API`, async () => {
    vi.stubEnv('APP_URL', 'http://127.0.0.1:55843');
    const r = await POST(new Request('http://localhost:55843/register/setup/progress', {
      method: 'POST', headers: { origin: 'http://127.0.0.1:55843', 'content-type': 'application/json' }, body,
    }));
    expect(r.status).toBe(400);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(api.save).not.toHaveBeenCalled();
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
it('rejects oversized JSON before calling the API', async () => {
  vi.stubEnv('APP_URL', 'http://127.0.0.1:55823');
  const r = new Request('http://localhost:55823/register/setup/progress', {
    method: 'POST',
    headers: { origin: 'http://127.0.0.1:55823', 'content-type': 'application/json' },
    body: JSON.stringify({ draft: { text: 'x'.repeat(128 * 1024) } }),
  });
  expect((await POST(r)).status).toBe(413);
  expect(api.save).not.toHaveBeenCalled();
});
it('rejects unsupported body format before calling the API', async () => {
  vi.stubEnv('APP_URL', 'http://127.0.0.1:55823');
  const r = new Request('http://localhost:55823/register/setup/progress', {
    method: 'POST',
    headers: { origin: 'http://127.0.0.1:55823', 'content-type': 'text/plain' },
    body: '{}',
  });
  expect((await POST(r)).status).toBe(415);
  expect(api.save).not.toHaveBeenCalled();
});
