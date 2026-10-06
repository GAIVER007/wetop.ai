import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { branchesApi } from '../../../lib/api';
import { ApiError } from '../../../lib/api-error';

const jar = vi.hoisted(() => ({
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(() => undefined),
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
