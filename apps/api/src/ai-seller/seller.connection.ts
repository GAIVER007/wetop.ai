import { assistant } from '@pms/integrations';

/**
 * Подключение к ИИ-продавцу (ТЗ ред. 1 П7; ADR-075). Всё — из окружения API: в браузер ни адрес, ни ключ не уходят
 * (ТЗ §2 п. 3). Читается на каждом обращении, как остальные настройки замка: правка `.env` и перезапуск — и только.
 *
 * - `SELLER_URL` — внутренний адрес API панели продавца (с путём панели);
 * - `SELLER_SERVICE_KEY` — служебный ключ продавца (Б5);
 * - `SELLER_ORGANIZATION_ID` — чья это копия продавца: одна копия — одна организация (Q-176). Без привязки любой
 *   зарегистрировавшийся увидел бы диалоги гостей чужой гостиницы;
 * - `SELLER_PUBLIC_URL` — публичный адрес продавца: из него код чата для сайта объекта;
 * - `SELLER_SYNC=off` — не сверять профиль и факты по расписанию.
 */
export interface SellerConfig {
  baseUrl: string | null;
  serviceKey: string | null;
  organizationId: string | null;
  publicUrl: string | null;
  syncEnabled: boolean;
}

/** То, что платформе нужно от продавца (docs/assistant/README.md §4) */
export interface SellerPort {
  listConversations(query: { mode?: string; limit?: number }): Promise<unknown>;
  conversation(id: string): Promise<unknown>;
  takeover(id: string): Promise<unknown>;
  release(id: string): Promise<unknown>;
  reply(id: string, text: string): Promise<unknown>;
  knowledge(): Promise<unknown>;
  uploadKnowledge(file: { name: string; type: string; data: Uint8Array }): Promise<unknown>;
  summary(): Promise<unknown>;
  sandbox(input: { externalId: string; text: string }): Promise<unknown>;
  putProfile(payload: unknown): Promise<unknown>;
  putFacts(payload: unknown): Promise<unknown>;
}

export interface SellerConnection {
  config(): SellerConfig;
  /** `null` — продавец не подключён: нет адреса или ключа */
  client(): SellerPort | null;
}

export const SELLER_CONNECTION = Symbol('SELLER_CONNECTION');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const httpUrl = (value: string | undefined): string | null => {
  const v = value?.trim();
  if (!v || !/^https?:\/\/[^\s/]+/i.test(v)) return null;
  return v.replace(/\/+$/, '');
};

export function sellerConfigFromEnv(env: Record<string, string | undefined> = process.env): SellerConfig {
  const organizationId = env.SELLER_ORGANIZATION_ID?.trim() ?? '';
  const serviceKey = env.SELLER_SERVICE_KEY?.trim() ?? '';
  return {
    baseUrl: httpUrl(env.SELLER_URL),
    serviceKey: serviceKey === '' ? null : serviceKey,
    // Кривой идентификатор — всё равно что никакого: иначе привязка молча не совпала бы ни с одной организацией
    organizationId: UUID.test(organizationId) ? organizationId.toLowerCase() : null,
    publicUrl: httpUrl(env.SELLER_PUBLIC_URL),
    syncEnabled: env.SELLER_SYNC?.trim() !== 'off',
  };
}

export class EnvSellerConnection implements SellerConnection {
  config(): SellerConfig {
    return sellerConfigFromEnv();
  }

  client(): SellerPort | null {
    const config = this.config();
    if (!config.baseUrl || !config.serviceKey) return null;
    return new assistant.SellerClient({ baseUrl: config.baseUrl, serviceKey: config.serviceKey });
  }
}
