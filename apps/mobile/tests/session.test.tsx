import { SessionController } from '../src/auth/session';
import { AccessError, type AccessApi, type TokenStore } from '../src/auth/contracts';
const user = {
  id: 'user-01',
  name: 'Test User',
  email: 'test@example.invalid',
  role: 'OWNER',
  organizationId: 'org-01',
};
const branch = {
  id: 'branch-01',
  name: 'Test Branch',
  currency: 'KZT',
  timezone: 'Asia/Almaty',
  vertical: 'FOOD_SERVICE',
  locationId: 'loc-01',
  location: { businessId: 'biz-01' },
};
function fixture() {
  const store: jest.Mocked<TokenStore> = {
    read: jest.fn().mockResolvedValue(null),
    write: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  };
  const api: jest.Mocked<AccessApi> = {
    login: jest.fn().mockResolvedValue({ token: 'fixture-token', expiresAt: '2030-01-01', user }),
    me: jest.fn().mockResolvedValue({
      user,
      context: { businessId: 'biz-01', locationId: 'loc-01', vertical: 'FOOD_SERVICE' },
    }),
    branches: jest.fn().mockResolvedValue({ items: [branch] }),
    organizations: jest
      .fn()
      .mockResolvedValue([
        { id: 'org-01', name: 'Test Organization', role: 'OWNER', current: true },
      ]),
    switchOrganization: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
    food: jest.fn(),
    report: jest.fn(),
    staffRevenue: jest.fn(),
    reset: jest.fn().mockResolvedValue(undefined),
  };
  return { api, store, session: new SessionController(api, store) };
}
test('stored token is not enough: null user clears it and cannot enter workspace', async () => {
  const { session, api, store } = fixture();
  store.read.mockResolvedValue('old');
  api.me.mockResolvedValue({ user: null });
  await session.start();
  expect(session.state.kind).toBe('signed-out');
  expect(store.clear).toHaveBeenCalled();
});
test('login persists token and verifies exact branch before ready', async () => {
  const { session, api, store } = fixture();
  await session.login('test@example.invalid', 'fixture');
  expect(store.write).toHaveBeenCalledWith('fixture-token');
  expect(api.me).toHaveBeenLastCalledWith('fixture-token', 'business=biz-01;location=loc-01');
  expect(session.state.kind).toBe('ready');
  expect(JSON.stringify(session.state)).not.toContain('fixture-token');
});
test('multiple branches require selection and reject an unlisted branch', async () => {
  const { session, api } = fixture();
  api.branches.mockResolvedValue({ items: [branch, { ...branch, locationId: 'loc-02' }] });
  await session.login('test@example.invalid', 'fixture');
  expect(session.state.kind).toBe('choose');
  await session.choose('foreign');
  expect(session.state.kind).toBe('choose');
  await session.choose('loc-01');
  expect(session.state.kind).toBe('ready');
});
test('storage failure never opens workspace', async () => {
  const { session, store } = fixture();
  store.write.mockRejectedValue(new Error('storage'));
  await session.login('test@example.invalid', 'fixture');
  expect(session.state.kind).not.toBe('ready');
});
test('network failure retains no ready workspace and supports retry', async () => {
  const { session, api, store } = fixture();
  store.read.mockResolvedValue('saved');
  api.me.mockRejectedValueOnce(new AccessError('network'));
  await session.start();
  expect(session.state.kind).toBe('error');
  await session.retry();
  expect(session.state.kind).toBe('ready');
});
test('late login after logout cannot restore token or workspace', async () => {
  const { session, api, store } = fixture();
  let resolve!: (value: Awaited<ReturnType<AccessApi['login']>>) => void;
  api.login.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const pending = session.login('test@example.invalid', 'fixture');
  await session.logout();
  resolve({ token: 'late-token', expiresAt: '2030', user });
  await pending;
  expect(session.state.kind).toBe('signed-out');
  expect(store.write).not.toHaveBeenCalled();
  expect(api.logout).toHaveBeenCalledWith('late-token');
});
test('duplicate login tap sends one request', async () => {
  const { session, api } = fixture();
  await Promise.all([
    session.login('test@example.invalid', 'fixture'),
    session.login('test@example.invalid', 'fixture'),
  ]);
  expect(api.login).toHaveBeenCalledTimes(1);
});
test('server rejects selected scope: never opens workspace', async () => {
  const { session, api } = fixture();
  api.me
    .mockResolvedValueOnce({ user })
    .mockResolvedValue({ user, context: { businessId: null, locationId: null, vertical: null } });
  await session.login('test@example.invalid', 'fixture');
  expect(session.state.kind).not.toBe('ready');
});
test('logout failure reports local-only logout', async () => {
  const { session, api } = fixture();
  await session.login('test@example.invalid', 'fixture');
  api.logout.mockRejectedValue(new AccessError('network'));
  await session.logout();
  expect(session.state.kind).toBe('signed-out');
  expect(session.state.message).toMatch(/сервер/);
});
test('organization rotation persists new token before requesting context', async () => {
  const { session, api, store } = fixture();
  api.organizations.mockResolvedValue([
    { id: 'org-01', name: 'One', role: 'OWNER', current: true },
    { id: 'org-02', name: 'Two', role: 'OWNER', current: false },
  ]);
  await session.login('test@example.invalid', 'fixture');
  api.switchOrganization.mockResolvedValue({ token: 'rotated', expiresAt: '2030', user });
  await session.switchOrganization('org-02');
  expect(store.write).toHaveBeenLastCalledWith('rotated');
  expect(api.branches).toHaveBeenLastCalledWith('rotated');
});

test('personal account with multiple locations must choose its workplace', async () => {
  const { session, api } = fixture();
  api.branches.mockResolvedValue({
    personal: true,
    items: [branch, { ...branch, locationId: 'loc-02' }],
  });
  await session.login('test@example.invalid', 'fixture');
  expect(session.state.kind).toBe('choose');
});

test('food reads use verified scope and reject a late response after branch selection starts', async () => {
  const { session, api } = fixture();
  await session.login('test@example.invalid', 'fixture');
  let finish!: (v: unknown) => void;
  api.food.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const response = session.readFood('tables');
  expect(api.food).toHaveBeenCalledWith(
    'fixture-token',
    'business=biz-01;location=loc-01',
    'tables',
    undefined,
  );
  await session.changeBranch();
  finish({ tables: [] });
  await expect(response).rejects.toThrow();
});
test('food unauthorized response clears local access', async () => {
  const { session, api, store } = fixture();
  await session.login('test@example.invalid', 'fixture');
  api.food.mockRejectedValue(new AccessError('unauthorized'));
  await expect(session.readFood('orders')).rejects.toThrow();
  expect(session.state.kind).toBe('signed-out');
  expect(store.clear).toHaveBeenCalled();
});

test('report uses verified scope and rejects a late answer after branch change', async () => {
  const { session, api } = fixture();
  await session.login('test@example.invalid', 'fixture');
  let finish!: (v: unknown) => void;
  api.report.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  const response = session.readReport('analytics', '2026-10-24', '2026-10-24');
  expect(api.report).toHaveBeenCalledWith(
    'fixture-token',
    'business=biz-01;location=loc-01',
    'analytics',
    '2026-10-24',
    '2026-10-24',
  );
  await session.changeBranch();
  finish({});
  await expect(response).rejects.toThrow();
});
