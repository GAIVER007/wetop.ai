import { Children, isValidElement, type ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ role: 'STAFF', readOnly: false, canCreate: true }));
vi.mock('../../lib/vertical-guard', () => ({
  requireFeature: async () => ({ context: { vertical: 'BEAUTY', businessId: 'synthetic-salon' } }),
}));
vi.mock('../../lib/desk-shell', () => ({
  deskShell: async () => ({
    readOnly: state.readOnly, scopeKey: 'synthetic-scope',
    access: {
      role: state.role,
      beautyAccess: {
        mode: 'POSITION', assigned: true,
        permissions: state.canCreate ? [{ section: 'customers', action: 'create', scope: 'BUSINESS' }] : [],
      },
    },
  }),
}));
vi.mock('../../lib/api', () => ({ beautyApi: { customers: async () => ({ items: [] }) } }));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
vi.mock('../food/customers', () => ({ FoodCustomers: () => null }));
vi.mock('./beauty-table', () => ({ BeautyCustomersTable: () => null }));
vi.mock('./customer-tools', () => ({ BeautyCustomerTools: () => null }));
vi.mock('./import-customers', () => ({ ImportCustomers: () => null }));
import CustomersPage from './page';
import { BeautyCustomerTools } from './customer-tools';
import { ImportCustomers } from './import-customers';

beforeEach(() => { state.role = 'STAFF'; state.readOnly = false; state.canCreate = true; });

// Inspect the real server page composition, without opening an overlay or invoking server actions.
async function toolsProps() {
  const page = await CustomersPage();
  const tools = Children.toArray(page.props.children).find(child =>
    isValidElement(child) && child.type === BeautyCustomerTools);
  if (!isValidElement<ComponentProps<typeof BeautyCustomerTools>>(tools)) throw new Error('Missing customer tools');
  return tools.props;
}

describe('Customer import capability composition', () => {
  it.each(['STAFF', 'OWNER'])('%s receives local CSV preview with only OWNER durable capability', async (role) => {
    state.role = role;
    const tools = await toolsProps();
    expect(tools.canEdit).toBe(true);
    expect(isValidElement(tools.importHistory)).toBe(true);
    if (!isValidElement<ComponentProps<typeof ImportCustomers>>(tools.importHistory)) throw new Error('Missing local CSV preview');
    expect(tools.importHistory.type).toBe(ImportCustomers);
    expect(tools.importHistory.props.businessId).toBe('synthetic-salon');
    expect(tools.importHistory.props.canImport).toBe(role === 'OWNER');
  });
  it('keeps the tools gate closed without create permission', async () => {
    state.canCreate = false;
    expect((await toolsProps()).canEdit).toBe(false);
  });
  it('keeps the tools gate and durable capability closed in read-only mode', async () => {
    state.role = 'OWNER'; state.readOnly = true;
    const tools = await toolsProps();
    expect(tools.canEdit).toBe(false);
    if (!isValidElement<ComponentProps<typeof ImportCustomers>>(tools.importHistory)) throw new Error('Missing import composition');
    expect(tools.importHistory.props.canImport).toBe(false);
  });
});
