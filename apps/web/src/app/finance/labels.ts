/** Способы оплаты словами — экран «Финансы за период» и выгрузка CSV (ADR-113) */
export const METHOD_RU: Record<string, string> = {
  CASH: 'Наличные',
  CARD_TERMINAL: 'Карта (терминал)',
  KASPI: 'Kaspi',
  HALYK: 'Halyk',
  BANK_TRANSFER_PERSON: 'Перевод от физлица',
  BANK_TRANSFER_LEGAL: 'Перевод от юрлица',
  DEPOSIT: 'Депозит',
  CARD_GUARANTEE: 'Гарантия картой',
  EXTERNAL: 'Внешний канал',
};

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
