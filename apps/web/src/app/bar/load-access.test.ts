import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  categories: vi.fn(), stock: vi.fn(), suppliers: vi.fn(), folios: vi.fn(), receipts: vi.fn(),
  sales: vi.fn(), movements: vi.fn(), report: vi.fn(), paymentMethods: vi.fn(),
}));
const kitchen = vi.hoisted(() => ({ products: vi.fn() }));

vi.mock('next/navigation', () => ({
  unstable_rethrow() {},
  useRouter: () => ({ refresh() {}, replace() {}, push() {} }),
}));
vi.mock('../../lib/vertical-guard', () => ({
  requireFeature: async () => ({ context: { vertical: 'BEAUTY' } }),
}));
vi.mock('../../lib/api', () => ({ barApi: api }));
vi.mock('../../lib/food-api', () => ({ stockApi: kitchen }));
vi.mock('../../lib/hotel-api', () => ({
  hotelToday: async () => '2026-10-18',
  propertyTimezone: async () => 'UTC',
}));
vi.mock('../../lib/desk-shell', () => ({
  deskShell: async () => ({
    vertical: 'BEAUTY', readOnly: false,
    access: {
      aiSeller: false, platform: false, role: 'STAFF',
      beautyAccess: {
        mode: 'ASSIGNED', assigned: true,
        permissions: [{ section: 'stock', action: 'view', scope: 'BUSINESS' }],
      },
    },
  }),
}));
vi.mock('./load-context', () => ({
  loadBarContext: async () => ({ propertyId: 'synthetic-location', currency: 'USD' }),
}));
vi.mock('./tabs', () => ({ BarTabs: () => null }));
vi.mock('./stock-board', () => ({ StockBoard: () => createElement('div', null, 'goods') }));
vi.mock('./bar-analytics', () => ({ BarAnalytics: () => null }));
vi.mock('./analytics-disclosure', () => ({ AnalyticsDisclosure: ({ children }: { children: unknown }) => children }));
vi.mock('./sale-disclosure', () => ({ SaleDisclosure: ({ children }: { children: unknown }) => children }));

import BarPage from './page';

describe('Beauty goods loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kitchen.products.mockResolvedValue({ items: [] });
    api.categories.mockResolvedValue([]);
    api.stock.mockResolvedValue([]);
    api.suppliers.mockResolvedValue([]);
    api.folios.mockRejectedValue(new Error('Hotel folios must not load'));
    api.receipts.mockResolvedValue([]);
    api.sales.mockResolvedValue([]);
    api.movements.mockResolvedValue([]);
    api.report.mockResolvedValue({
      currency: 'USD', purchasesMinor: '0', revenueMinor: '0', grossProfitMinor: '0',
      supplierDebtMinor: '0', popular: [],
    });
    api.paymentMethods.mockResolvedValue({ sale: [], supplier: [] });
  });

  it('loads stock method labels but never hotel folios for a read-only stock position', async () => {
    const html = renderToStaticMarkup(await BarPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('Товары, остатки и продажи');
    expect(api.folios).not.toHaveBeenCalled();
    expect(api.paymentMethods).toHaveBeenCalledOnce();
    expect(html).not.toContain('Продажа напрямую');
  });
});
