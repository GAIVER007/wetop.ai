/**
 * Фискализация (ККМ / ОФД, Казахстан) — ПОРТ без реализации. Провайдер не выбран (Q-050…Q-053),
 * документации в `docs/` нет. Чек всегда привязан к платежу (DATA_MODEL §9 FiscalReceipt); суммы — minor units.
 */
export interface FiscalReceiptRequest {
  paymentId: string;
  /** integer minor units (тиын) */
  amountMinor: bigint;
  currency: string;
  /** Позиции чека: описание, количество, цена за единицу в minor units */
  lines: Array<{ description: string; quantity: number; unitPriceMinor: bigint }>;
  method: string;
}
export interface FiscalReceiptResult {
  status: 'FISCALIZED' | 'FAILED' | 'PENDING';
  receiptNumber: string | null;
  fiscalId: string | null;
  error: string | null;
}
export interface FiscalProvider {
  readonly name: string;
  fiscalize(req: FiscalReceiptRequest): Promise<FiscalReceiptResult>;
  refund(req: FiscalReceiptRequest & { originalFiscalId: string }): Promise<FiscalReceiptResult>;
}

export class FiscalNotConfiguredError extends Error {
  override readonly name = 'FiscalNotConfiguredError';
  constructor() {
    super('Фискализация не подключена: провайдер не выбран (Q-050)');
  }
}

/** Заглушка до выбора провайдера: чек не пробивается, стойка получает явную ошибку, а не тихий успех. */
export class NoFiscalProvider implements FiscalProvider {
  readonly name = 'none';
  async fiscalize(): Promise<FiscalReceiptResult> {
    throw new FiscalNotConfiguredError();
  }
  async refund(): Promise<FiscalReceiptResult> {
    throw new FiscalNotConfiguredError();
  }
}
