import { beforeEach, describe, expect, it, vi } from 'vitest';
const vertical = vi.hoisted(() => ({ value: 'BEAUTY' }));
vi.mock('../../lib/vertical-guard', () => ({
  requireFeature: vi.fn(async () => ({ context: { vertical: vertical.value } })),
}));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  unstable_rethrow: () => {},
}));
import ReportsHubPage from './page';
beforeEach(() => {
  vertical.value = 'BEAUTY';
});
describe('salon reports canonical route', () => {
  it('renders a dedicated salon reports screen and keeps the requested period', async () => {
    const params = { from: '2026-10-01', to: '2026-10-18' };
    const result = await ReportsHubPage({ searchParams: Promise.resolve(params) });
    expect(result).toMatchObject({ props: { searchParams: params } });
    expect((result.type as { name?: string }).name).toBe('SalonReportsScreen');
  });
  it('keeps restaurant routing unchanged', async () => {
    vertical.value = 'FOOD_SERVICE';
    await expect(ReportsHubPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/restaurant-finance',
    );
  });
});
