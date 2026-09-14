import { describe, expect, it, vi } from 'vitest';

const notFound = vi.fn(() => {
  throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
});
vi.mock('next/navigation', () => ({ notFound }));

const { developmentOnly } = await import('./dev-only');

describe('developmentOnly — страница /design-system закрыта в production', () => {
  it('в production бросает notFound', () => {
    expect(() => developmentOnly('production')).toThrow(/404/);
    expect(notFound).toHaveBeenCalledTimes(1);
  });
  it('в development и test ничего не делает', () => {
    notFound.mockClear();
    expect(() => developmentOnly('development')).not.toThrow();
    expect(() => developmentOnly('test')).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });
});
