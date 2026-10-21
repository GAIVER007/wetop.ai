import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./cash-actions', () => ({ voidCashOperationAction: vi.fn() }));
import { VoidCashOperation } from './cash';

describe('cash cancellation readiness', () => {
  it('server-rendered cancellation is unavailable before its confirmation handler hydrates', () => {
    const markup = renderToStaticMarkup(createElement(VoidCashOperation, { id: 'synthetic-cash', summary: 'Synthetic expense' }));
    const button = markup.match(/<button\b[^>]*data-testid="cash-void"[^>]*>/)?.[0];
    expect(button).toBeDefined();
    expect(button).toContain('disabled=""');
    expect(button).toContain('aria-busy="true"');
  });
});
