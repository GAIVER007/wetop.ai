import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ unstable_rethrow: () => {} }));
vi.mock('../../../../lib/desk-shell', () => ({
  deskShell: async () => ({ access: { role: 'OWNER' } }),
  currentMe: async () => ({ context: { locationId: 'l', businessId: 'b' } }),
}));
vi.mock('../../../../lib/api', () => ({
  branchesApi: {
    list: async () => ({
      items: [{ locationId: 'l', name: 'Салон Пример', vertical: 'BEAUTY', timezone: 'UTC', location: { businessId: 'b' } }],
    }),
  },
}));
vi.mock('./load', () => ({
  loadBranchPeriod: async () => ({
    counts: { BOOKED: 2, CONFIRMED: 0, IN_PROGRESS: 0, DONE: 1, NO_SHOW: 0, CANCELLED: 0 },
    revenue: {},
    food: null,
  }),
}));

import { VerticalAnalytics } from './screen';

/** Аудит 21.10.2026 п.9, п.34, п.36, п.48: таблица статусов вместо плиток, поля Field, подзаголовок без названия */
describe('аналитика выбранного салона', () => {
  it('статусы таблицей, без плиток; название салона не повторяется', async () => {
    const html = renderToStaticMarkup(await VerticalAnalytics({ sp: { from: '2026-10-18', to: '2026-10-18' } }));
    expect(html).not.toContain('class="stat ');
    expect(html).toContain('Записи по статусам за период');
    expect(html).toMatch(/data-testid="period-BOOKED"[^>]*>2</);
    expect(html).not.toContain('Салон Пример');
    expect(html).toContain('class="field"');
  });
});
