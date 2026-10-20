import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { FoodCashView } from '../../lib/food-types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('../../components/use-confirm', () => ({ useConfirm: () => ({ ask: vi.fn(), dialog: null }) }));
vi.mock('../cashbox/actions', () => ({ mutateCash: vi.fn() }));

import { CashBoard } from './cash-board';

const cash: FoodCashView = {
  currency: 'KZT',
  balances: [],
  operations: [
    {
      id: 'op-1',
      kind: 'INCOME',
      method: 'CASH',
      methodTo: null,
      amountMinor: '500000',
      note: 'Оплата записи: Клиент',
      employee: null,
      period: null,
      status: 'COMPLETED',
      occurredAt: '2026-10-18T07:40:00.000Z',
      appointmentId: 'ap-1',
      appointmentStartsAt: '2026-10-18T10:00:00.000Z',
    },
  ],
  payments: [],
  reconciliations: [],
};

describe('H1 (паритет с zapis.kz): операция кассы ссылается на запись', () => {
  it('у операции с appointmentId есть ссылка на карточку записи в реестре', () => {
    const html = renderToStaticMarkup(
      createElement(CashBoard, {
        scopeKey: 'b:l',
        timezone: 'Asia/Almaty',
        write: false,
        refunds: false,
        cash,
        orders: false,
      }),
    );
    expect(html).toContain('/appointments?from=2026-10-18&amp;to=2026-10-18&amp;appointment=ap-1');
    expect(html).toContain('Запись');
  });
});
