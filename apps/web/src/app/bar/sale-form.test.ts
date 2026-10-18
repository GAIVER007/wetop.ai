import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SaleForm } from './sale-form';
import type { RetailIntent } from './retail-recovery';
vi.mock('./actions', () => ({ sellBarRetailAction: vi.fn() }));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  return { ...actual, useState: vi.fn(actual.useState) };
});
afterEach(() => vi.mocked(useState).mockClear());
const props = { stock: [], context: { propertyId: 'synthetic', currency: 'KZT' }, methods: ['CASH'], recoveryScope: ['o', 'b', 'l', 'u', 'p', 'KZT', '2099-01-01'] };
const original: RetailIntent = { v: 1, key: '00000000-0000-4000-8000-000000000001', createdAt: 10, status: 'pending', payload: { productId: 'synthetic', quantityUnits: '2', method: 'CASH' } };
// Render actual component markup at controller-published states. No browser/transport claim.
function atState(intent: RetailIntent, pending: boolean, message?: string) {
  const values = [{ error: null, ok: message ? 1 : 0, message }, pending, {}, intent, intent.payload.productId];
  for (const value of values) vi.mocked(useState).mockImplementationOnce(() => [value, vi.fn()] as ReturnType<typeof useState>);
  return renderToStaticMarkup(createElement(SaleForm, props));
}
describe('retail form safe status rendering', () => {
  it('blocks sending until recovery storage is loaded, with plain Russian instructions', () => {
    const html = renderToStaticMarkup(createElement(SaleForm, props));
    expect(html).not.toContain('RECOVERY_HOLD');
    expect(html).not.toContain('read-only');
    expect(html).toContain('Восстановление продажи недоступно');
    expect(html).toMatch(/<button[^>]*disabled/);
  });
  it.each(['pending', 'hold', 'confirmed'] as const)('has one live status and a separately named original-sale region: %s', (status) => {
    const html = atState({ ...original, status }, status === 'pending', status === 'confirmed' ? 'Продажа записана' : undefined);
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('role="region" aria-label="Исходная продажа"');
    expect(html).toContain(original.key);
    expect(html).toMatch(/<input[^>]*disabled=""[^>]*name="quantityUnits"/);
    if (status === 'confirmed') {
      expect(html).toMatch(/role="status"[^>]*>Продажа записана/);
      expect(html).toContain('>Новая продажа</button>');
    } else expect(html).not.toContain('>Новая продажа</button>');
  });
});
