import { assistant } from '@pms/integrations';
import { sellerConfigFromEnv } from '../ai-seller/seller.connection';

/**
 * Узкий порт к боту для скана накладной бара (ADR-152, контракт `bar-receipt-scan/0`). Тот же экземпляр и
 * служебный ключ, что у ИИ-продавца (`SELLER_URL`, `SELLER_SERVICE_KEY`), клиент без организации и агента:
 * ключ модели только платформы. Вход без состояния: ни платформа, ни бот ничего не записывают.
 */
export const BAR_SCAN_BOT = Symbol('BAR_SCAN_BOT');

export interface BarScanBotRequest {
  schemaVersion: 'bar-receipt-scan/0';
  requestId: string;
  document: { mediaType: string; dataBase64: string };
  /** Справочник объекта для сопоставления: только действующие карточки */
  knownProducts: Array<{ code: string; name: string; barcode: string | null }>;
  knownSuppliers: string[];
  /** Потолок расхода одного скана; бюджетных таблиц, как у сайта, нет */
  budgetRemainingTokens: number;
}

export interface BarScanBot {
  /** Ответ бота как есть; разбирает сервис. Нет связи, таймаут, 5xx: `BotUnavailableError` */
  scan(request: BarScanBotRequest): Promise<unknown>;
}

export function barScanBotFromEnv(): BarScanBot | null {
  const config = sellerConfigFromEnv();
  if (!config.baseUrl || !config.serviceKey) return null;
  const client = new assistant.BotPanelClient({ baseUrl: config.baseUrl, serviceKey: config.serviceKey });
  return { scan: (request) => client.barReceiptScan({ ...request }) };
}
