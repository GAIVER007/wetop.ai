/** Только транспортная фикстура UI. Денежные правила проверяются на настоящем PostgreSQL. */
import { randomUUID } from 'node:crypto';
import type { CashRegisterView } from '../../apps/web/src/lib/cash-register';
const registers = new Map<string, CashRegisterView>();
export function resetCashRegisterFixture() {
  registers.clear();
}
export function cashRegisterFixture(
  scope: string,
  userId: string,
  path: string,
  body: Record<string, unknown>,
  send: (status: number, value: unknown) => void,
) {
  let view = registers.get(scope);
  if (!view) {
    view = {
      registerId: randomUUID(),
      name: 'Тестовая касса филиала',
      currency: 'KZT',
      timezone: 'Asia/Almaty',
      snapshot: {
        balances: { CASH: '1000000' },
        received: {},
        refunds: {},
        expenses: {},
        fingerprint: 'ui-initial',
      },
      active: null,
      history: [],
      totals: null,
      incomeMethods: [
        'CASH',
        'CARD_TERMINAL',
        'KASPI',
        'HALYK',
        'BANK_TRANSFER_PERSON',
        'BANK_TRANSFER_LEGAL',
      ],
      expenseMethods: [
        'CASH',
        'CARD_TERMINAL',
        'KASPI',
        'HALYK',
        'BANK_TRANSFER_PERSON',
        'BANK_TRANSFER_LEGAL',
      ],
      mayOperate: true,
      mayManage: true,
      currentUserId: userId,
      cashierIds: [],
      members: [{ id: userId, name: 'Тестовый администратор' }],
      handovers: [],
    };
    registers.set(scope, view);
  }
  if (path === '/cash-register/cashiers') {
    view.cashierIds = body.userIds as string[];
    return send(200, view);
  }
  if (path === '/cash-register/command') {
    if (body.action === 'open') {
      view.active = {
        id: randomUUID(),
        responsible_user_id: userId,
        opened_at: '2026-10-25T04:00:00Z',
        closed_at: null,
        opening: {
          snapshot: structuredClone(view.snapshot),
          counted: String(BigInt(String(body.counted)) * 100n),
          note: '',
        },
        closing: null,
      };
      view.totals = { received: {}, refunds: {}, expenses: {} };
    }
    if (body.action === 'expense') {
      view.snapshot.balances.CASH = String(
        BigInt(view.snapshot.balances.CASH!) - BigInt(String(body.amount)) * 100n,
      );
      // расходы за смену копятся, как в API (cashDelta от снимка открытия)
      view.totals!.expenses.CASH = String(
        BigInt(view.totals!.expenses.CASH ?? '0') + BigInt(String(body.amount)) * 100n,
      );
      view.snapshot.fingerprint = randomUUID();
    }
    if (body.action === 'close' && view.active) {
      view.active.closed_at = '2026-10-25T14:00:00Z';
      view.active.closing = {
        expected: view.snapshot.balances.CASH!,
        counted: view.snapshot.balances.CASH!,
        difference: '0',
        retained: view.snapshot.balances.CASH!,
        plannedHandover: '0',
        note: '',
      };
      view.history.unshift(view.active);
      view.active = null;
      view.totals = null;
    }
  }
  send(200, view);
}
