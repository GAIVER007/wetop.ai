import { assistant } from '@pms/integrations';
import { sellerConfigFromEnv } from '../ai-seller/seller.connection';

/**
 * Узкий порт к боту для генерации сайта (MKT6, `docs/marketing/site-generation-v0.md` §5). Тот же экземпляр и служебный
 * ключ, что у ИИ-продавца (`SELLER_URL`, `SELLER_SERVICE_KEY`), но клиент без организации и агента: ключ модели только
 * платформы (Q-274), и бот на этом входе организацию не принимает. Браузер ни адреса, ни ключа не видит.
 */
export const GENERATION_BOT = Symbol('GENERATION_BOT');

export interface GenerationBotRequest {
  schemaVersion: 'site-generation/0';
  requestId: string;
  siteSpecSchemaVersion: 'site-spec/0';
  briefInput: unknown;
  targetLocales: string[];
  budgetRemainingTokens: number;
  validationErrors: Array<{ path: string; code: string }>;
}

export interface GenerationBot {
  /** Ответ бота как есть; разбирает и проверяет воркер. Нет связи, таймаут, 5xx: `BotUnavailableError` */
  generate(request: GenerationBotRequest): Promise<unknown>;
}

export function generationBotFromEnv(): GenerationBot | null {
  const config = sellerConfigFromEnv();
  if (!config.baseUrl || !config.serviceKey) return null;
  const client = new assistant.BotPanelClient({ baseUrl: config.baseUrl, serviceKey: config.serviceKey });
  return { generate: (request) => client.siteGeneration({ ...request }) };
}
