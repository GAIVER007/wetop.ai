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

/** Тип и статус операции словами: «оплата» — она, «возврат» — он */
export const operationKind = (kind: 'PAYMENT' | 'REFUND') =>
  kind === 'REFUND' ? 'Возврат' : 'Оплата';
export const operationStatus = (kind: 'PAYMENT' | 'REFUND', status: 'COMPLETED' | 'VOIDED') =>
  status === 'VOIDED' ? 'аннулирована' : kind === 'REFUND' ? 'проведён' : 'проведена';
