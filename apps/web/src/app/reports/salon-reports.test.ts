import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BeautyPositionAccess } from '@pms/domain';
const state = vi.hoisted(() => ({
  role: 'OWNER',
  branch: { vertical: 'BEAUTY', timezone: 'Asia/Almaty', name: 'Салон Пример', locationId: 'l' },
  fail: false,
  beautyAccess: undefined as BeautyPositionAccess | undefined,
}));
const load = vi.hoisted(() => vi.fn());
const select = vi.hoisted(() => vi.fn());
vi.mock('../../lib/desk-shell', () => ({
  deskShell: async () => ({ access: { role: state.role, beautyAccess: state.beautyAccess } }),
}));
vi.mock('../../lib/workspace-context', () => ({ selectedWorkspaceBranch: select }));
vi.mock('./salon-report-data', () => ({ loadSalonReport: load }));
vi.mock('next/navigation', () => ({ unstable_rethrow: () => {} }));
vi.mock('../../i18n/server', async () => ({ serverT: async () => (await import('../../i18n')).translator('ru'), currentLocale: async () => 'ru' }));
import { SalonReportsScreen } from './salon-reports';
beforeEach(() => {
  state.role = 'OWNER';
  state.beautyAccess = undefined;
  select.mockReset().mockResolvedValue(state.branch);
  load
    .mockReset()
    .mockResolvedValue({
      counts: { DONE: 1, BOOKED: 0, CONFIRMED: 0, IN_PROGRESS: 0, NO_SHOW: 0, CANCELLED: 0 },
      currencies: [{ currency: 'KZT', visits: 1, costMinor: '1600000' }],
      services: [
        {
          id: 's',
          name: 'Услуга Пример',
          currency: 'KZT',
          visits: 1,
          services: 2,
          costMinor: '1600000',
        },
      ],
      masters: [
        {
          id: 'e',
          name: 'Мастер Пример',
          currency: 'KZT',
          visits: 1,
          services: 2,
          costMinor: '1600000',
        },
      ],
    });
});
describe('итоги отчёта салона строкой, без плиток (правило владельца 21.10.2026)', () => {
  it('одна строка итогов, без kpi-tile; статусы с числами', async () => {
    const html = renderToStaticMarkup(
      await SalonReportsScreen({ searchParams: { from: '2026-10-18', to: '2026-10-18' } }),
    );
    expect(html).not.toContain('kpi-tile');
    expect(html).toContain('data-testid="salon-report-summary"');
    expect(html).toMatch(/data-testid="salon-report-cost-KZT"[^>]*>16\s000/);
    expect(html).toContain('завершённых записей <b>1</b>');
    expect(html).toContain('специалистов <b>1</b>');
    expect(html).toMatch(/data-testid="salon-report-status-DONE"[^>]*>1</);
  });
});
describe('отчёты салона, вариант B владельца 26.10.2026', () => {
  it('слева список отчётов с подписями, текущий отмечен; справа один отчёт', async () => {
    const html = renderToStaticMarkup(
      await SalonReportsScreen({ searchParams: { from: '2026-10-18', to: '2026-10-18', view: 'services' } }),
    );
    expect(html).toContain('class="salon-reports__menu"');
    expect(html).toMatch(/aria-current="page"[^>]*>Услуги</);
    expect(html).toContain('что продаётся');
    expect(html).toContain('Записи периода');
    expect(html).not.toContain('salon-reports__trio');
  });
});
describe('salon report server permission boundary', () => {
  it('renders actual service and employee breakdowns without payment claims', async () => {
    const html = renderToStaticMarkup(
      await SalonReportsScreen({ searchParams: { from: '2026-10-18', to: '2026-10-18' } }),
    );
    expect(html).toContain('Услуга Пример');
    expect(html).toContain('Стоимость оказанных услуг');
    expect(html).toContain('не равна полученным оплатам');
    expect(html).toContain('view=team');
    const team = renderToStaticMarkup(
      await SalonReportsScreen({
        searchParams: { from: '2026-10-18', to: '2026-10-18', view: 'team' },
      }),
    );
    expect(team).toContain('Мастер Пример');
  });
  it.each(['', 'UNKNOWN'])('does not fetch report data for denied role %s', async (role) => {
    state.role = role;
    const html = renderToStaticMarkup(await SalonReportsScreen({ searchParams: {} }));
    expect(html).toContain('Нет доступа к отчётам');
    expect(select).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    'denies assigned or revoked positions before fetching, assigned=%s',
    async (assigned) => {
      state.role = 'STAFF';
      state.beautyAccess = {
        mode: 'ASSIGNED',
        assigned,
        permissions: [
          { section: 'finance', action: 'view', scope: 'BUSINESS' },
          { section: 'journal', action: 'view', scope: 'BUSINESS' },
        ],
      };
      const html = renderToStaticMarkup(await SalonReportsScreen({ searchParams: {} }));
      expect(html).toContain('Нет доступа к отчётам');
      expect(select).not.toHaveBeenCalled();
      expect(load).not.toHaveBeenCalled();
    },
  );
  it('formats historical currencies with zero and three minor digits without conversion', async () => {
    load.mockResolvedValue({
      counts: { DONE: 2 },
      currencies: [
        { currency: 'JPY', visits: 1, costMinor: '123' },
        { currency: 'KWD', visits: 1, costMinor: '1234' },
      ],
      services: [],
      masters: [],
    });
    const html = renderToStaticMarkup(
      await SalonReportsScreen({ searchParams: { view: 'services' } }),
    );
    expect(html).toContain('123 JPY');
    expect(html).toContain('1,234 KWD');
  });
  it('does not fetch or substitute an invalid period', async () => {
    const html = renderToStaticMarkup(
      await SalonReportsScreen({ searchParams: { from: '2026-02-30', to: '2026-03-01' } }),
    );
    expect(html).toContain('Не удалось построить отчёт');
    expect(load).not.toHaveBeenCalled();
  });
  it('fails closed without partial values after API failure', async () => {
    load.mockRejectedValue(new Error('Forbidden'));
    const html = renderToStaticMarkup(await SalonReportsScreen({ searchParams: {} }));
    expect(html).toContain('Не удалось построить отчёт');
    expect(html).not.toContain('Услуга Пример');
  });
});
