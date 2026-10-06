import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ set: vi.fn(), refresh: vi.fn(), list: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: state.set }) }));
vi.mock('next/cache', () => ({ revalidatePath: state.refresh }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock('../../lib/api', () => ({
  branchesApi: { list: state.list },
  ApiError: class extends Error {},
}));
import { selectBranch } from './actions';
beforeEach(() => {
  vi.clearAllMocks();
  state.list.mockResolvedValue({
    items: [
      {
        id: 'own',
        vertical: 'HOSPITALITY',
        locationId: 'location',
        location: { businessId: 'business' },
        _count: { inventoryUnits: 2 },
      },
    ],
  });
});
it.each([
  ['/chessboard', '/chessboard'],
  ['/reservations/other-branch-booking', '/reservations'],
  ['/guests/other-guest', '/guests'],
  ['/finance?folioId=old', '/finance'],
  ['https://outside.test', '/today'],
  ['//outside.test', '/today'],
])('переключение сохраняет безопасный раздел %s', async (from, expected) => {
  const form = new FormData();
  form.set('id', 'own');
  form.set('returnTo', from);
  await expect(selectBranch(form)).rejects.toThrow(`redirect:${expected}`);
  expect(state.set).toHaveBeenCalledOnce();
  expect(state.refresh).toHaveBeenCalledWith('/', 'layout');
});
it('чужой филиал не меняет cookie', async () => {
  const form = new FormData();
  form.set('id', 'foreign');
  await expect(selectBranch(form)).rejects.toThrow('Филиал недоступен');
  expect(state.set).not.toHaveBeenCalled();
});

it.each([
  ['FOOD_SERVICE', '/floor-plan'],
  ['BEAUTY', '/calendar'],
])(
  'canonical landing for verified %s branch ignores old vertical route',
  async (vertical, expected) => {
    state.list.mockResolvedValue({
      items: [
        {
          id: 'own',
          vertical,
          locationId: 'location',
          location: { businessId: 'business' },
          _count: { inventoryUnits: 0 },
        },
      ],
    });
    const form = new FormData();
    form.set('id', 'own');
    form.set('returnTo', '/chessboard');
    await expect(selectBranch(form)).rejects.toThrow(`redirect:${expected}`);
    expect(state.set).toHaveBeenCalledOnce();
  },
);
