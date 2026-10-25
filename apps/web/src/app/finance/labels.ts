import { PAYMENT_METHOD_RU } from '@pms/domain';
import { msg } from '../../i18n';
/** Способы оплаты словами — экран «Финансы за период» и выгрузка CSV (ADR-113) */
// один источник подписей (DATA_MODEL §21.6, ADR-185 У10): домен
export const METHOD_RU: Record<string, string> = PAYMENT_METHOD_RU;

export type OperationKind = 'PAYMENT' | 'REFUND' | 'INCOME' | 'EXPENSE' | 'TRANSFER';

/** Тип операции словом: деньги броней и касса (DATA_MODEL §21) в одной ленте */
const KIND_RU: Record<OperationKind, string> = {
  PAYMENT: msg('Оплата'),
  REFUND: msg('Возврат'),
  INCOME: msg('Поступление'),
  EXPENSE: msg('Расход'),
  TRANSFER: msg('Перевод'),
};
export const operationKind = (kind: OperationKind) => KIND_RU[kind] ?? kind;

/** Статус словом в роде типа: «оплата проведена», «возврат проведён», «поступление проведено» */
const DONE_RU: Record<OperationKind, string> = {
  PAYMENT: msg('проведена'),
  REFUND: msg('проведён'),
  INCOME: msg('проведено'),
  EXPENSE: msg('проведён'),
  TRANSFER: msg('проведён'),
};
const VOID_RU: Record<OperationKind, string> = {
  PAYMENT: msg('аннулирована'),
  REFUND: msg('аннулирован'),
  INCOME: msg('аннулировано'),
  EXPENSE: msg('аннулирован'),
  TRANSFER: msg('аннулирован'),
};
export const operationStatus = (kind: OperationKind, status: 'COMPLETED' | 'VOIDED') =>
  status === 'VOIDED' ? VOID_RU[kind] : DONE_RU[kind];
