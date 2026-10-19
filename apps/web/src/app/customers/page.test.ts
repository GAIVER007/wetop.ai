import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ role: 'STAFF', readOnly: false, canCreate: true }));
vi.mock('server-only', () => ({}));
vi.mock('../../lib/vertical-guard', () => ({ requireFeature: async () => ({ context: { vertical: 'BEAUTY', businessId: 'synthetic-business' } }) }));
vi.mock('../../lib/api', () => ({ beautyApi: { customers: async () => ({ items: [] }) } }));
vi.mock('../../lib/desk-shell', () => ({ deskShell: async () => ({ readOnly: state.readOnly, access: { role: state.role }, scopeKey: 'synthetic-scope' }) }));
vi.mock('../../lib/navigation', () => ({ mayBeautyAccess: () => state.canCreate }));
vi.mock('./beauty-table', () => ({ BeautyCustomersTable: () => null }));
vi.mock('./customer-tools', () => ({ BeautyCustomerTools: ({ canEdit, importHistory }: { canEdit: boolean; importHistory?: ReactNode }) => canEdit ? importHistory : null }));
vi.mock('./import-customers', () => ({ ImportCustomers: ({ canImport }: { canImport: boolean }) => createElement('div', { 'data-csv-preview': 'available', 'data-durable-import': String(canImport) }) }));
import CustomersPage from './page';

beforeEach(() => { state.role = 'STAFF'; state.readOnly = false; state.canCreate = true; });
const render = async () => renderToStaticMarkup(await CustomersPage());
describe('Customer CSV entry permissions', () => {
  it('mounts local preview for a staff creator without granting durable imports', async () => {
    const html = await render();
    expect(html).toContain('data-csv-preview="available"');
    expect(html).toContain('data-durable-import="false"');
  });
  it('retains durable import only for a writable owner', async () => {
    state.role = 'OWNER';
    expect(await render()).toContain('data-durable-import="true"');
  });
  it('does not expose a CSV entry in read-only mode or without customer creation', async () => {
    state.readOnly = true;
    expect(await render()).not.toContain('data-csv-preview');
    state.readOnly = false; state.canCreate = false;
    expect(await render()).not.toContain('data-csv-preview');
  });
});
