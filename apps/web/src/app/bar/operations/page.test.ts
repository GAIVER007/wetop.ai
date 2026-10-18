import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import BarOperationsPage from './page';
import { branchesApi, barApi } from '../../../lib/api';
import { currentMe, deskShell } from '../../../lib/desk-shell';
import { propertyTimezone } from '../../../lib/hotel-api';
import { FALLBACK_TIMEZONE, propertyClock } from '../../../lib/property-time';

vi.mock('../../../lib/vertical-guard', () => ({ requireFeature: vi.fn() }));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
vi.mock('../../../lib/desk-shell', () => ({ currentMe: vi.fn(), deskShell: vi.fn() }));
vi.mock('../../../lib/api', () => ({ barApi: { stock: vi.fn(), sales: vi.fn(), movements: vi.fn() }, branchesApi: { list: vi.fn() } }));
vi.mock('../../../lib/hotel-api', () => ({ propertyTimezone: vi.fn() }));
vi.mock('../load-context', () => ({ loadBarContext: vi.fn(async () => ({ propertyId: 'synthetic-property', currency: 'KZT' })) }));
vi.mock('../return-buttons', () => ({ BarReturnButtons: () => null }));
vi.mock('../write-off-form', () => ({ WriteOffForm: () => null }));
vi.mock('../inventory-count-form', () => ({ InventoryCountForm: () => null }));

// Inspect actual React elements returned by the real server page, including each Tabs panel.
// No replacement date expression, formatter or workspace selector is used.
function cells(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(cells);
  if (!isValidElement<{ children?: ReactNode; panels?: { content: ReactNode }[] }>(node)) return [];
  if (node.type === 'td' && typeof node.props.children === 'string') return [node.props.children];
  return [...cells(node.props.children), ...(node.props.panels ?? []).flatMap(panel => cells(panel.content))];
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
    vi.mocked(barApi.movements).mockResolvedValue([{ id: 'movement', createdAt: instant, product: { name: 'Вымышленный сок' }, kind: 'SALE', units: '1', amountMinor: '50' }] as unknown as Awaited<ReturnType<typeof barApi.movements>>);
  });
  it.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'UTC', 'America/New_York', 'Europe/Berlin', 'invalid/zone'])('formats both real date cells with selected branch timezone %s', async zone => {
    vi.mocked(branchesApi.list).mockResolvedValue({ items: [
      { locationId: 'location', location: { businessId: 'decoy' }, timezone: 'UTC' },
      { locationId: 'other', location: { businessId: 'business' }, timezone: 'UTC' },
      { locationId: 'location', location: { businessId: 'business' }, timezone: zone },
    ] } as Awaited<ReturnType<typeof branchesApi.list>>);
    const output = cells(await BarOperationsPage());
    expect(output.filter(value => value === propertyClock(zone).full(instant))).toHaveLength(2);
    expect(propertyTimezone).not.toHaveBeenCalled();
  });
  it('uses hospitality property timezone instead of branches', async () => {
    shell('HOSPITALITY'); vi.mocked(propertyTimezone).mockResolvedValue('Pacific/Kiritimati');
    expect(cells(await BarOperationsPage()).filter(value => value === '18.10.2026 02:30')).toHaveLength(2);
    expect(branchesApi.list).not.toHaveBeenCalled();
  });
  it('unknown access falls back without branch reads', async () => {
    shell('FOOD_SERVICE', true);
    expect(cells(await BarOperationsPage()).filter(value => value === propertyClock(FALLBACK_TIMEZONE).full(instant))).toHaveLength(2);
    expect(branchesApi.list).not.toHaveBeenCalled();
  });
});
