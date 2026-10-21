import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  set: vi.fn(),
  refresh: vi.fn(),
  list: vi.fn(),
  me: vi.fn(),
  settings: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: state.set }) }));
vi.mock('next/cache', () => ({ revalidatePath: state.refresh }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock('../../lib/api', () => ({
  branchesApi: { list: state.list },
  authApi: { me: state.me },
  ApiError: class extends Error {},
}));
vi.mock('../../lib/hotel-api', () => ({ hotelApi: { settings: state.settings } }));
import { selectBranch, branchChoices } from './actions';
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
  ['/chessboard', '/today'],
  ['/reservations/other-branch-booking', '/today'],
  ['/guests/other-guest', '/today'],
  ['/finance?folioId=old', '/today'],
  ['https://outside.test', '/today'],
  ['//outside.test', '/today'],
])('переключение завершённого филиала ведёт на Главную из %s', async (from, expected) => {
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
  ['FOOD_SERVICE', '/today'],
  ['BEAUTY', '/today'],
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

it.each(['BEAUTY', 'FOOD_SERVICE'])(
  'MV9 shared analytics survives %s branch switch without old filters',
  async (vertical) => {
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
    form.set('returnTo', '/management/analytics?from=2026-10-01&scope=organization');
    await expect(selectBranch(form)).rejects.toThrow('redirect:/management/analytics');
  },
);

it('opens settings of an empty hotel branch without forcing inventory onboarding', async () => {
  state.list.mockResolvedValue({ items: [{ id: 'own', vertical: 'HOSPITALITY', locationId: 'location', location: { businessId: 'business' }, _count: { inventoryUnits: 0 } }] });
  const form = new FormData(); form.set('id', 'own'); form.set('returnTo', '/hotel-settings');
  await expect(selectBranch(form)).rejects.toThrow('redirect:/hotel-settings');
  expect(state.set).toHaveBeenCalledOnce();
});

it.each(['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'])(
  'SITE-1: выбор филиала %s на экране «Сайт и SEO» остаётся на экране',
  async (vertical) => {
    state.list.mockResolvedValue({
      items: [{ id: 'own', vertical, locationId: 'location', location: { businessId: 'business' }, _count: { inventoryUnits: 0 } }],
    });
    const form = new FormData();
    form.set('id', 'own');
    form.set('returnTo', '/marketing/site/editor');
    await expect(selectBranch(form)).rejects.toThrow('redirect:/marketing/site/editor');
    expect(state.set).toHaveBeenCalledWith('wetop_scope', 'business=business;location=location', expect.anything());
  },
);
