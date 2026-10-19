import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SaleForm } from './sale-form';
vi.mock('./actions', () => ({ sellBarRetailAction: vi.fn() }));
describe('retail form safe initial render', () => {
  it('blocks sending until recovery storage is loaded, with plain Russian instructions', () => {
    const html = renderToStaticMarkup(createElement(SaleForm, { stock: [], context: { propertyId: 'synthetic', currency: 'KZT' }, methods: ['CASH'], recoveryScope: ['o', 'b', 'l', 'u', 'p', 'KZT', '2026-10-19T08:00:00.000Z'], expiresAt: '2099-01-01' }));
    expect(html).not.toContain('RECOVERY_HOLD');
    expect(html).not.toContain('read-only');
    expect(html).toContain('Восстановление продажи недоступно');
    expect(html).toMatch(/<button[^>]*disabled/);
  });
});
