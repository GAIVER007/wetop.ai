import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { day } = vi.hoisted(() => ({ day: vi.fn() }));
vi.mock('../../lib/vertical-guard', () => ({ requireVertical: async () => ({}), requireFeature: async () => ({}) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace() {} }), useSearchParams: () => new URLSearchParams() }));
// оболочка как у настоящей: права нужны странице (возврат по записи, §54)
vi.mock('../../lib/desk-shell', async () => {
  const { UNKNOWN_SHELL } = await import('../../lib/desk-person');
  return {
    deskShell: async () => ({ ...UNKNOWN_SHELL, readOnly: false }),
    currentMe: async () => ({ user: { organizationId: 'synthetic-org' }, context: { businessId: 'synthetic-salon', locationId: 'salon' } }),
  };
});
vi.mock('../../lib/api', () => ({ beautyApi: {
  day, customers: async () => ({ items: [] }), employees: async () => ({ items: [] }),
} }));
vi.mock('./journal', () => ({ JournalBoard: () => createElement('div', null, 'Журнал дня') }));
const prefetchFlags: unknown[] = [];
vi.mock('next/link', () => ({
  default: ({ prefetch, ...props }: { prefetch?: boolean; href: string; children?: unknown }) => {
    prefetchFlags.push(prefetch);
    return createElement('a', props as Record<string, unknown>);
  },
}));
import BeautyPage from './page';

beforeEach(() => {
  day.mockReset();
  day.mockImplementation(async (date = '2026-10-14') => ({
    date, location: { id: 'salon', name: 'Тестовый салон', timezone: 'Asia/Almaty', currency: 'KZT' },
    columns: [], appointments: [], services: [], bounds: { fromMinutes: 540, toMinutes: 1080 },
  }));
});

describe('Недельный календарь салона', () => {
  it('загружает каждый день с понедельника по воскресенье и показывает недельный обзор', async () => {
    const html = renderToStaticMarkup(await BeautyPage({ searchParams: Promise.resolve({ date: '2026-10-14', view: 'week' }) }));
    expect(day.mock.calls.map(([date]) => date)).toEqual([
      '2026-10-14', '2026-10-12', '2026-10-13', '2026-10-15',
      '2026-10-16', '2026-10-17', '2026-10-18',
    ]);
    expect(html).toContain('data-testid="beauty-week"');
    expect(html).toContain('/calendar?date=2026-10-12');
  });
  it('День и Неделя без предзагрузки: на живом сайте она висела и страница не затихала (аудит 21.10.2026, п. 3)', async () => {
    const html = renderToStaticMarkup(await BeautyPage({ searchParams: Promise.resolve({ date: '2026-10-14', view: 'week' }) }));
    const views = html.slice(html.indexOf('aria-label="Вид журнала"'));
    expect(views).toContain('>День<');
    expect(prefetchFlags.filter((flag) => flag === false).length).toBeGreaterThanOrEqual(2);
  });
  it('обычный день не загружает всю неделю', async () => {
    const html = renderToStaticMarkup(await BeautyPage({ searchParams: Promise.resolve({ date: '2026-10-14' }) }));
    expect(day).toHaveBeenCalledTimes(1);
    expect(html).toContain('Журнал дня');
  });
});
