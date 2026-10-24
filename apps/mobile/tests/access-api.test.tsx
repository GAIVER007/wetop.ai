import { createAccessApi } from '../src/auth/api';
const user = {
  id: 'u',
  name: null,
  email: 'user@example.invalid',
  role: 'OWNER',
  organizationId: 'org',
};
function fake(body: unknown, status = 200) {
  return jest
    .fn()
    .mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    }) as jest.MockedFunction<typeof fetch>;
}
test('uses bearer and explicit scope, never cookies or redirect-following', async () => {
  const fetcher = fake({ user });
  await createAccessApi('https://example.invalid/api/mobile/v1', fetcher).me(
    'fixture-token',
    'business=b;location=l',
  );
  expect(fetcher).toHaveBeenCalledWith(
    'https://example.invalid/api/mobile/v1/me',
    expect.objectContaining({
      credentials: 'omit',
      redirect: 'error',
      headers: expect.objectContaining({
        Authorization: 'Bearer fixture-token',
        'X-Wetop-Scope': 'business=b;location=l',
      }),
    }),
  );
});
test('nullable server name is accepted', async () => {
  const api = createAccessApi(
    'https://example.invalid/api/mobile/v1',
    fake({ token: 'fixture', expiresAt: '2030', user }),
  );
  expect((await api.login('u', 'p')).user.name).toBeNull();
});
test('rejects nonlocal HTTP and URL credentials before sending a password', async () => {
  for (const url of ['http://example.invalid/api', 'https://user:pass@example.invalid/api']) {
    const fetcher = fake({});
    await expect(createAccessApi(url, fetcher).login('u', 'p')).rejects.toMatchObject({
      kind: 'configuration',
    });
    expect(fetcher).not.toHaveBeenCalled();
  }
});
test('does not expose raw upstream errors', async () => {
  await expect(
    createAccessApi('https://example.invalid/api', fake({ token: 'secret' }, 401)).login('u', 'p'),
  ).rejects.toMatchObject({ kind: 'unauthorized' });
});
test('rejects empty session token instead of leaving startup pending', async () => {
  await expect(
    createAccessApi(
      'https://example.invalid/api',
      fake({ token: '', expiresAt: '2030', user }),
    ).login('u', 'p'),
  ).rejects.toMatchObject({ kind: 'invalid' });
});
