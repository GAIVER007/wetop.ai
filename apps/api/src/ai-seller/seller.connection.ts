import { assistant } from '@pms/integrations';

/**
 * Подключение к ИИ-продавцу (ТЗ ред. 1 П7; ADR-079). Всё — из окружения API: в браузер ни адрес, ни ключ не уходят
 * (ТЗ §2 п. 3). Читается на каждом обращении, как остальные настройки замка: правка `.env` и перезапуск — и только.
 *
 * - `SELLER_URL` — внутренний адрес API панели продавца (с путём панели);
 * - `SELLER_SERVICE_KEY` — служебный ключ продавца (Б5);
 * - `SELLER_PUBLIC_URL` — публичный адрес продавца: из него код чата для сайта объекта;
 * - `SELLER_SYNC=off` — не сверять профиль и факты по расписанию.
 *
 * `SELLER_ORGANIZATION_ID` снят (Э4, ADR-083): один продавец обслуживает все гостиницы, организация вызова
 * передаётся клиенту панели, а гостиниц у продавца заводит сверка. Оставшаяся в `.env` переменная игнорируется.
 */
export interface SellerConfig {
  baseUrl: string | null;
  serviceKey: string | null;
  publicUrl: string | null;
  syncEnabled: boolean;
}

/** То, что платформе нужно от продавца (docs/assistant/README.md §4) */
export interface SellerPort {
  telegram(orgId: string, action: 'status' | 'check' | 'connect' | 'disconnect', body?: unknown): Promise<unknown>;
  /** `excludeSandbox`: без диалогов вкладки «Проверка» */
  listConversations(query: {
    mode?: string;
    limit?: number;
    excludeSandbox?: boolean;
  }): Promise<unknown>;
  conversation(id: string): Promise<unknown>;
  takeover(id: string): Promise<unknown>;
  release(id: string): Promise<unknown>;
  reply(id: string, text: string): Promise<unknown>;
  knowledge(): Promise<unknown>;
  uploadKnowledge(file: { name: string; type: string; data: Uint8Array }): Promise<unknown>;
  /** `excludeSandbox`: числа за сутки без проверок агента */
  summary(excludeSandbox?: boolean): Promise<unknown>;
  sandbox(input: { externalId: string; text: string }): Promise<unknown>;
  putProfile(payload: unknown): Promise<unknown>;
  /** Инструкция одним текстом (ADR-097): ядро правил бот ставит сам и сверху */
  putSellerPrompt(payload: { object_name: string; text: string }): Promise<unknown>;
  putFacts(payload: unknown): Promise<unknown>;
  /** Рассказ владельца → поля анкеты (С1): раскладывает бот, промптом рассказ не становится */
  extractProfile(story: string): Promise<unknown>;
  generateInstruction(story: string): Promise<unknown>;
  /** Ключ модели партнёра (С2): хранит только бот, наружу — set и последние 4 знака */
  llmKeyStatus(orgId: string): Promise<unknown>;
  putLlmKey(orgId: string, key: string): Promise<unknown>;
  checkLlmKey(orgId: string, key: string): Promise<unknown>;
  /** Подключение WhatsApp (С3): статус, поставить/снять, проверка номера и токена */
  whatsappStatus(orgId: string): Promise<unknown>;
  putWhatsApp(
    orgId: string,
    input: { phoneNumberId: string; token: string; appSecret: string },
  ): Promise<unknown>;
  checkWhatsApp(orgId: string, input: { phoneNumberId: string; token: string }): Promise<unknown>;
  /** Завести или поправить гостиницу у продавца (Э4) */
  putOrganization(
    id: string,
    org: { name: string; publicKey: string; active: boolean; hosts: string[] },
  ): Promise<unknown>;
}

export interface SellerConnection {
  config(): SellerConfig;
  /**
   * `null` — продавец не подключён: нет адреса или ключа. `organizationId` — организация вызова (Э4): панель
   * продавца отдаёт строки ровно этой гостиницы; без неё — только заведение гостиниц и помощниковские пути.
   * `agentId` — агент вызова (SA2.5): заголовок `X-Agent`, бот сверяет принадлежность организации.
   */
  client(organizationId?: string, agentId?: string): SellerPort | null;
}

export const SELLER_CONNECTION = Symbol('SELLER_CONNECTION');

const httpUrl = (value: string | undefined): string | null => {
  const v = value?.trim();
  if (!v || !/^https?:\/\/[^\s/]+/i.test(v)) return null;
  return v.replace(/\/+$/, '');
};

export function sellerConfigFromEnv(env: Record<string, string | undefined> = process.env): SellerConfig {
  const serviceKey = env.SELLER_SERVICE_KEY?.trim() ?? '';
  return {
    baseUrl: httpUrl(env.SELLER_URL),
    serviceKey: serviceKey === '' ? null : serviceKey,
    publicUrl: httpUrl(env.SELLER_PUBLIC_URL),
    syncEnabled: env.SELLER_SYNC?.trim() !== 'off',
  };
}

export class EnvSellerConnection implements SellerConnection {
  config(): SellerConfig {
    return sellerConfigFromEnv();
  }

  client(organizationId?: string, agentId?: string): SellerPort | null {
    const config = this.config();
    if (!config.baseUrl || !config.serviceKey) return null;
    return new assistant.SellerClient({
      baseUrl: config.baseUrl,
      serviceKey: config.serviceKey,
      ...(organizationId ? { organizationId } : {}),
      ...(organizationId && agentId ? { agentId } : {}),
    });
  }
}
