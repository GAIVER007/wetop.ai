import { PAYMENT_METHOD_RU } from '@pms/domain';
/** Способы оплаты словами — экран «Финансы за период» и выгрузка CSV (ADR-113) */
// один источник подписей (DATA_MODEL §21.6, ADR-152 У10): домен
export const METHOD_RU: Record<string, string> = PAYMENT_METHOD_RU;

export type OperationKind = 'PAYMENT' | 'REFUND' | 'INCOME' | 'EXPENSE' | 'TRANSFER';

/** Тип операции словом: деньги броней и касса (DATA_MODEL §21) в одной ленте */
const KIND_RU: Record<OperationKind, string> = {
  PAYMENT: 'Оплата',
  REFUND: 'Возврат',
  INCOME: 'Поступление',
  EXPENSE: 'Расход',
  TRANSFER: 'Перевод',
};
export const operationKind = (kind: OperationKind) => KIND_RU[kind] ?? kind;

/** Статус словом в роде типа: «оплата проведена», «возврат проведён», «поступление проведено» */
const DONE_RU: Record<OperationKind, string> = {
  PAYMENT: 'проведена',
  REFUND: 'проведён',
  INCOME: 'проведено',
  EXPENSE: 'проведён',
  TRANSFER: 'проведён',
};
const VOID_RU: Record<OperationKind, string> = {
  PAYMENT: 'аннулирована',
  REFUND: 'аннулирован',
  INCOME: 'аннулировано',
  EXPENSE: 'аннулирован',
  TRANSFER: 'аннулирован',
};
export const operationStatus = (kind: OperationKind, status: 'COMPLETED' | 'VOIDED') =>
  status === 'VOIDED' ? VOID_RU[kind] : DONE_RU[kind];
