import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BarOperationsPage from './page';
import { branchesApi, barApi } from '../../../lib/api';
import { currentMe, deskShell } from '../../../lib/desk-shell';
import { propertyTimezone } from '../../../lib/hotel-api';
import { FALLBACK_TIMEZONE, propertyClock } from '../../../lib/property-time';

vi.mock('../../../lib/vertical-guard', () => ({ requireFeature: vi.fn() }));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
vi.mock('../../../i18n/server', async () => ({ serverT: async () => (await import('../../../i18n')).translator('ru'), currentLocale: async () => 'ru' }));
vi.mock('../../../lib/desk-shell', () => ({ currentMe: vi.fn(), deskShell: vi.fn() }));
vi.mock('../../../lib/api', () => ({ barApi: { stock: vi.fn(), sales: vi.fn(), movements: vi.fn(), paymentMethods: vi.fn(async () => ({ sale: ['CASH'] })) }, branchesApi: { list: vi.fn() } }));
vi.mock('../../../lib/hotel-api', () => ({ propertyTimezone: vi.fn() }));
vi.mock('../load-context', () => ({ loadBarContext: vi.fn(async () => ({ propertyId: 'synthetic-property', currency: 'KZT' })) }));
vi.mock('../return-buttons', () => ({ BarReturnButtons: () => null }));
vi.mock('../write-off-form', () => ({ WriteOffForm: () => null }));
vi.mock('../inventory-count-form', () => ({ InventoryCountForm: () => null }));
vi.mock('../sale-form', () => ({ SaleForm: () => null }));
vi.mock('./movement-filters', () => ({ MovementFilters: () => null }));
vi.mock('../catalog-dialog', () => ({ CatalogDialog: ({ label, children }: { label: string; children: ReactNode }) => createElement('div', { 'data-dialog': label }, children) }));
vi.mock('../tabs', () => ({ BarTabs: () => null }));

// Inspect actual React elements returned by the real server page, including each Tabs panel.
// No replacement date expression, formatter or workspace selector is used.
function cells(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(cells);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  if (node.type === 'td' && typeof node.props.children === 'string') return [node.props.children];
  return cells(node.props.children);
}
const instant = '2026-10-17T12:30:00Z';
function shell(vertical = 'FOOD_SERVICE', unknown = false) {
  vi.mocked(deskShell).mockResolvedValue({ vertical, readOnly: true, access: { unknown } } as Awaited<ReturnType<typeof deskShell>>);
}
describe('real BAR journal page and workspace timezone wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks(); shell();
    vi.mocked(currentMe).mockResolvedValue({ context: { vertical: 'FOOD_SERVICE', businessId: 'business', locationId: 'location' } } as Awaited<ReturnType<typeof currentMe>>);
    vi.mocked(barApi.stock).mockResolvedValue([]);
    vi.mocked(barApi.sales).mockResolvedValue([{ id: 'sale', createdAt: instant, totalRevenue: '100', totalCost: '50', status: 'POSTED', lines: [] }] as unknown as Awaited<ReturnType<typeof barApi.sales>>);
    vi.mocked(barApi.movements).mockResolvedValue([{ id: 'movement', createdAt: instant, product: { name: 'Вымышленный сок' }, kind: 'RECEIPT', units: '1', amountMinor: '50' }] as unknown as Awaited<ReturnType<typeof barApi.movements>>);
  });
  it.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'UTC', 'America/New_York', 'Europe/Berlin', 'invalid/zone'])('formats both real date cells with selected branch timezone %s', async zone => {
    vi.mocked(branchesApi.list).mockResolvedValue({ items: [
      { locationId: 'location', location: { businessId: 'decoy' }, timezone: 'UTC' },
      { locationId: 'other', location: { businessId: 'business' }, timezone: 'UTC' },
      { locationId: 'location', location: { businessId: 'business' }, timezone: zone },
    ] } as Awaited<ReturnType<typeof branchesApi.list>>);
    const output = cells(await BarOperationsPage({}));
    expect(output.filter(value => value === propertyClock(zone).full(instant))).toHaveLength(2);
    expect(propertyTimezone).not.toHaveBeenCalled();
  });
  it('uses hospitality property timezone instead of branches', async () => {
    shell('HOSPITALITY'); vi.mocked(propertyTimezone).mockResolvedValue('Pacific/Kiritimati');
    expect(cells(await BarOperationsPage({})).filter(value => value === '18.10.2026 02:30')).toHaveLength(2);
    expect(branchesApi.list).not.toHaveBeenCalled();
  });
  it('unknown access falls back without branch reads', async () => {
    shell('FOOD_SERVICE', true);
    expect(cells(await BarOperationsPage({})).filter(value => value === propertyClock(FALLBACK_TIMEZONE).full(instant))).toHaveLength(2);
    expect(branchesApi.list).not.toHaveBeenCalled();
  });
});

describe('movement feed screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deskShell).mockResolvedValue({ vertical: 'FOOD_SERVICE', readOnly: false, access: { unknown: true, role: null } } as Awaited<ReturnType<typeof deskShell>>);
    vi.mocked(currentMe).mockResolvedValue({ context: { vertical: 'FOOD_SERVICE', businessId: 'business', locationId: 'location' } } as Awaited<ReturnType<typeof currentMe>>);
    vi.mocked(barApi.stock).mockResolvedValue([]);
    vi.mocked(barApi.sales).mockResolvedValue([]);
    vi.mocked(barApi.movements).mockResolvedValue([]);
    vi.mocked(branchesApi.list).mockResolvedValue({ items: [] } as unknown as Awaited<ReturnType<typeof branchesApi.list>>);
  });
  const render = async (search = {}) => renderToStaticMarkup(createElement('div', null, await BarOperationsPage({ searchParams: Promise.resolve(search) })));
  it('empty state is one short line with the three action dialogs, no tabs and no big card', async () => {
    const html = await render();
    const empty = html.slice(html.indexOf('data-testid="bar-movements-empty"'));
    expect(empty).toContain('Движений пока нет.');
    for (const label of ['Продажа', 'Списать', 'Инвентаризация']) expect(empty).toContain(`data-dialog="${label}"`);
    expect(html).not.toContain('empty-state');
    expect(html).not.toContain('role="tab"');
    expect(html).not.toContain('Продать товар можно на обзоре');
  });
  it('header has the three dialogs', async () => {
    const html = await render();
    expect(html.match(/data-dialog="Продажа"/g)).toHaveLength(2);
    expect(html.match(/data-dialog="Списать"/g)).toHaveLength(2);
    expect(html.match(/data-dialog="Инвентаризация"/g)).toHaveLength(2);
  });
  it('type param filters the feed and badges plus signed quantity render', async () => {
    vi.mocked(barApi.movements).mockResolvedValue([
      { id: 'r', productId: 'p', createdAt: instant, product: { name: 'Вымышленная вода' }, kind: 'RECEIPT', units: '5', unitCost: '1', amountMinor: '50', note: null },
      { id: 'w', productId: 'p', createdAt: instant, product: { name: 'Вымышленный сок' }, kind: 'WRITE_OFF', units: '1', unitCost: '1', amountMinor: '10', note: 'Бой' },
    ] as unknown as Awaited<ReturnType<typeof barApi.movements>>);
    const all = await render();
    expect(all).toContain('Вымышленная вода');
    expect(all).toContain('Вымышленный сок');
    expect(all).toMatch(/bar-qty--in[^>]*>\+5</);
    expect(all).toMatch(/bar-qty--out[^>]*>−1</);
    const writeoff = await render({ type: 'writeoff' });
    expect(writeoff).toContain('Вымышленный сок');
    expect(writeoff).not.toContain('Вымышленная вода');
    expect(await render({ q: 'вода' })).not.toContain('Вымышленный сок');
  });
});

