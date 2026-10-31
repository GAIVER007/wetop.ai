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
  it('время операций словами в поясе филиала, у возвратов и расходов знак «−» (аудит ресторана 22.10.2026)', () => {
    const op = (id: string, kind: 'INCOME' | 'EXPENSE', refund: boolean) => ({
      id, kind, method: 'CASH' as const, methodTo: null, amountMinor: '60000', note: null, employee: null,
      period: null, refund, status: 'COMPLETED' as const, occurredAt: '2026-10-21T20:06:00.000Z',
    });
    const withOps = renderToStaticMarkup(
      createElement(CashBoard, {
        scopeKey: 'b:l', timezone: 'Asia/Almaty', write: true, refunds: false, orders: true,
        cash: {
          ...cash,
          operations: [op('a', 'EXPENSE', true), op('b', 'EXPENSE', false), op('c', 'INCOME', false)],
          payments: [{ id: 'p', orderNumber: 1, method: 'CASH', amountMinor: '560000', status: 'COMPLETED', paidAt: '2026-10-21T20:06:00.000Z' }],
        },
      }),
    );
    expect(withOps).toContain('22 окт., 01:06');
    expect(withOps).not.toMatch(/2026-10-2\d/);
    expect(withOps.match(/−600 ₸/g)).toHaveLength(2);
    expect(withOps).toMatch(/>600 ₸</);
  });
  it('вариант А (аудит кабинета 31.10.2026): слева итог, остатки и движение денег, справа приход, расход, перевод и сверка', () => {
    const main = html.slice(html.indexOf('class="cash-a__main"'), html.indexOf('class="cash-a__side"'));
    const side = html.slice(html.indexOf('class="cash-a__side"'));
    expect(main).toContain('data-testid="cash-total"');
    expect(main).toContain('data-testid="cash-balances"');
    expect(main).toContain('role="tablist"');
    expect(side).toContain('>Операция кассы</h2>');
    expect(side).toContain('>Сверка кассы</h2>');
    expect(side).not.toContain('data-testid="cash-balances"');
  });
  it('без права записи нет правой колонки: движение денег на всю ширину', () => {
    const readOnly = renderToStaticMarkup(
      createElement(CashBoard, { scopeKey: 'b:l', timezone: 'Asia/Almaty', write: false, refunds: false, cash, orders: false }),
    );
    expect(readOnly).toContain('class="cash-a__main"');
    expect(readOnly).not.toContain('cash-a__side');
  });
  it('пустая сумма: понятная подсказка «Введите сумму»', () => {
    const source = readFileSync(new URL('./cash-board.tsx', import.meta.url), 'utf8');
    expect(source).toContain("'Введите сумму'");
    expect(source).not.toContain("setError('Сумма: целое число больше нуля')");
  });
});
