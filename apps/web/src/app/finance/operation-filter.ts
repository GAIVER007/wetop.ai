import { METHOD_RU } from './labels';

/** `op=` из адреса → тип операции API; касса (§21) добавила поступления, расходы и переводы */
const OP_TYPES: Record<string, 'PAYMENT' | 'REFUND' | 'INCOME' | 'EXPENSE' | 'TRANSFER'> = {
  payment: 'PAYMENT',
  refund: 'REFUND',
  income: 'INCOME',
  expense: 'EXPENSE',
  transfer: 'TRANSFER',
};

/**
 * Отбор операций из адреса (ADR-113, F2; §21): `op=`, `method=`, `src=bookings|cash`. Незнакомое значение — как
 * «все»: ссылку правят руками, и экран не должен падать 400-й ошибкой API.
 */
export function operationFilter(
  op: string | null | undefined,
  method: string | null | undefined,
  src?: string | null,
) {
  return {
    type: op ? OP_TYPES[op] : undefined,
    method: method && METHOD_RU[method] ? method : undefined,
    source:
      src === 'cash' ? ('CASH' as const) : src === 'bookings' ? ('RESERVATIONS' as const) : undefined,
  };
}
