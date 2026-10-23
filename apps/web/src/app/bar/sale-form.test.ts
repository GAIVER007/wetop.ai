import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

  it('has exactly one live status; the original sale panel is a named region, not a second status', () => {
    const html = renderToStaticMarkup(createElement(SaleForm, { stock: [], context: { propertyId: 'synthetic', currency: 'KZT' }, methods: ['CASH'], recoveryScope: ['o', 'b', 'l', 'u', 'p', 'KZT', '2026-10-19T08:00:00.000Z'], expiresAt: '2099-01-01' }));
    expect(html.match(/role="status"/g) ?? []).toHaveLength(1);
    const source = readFileSync(fileURLToPath(new URL('./sale-form.tsx', import.meta.url)), 'utf8');
    expect(source).toMatch(/<section role="region" aria-label="Исходная продажа" data-testid="retail-recovery-panel">/);
    expect(source).not.toMatch(/<section role="status"/);
    expect(source).not.toContain('className="bar-success"');
    // текст успеха сервера идёт в единственный статус вместо «Результат подтверждён.»
    expect(source).toContain("intent?.status === 'confirmed' ? (state.message ?? 'Результат подтверждён.')");
  });
});
