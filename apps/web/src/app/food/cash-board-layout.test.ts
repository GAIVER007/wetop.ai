import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { FoodCashView } from '../../lib/food-types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('../../components/use-confirm', () => ({ useConfirm: () => ({ ask: vi.fn(), dialog: null }) }));
vi.mock('../cashbox/actions', () => ({ mutateCash: vi.fn() }));

import { CashBoard } from './cash-board';

const cash: FoodCashView = {
  currency: 'KZT',
  balances: [
    { method: 'CASH', balanceMinor: '1500000' },
    { method: 'KASPI', balanceMinor: '300000' },
  ] as FoodCashView['balances'],
  operations: [],
  payments: [],
  reconciliations: [],
};

describe('Касса (аудит 21.10.2026, пп. 20, 26, 27)', () => {
  const html = renderToStaticMarkup(
    createElement(CashBoard, { scopeKey: 'b:l', timezone: 'Asia/Almaty', write: true, refunds: false, cash, orders: false }),
  );
  it('без ряда плиток: «Всего в кассе» строкой, способы в таблице', () => {
    expect(html).not.toContain('class="stats"');
    expect(html).not.toContain('class="stat ');
    expect(html).toMatch(/data-testid="cash-total"[^>]*>18 000 ₸/);
    expect(html).toContain('data-testid="cash-balances"');
    expect(html).toMatch(/data-testid="cash-CASH"[^>]*>15 000 ₸/);
    expect(html).toMatch(/data-testid="cash-KASPI"[^>]*>3 000 ₸/);
  });
  it('две формы с заголовками: «Операция кассы» и «Сверка кассы»', () => {
    expect(html).toContain('>Операция кассы</h2>');
    expect(html).toContain('>Сверка кассы</h2>');
  });
  it('пустая сумма: понятная подсказка «Введите сумму»', () => {
    const source = readFileSync(new URL('./cash-board.tsx', import.meta.url), 'utf8');
    expect(source).toContain("'Введите сумму'");
    expect(source).not.toContain("setError('Сумма: целое число больше нуля')");
  });
});
