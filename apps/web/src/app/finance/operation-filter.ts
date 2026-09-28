import { METHOD_RU } from './labels';

/**
 * Отбор операций из адреса (ADR-113, F2): `op=payment|refund`, `method=<способ>`. Незнакомое значение — как «все»:
 * ссылку правят руками, и экран не должен падать 400-й ошибкой API.
 */
export function operationFilter(op: string | null | undefined, method: string | null | undefined) {
  return {
    type:
      op === 'payment' ? ('PAYMENT' as const) : op === 'refund' ? ('REFUND' as const) : undefined,
    method: method && METHOD_RU[method] ? method : undefined,
  };
}
