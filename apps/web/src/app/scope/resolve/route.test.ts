import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { authApi, branchesApi } from '../../../lib/api';
import { ApiError } from '../../../lib/api-error';

const jar = vi.hoisted(() => ({
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn((name: string): { value: string } | undefined => (name ? undefined : undefined)),
}));
vi.mock('next/headers', () => ({ cookies: async () => jar }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { to });
  },
}));

const { GET } = await import('./route');

const B = '11111111-1111-4111-8111-111111111111';
const L = '22222222-2222-4222-8222-222222222222';
const item = (vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE', locationId = L) =>
  ({ id: locationId, vertical, locationId, location: { businessId: B } }) as never;
const run = async (next: string) => {
  try {
    await GET(new Request(`https://app.wetop.ai/scope/resolve?next=${encodeURIComponent(next)}`));
  } catch (error) {
    return (error as { to?: string }).to;
  }
  return undefined;
};
beforeEach(() => {
  jar.set.mockClear();
  jar.delete.mockClear();
  jar.get.mockReset();
  jar.get.mockReturnValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

it('сначала снимает прежний указатель, затем ставит единственный филиал и ведёт в его раздел', async () => {
  vi.spyOn(branchesApi, 'list').mockResolvedValue({ items: [item('FOOD_SERVICE')] } as never);
  expect(await run('/table-reservations')).toBe('/table-reservations');
  expect(jar.delete).toHaveBeenCalledWith('wetop_scope');
  expect(jar.set).toHaveBeenCalledWith(
    'wetop_scope',
    `business=${B};location=${L}`,
    expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
  );
});

it('несколько филиалов: указатель не ставится, человек выбирает на /branches', async () => {
  vi.spyOn(branchesApi, 'list').mockResolvedValue({
    items: [item('HOSPITALITY'), item('BEAUTY', '33333333-3333-4333-8333-333333333333')],
  } as never);
  expect(await run('/today')).toBe('/branches');
  expect(jar.delete).toHaveBeenCalledWith('wetop_scope');
  expect(jar.set).not.toHaveBeenCalled();
});

it('нет филиалов: прежний путь настройки', async () => {
  vi.spyOn(branchesApi, 'list').mockResolvedValue({ items: [] } as never);
  expect(await run('/today')).toBe('/onboarding');
  expect(jar.set).not.toHaveBeenCalled();
});

it('без сессии: на вход, указатель не ставится', async () => {
  vi.spyOn(branchesApi, 'list').mockRejectedValue(new ApiError(401, 'Сессия истекла'));
  expect(await run('/today')).toMatch(/#login$/);
  expect(jar.set).not.toHaveBeenCalled();
});

it('несколько филиалов: последний выбранный на этом устройстве выбирается сам и запоминается снова', async () => {
  const L2 = '33333333-3333-4333-8333-333333333333';
  vi.spyOn(branchesApi, 'list').mockResolvedValue({
    items: [item('HOSPITALITY'), item('BEAUTY', L2)],
  } as never);
  jar.get.mockImplementation((name: string) => (name === 'wetop_last_branch' ? { value: L } : undefined));
  expect(await run('/finance')).toBe('/finance');
  expect(jar.set).toHaveBeenCalledWith('wetop_scope', `business=${B};location=${L}`, expect.any(Object));
  expect(jar.set).toHaveBeenCalledWith(
    'wetop_last_branch',
    L,
    expect.objectContaining({ httpOnly: true, path: '/', maxAge: expect.any(Number) }),
  );
});

it('«Личный кабинет» (personal): несколько филиалов, первый выбирается сам и ведёт в «Мою работу»', async () => {
  const L2 = '33333333-3333-4333-8333-333333333333';
  vi.spyOn(branchesApi, 'list').mockResolvedValue({
    items: [item('BEAUTY'), item('BEAUTY', L2)],
    personal: true,
  } as never);
  expect(await run('/today')).toBe('/my-work');
  expect(jar.set).toHaveBeenCalledWith('wetop_scope', `business=${B};location=${L}`, expect.any(Object));
});

/**
 * Главный администратор WETOP (владелец 29.10.2026: «чтобы я под почтой вошёл и видел всё, что должно быть у админа»):
 * вход без своего адреса ведёт в кабинет компании, а не в стойку клиента. Свой адрес (`next`) остаётся как был.
 */
it('главный администратор: вход по умолчанию в кабинет WETOP, указатель филиала не ставится', async () => {
  vi.spyOn(branchesApi, 'list').mockResolvedValue({ items: [item('HOSPITALITY')] } as never);
  vi.spyOn(authApi, 'me').mockResolvedValue({ user: { platformAdmin: true } } as never);
  expect(await run('/today')).toBe('/platform/cabinet');
  expect(jar.set).not.toHaveBeenCalled();
});

it('главный администратор со своим адресом: идёт туда, как все', async () => {
  vi.spyOn(branchesApi, 'list').mockResolvedValue({ items: [item('HOSPITALITY')] } as never);
  vi.spyOn(authApi, 'me').mockResolvedValue({ user: { platformAdmin: true } } as never);
  expect(await run('/reservations')).toBe('/reservations');
});

it('владелец организации: вход по умолчанию в свою стойку, как раньше', async () => {
  vi.spyOn(branchesApi, 'list').mockResolvedValue({ items: [item('HOSPITALITY')] } as never);
  vi.spyOn(authApi, 'me').mockResolvedValue({ user: { platformAdmin: false } } as never);
  expect(await run('/today')).not.toBe('/platform/cabinet');
});
