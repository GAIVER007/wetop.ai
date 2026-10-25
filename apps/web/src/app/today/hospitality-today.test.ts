import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../i18n/server', async () => ({ serverT: async () => (await import('../../i18n')).translator('ru'), currentLocale: async () => 'ru' }));

const api = vi.hoisted(() => ({
  debts: vi.fn(),
  propertyCurrency: vi.fn(),
}));
vi.mock('../../lib/api', () => ({ financeApi: { debts: api.debts } }));
vi.mock('../../lib/hotel-api', () => ({
  hotelToday: async () => '2026-10-17',
  propertyCurrency: api.propertyCurrency,
}));
vi.mock('../finance/owner-dashboard', () => ({ OwnerLoad: () => null }));
vi.mock('../finance/overview', () => ({ AttentionCard: () => null, TodayCard: () => null }));
import { HospitalityToday } from './hospitality-today';

afterEach(() => vi.resetAllMocks());

describe('hospitality home currency loading', () => {
  it('renders the independent home shell without awaiting settings when debts supplies currency', async () => {
    api.debts.mockResolvedValue({ currency: 'EUR' });
    let release!: (currency: string) => void;
    api.propertyCurrency.mockImplementation(() => new Promise<string>((resolve) => { release = resolve; }));
    const home = HospitalityToday();
    let rendered = false;
    void home.then(() => { rendered = true; });
    try {
      await vi.waitFor(() => expect(rendered).toBe(true), { timeout: 200 });
      expect(api.propertyCurrency).not.toHaveBeenCalled();
      const page = await home;
      expect(page.props.title).toBe('Главная');
      const today = page.props.children.props.children[0].props.children[1].props.children;
      expect(today.props.currency).toBe('EUR');
    } finally {
      release?.('USD');
      await home;
    }
  });

  it('waits for the actual property currency when debts fail, without substituting KZT', async () => {
    api.debts.mockRejectedValue(new Error('Synthetic debts outage'));
    let release!: (currency: string) => void;
    api.propertyCurrency.mockImplementation(() => new Promise<string>((resolve) => { release = resolve; }));
    const home = HospitalityToday();
    let rendered = false;
    void home.then(() => { rendered = true; });
    await vi.waitFor(() => expect(api.propertyCurrency).toHaveBeenCalledOnce());
    expect(rendered).toBe(false);
    release('USD');
    const page = await home;
    const today = page.props.children.props.children[0].props.children[1].props.children;
    expect(today.props.currency).toBe('USD');
  });
});
