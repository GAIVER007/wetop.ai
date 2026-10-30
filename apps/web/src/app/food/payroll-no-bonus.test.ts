import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PayrollBoard } from './payroll-board';
import type { PayrollView } from '../../lib/food-types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, refresh() {} }) }));
vi.mock('./restaurant-actions', () => ({ mutateStaff: vi.fn() }));

/** Премий нет (владелец 30.10.2026): «Премии» и «Удержания» в таблице только в месяце, где они начислены */
const row = { employeeId: 'e1', name: 'Amina', status: 'ACTIVE', model: 'PERCENT' as const, fixedMinor: '0', percent: 40,
  salesMinor: '100000', baseMinor: '0', percentMinor: '40000', bonusMinor: '0', penaltyMinor: '0', totalMinor: '40000', paidMinor: '0', remainingMinor: '40000' };
const view = (adj: PayrollView['adjustments']): PayrollView => ({ month: '2026-10', currency: 'QAR',
  totals: { fundMinor: '40000', bonusMinor: '0', penaltyMinor: '0', payoutMinor: '40000', paidMinor: '0' }, rows: [row], adjustments: adj });
const html = (v: PayrollView) => renderToStaticMarkup(createElement(PayrollBoard, { scopeKey: 'b:l', write: false, payroll: v, basis: 'visits' }));
describe('зарплата без премий', () => {
  it('без начислений колонок «Премии» и «Удержания» нет', () => {
    const h = html(view([]));
    expect(h).not.toContain('>Премии<');
    expect(h).not.toContain('>Удержания<');
  });
  it('есть удержание: колонки видны', () => {
    const h = html(view([{ id: 'a', employeeId: 'e1', amountMinor: '-500', reason: 'опоздание', createdAt: '2026-10-10T10:00:00Z' }]));
    expect(h).toContain('>Удержания<');
  });
});
