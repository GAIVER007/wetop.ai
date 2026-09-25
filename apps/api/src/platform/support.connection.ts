import { assistant } from '@pms/integrations';

/**
 * Подключение к панели ИИ-помощника — «Платформа → Техподдержка» (ADR-083, план `plans/platform-roles-extensions-2026-09-25.md`
 * Э3; контракт — docs/assistant/README.md §4). Всё — из окружения API, в браузер ни адрес, ни ключ не уходят. Читается
 * на каждом обращении: правка `.env` и перезапуск — и только.
 *
 * - `ASSISTANT_PANEL_URL` — внутренний адрес панели помощника с её путём: `http://assistant:8000<DASHBOARD_PATH_PREFIX>`.
 *   Не путать с `ASSISTANT_URL` — публичным адресом чата для стойки и главной;
 * - `ASSISTANT_SERVICE_KEY` — служебный ключ; в `.env` помощника то же значение стоит в `SELLER_SERVICE_KEY` (у бота
 *   одно имя переменной для обеих ролей).
 */
export interface SupportConfig {
  baseUrl: string | null;
  serviceKey: string | null;
}

/** То, что «Техподдержке» нужно от панели помощника: без профиля, фактов и песочницы — они у продавца */
export interface SupportPort {
  listConversations(query: { mode?: string; limit?: number }): Promise<unknown>;
  conversation(id: string): Promise<unknown>;
  takeover(id: string): Promise<unknown>;
  release(id: string): Promise<unknown>;
  reply(id: string, text: string): Promise<unknown>;
  knowledge(): Promise<unknown>;
  uploadKnowledge(file: { name: string; type: string; data: Uint8Array }): Promise<unknown>;
  summary(): Promise<unknown>;
}

export interface SupportConnection {
  config(): SupportConfig;
  /** `null` — помощник не подключён: нет адреса панели или ключа */
  client(): SupportPort | null;
}

export const SUPPORT_CONNECTION = Symbol('SUPPORT_CONNECTION');

const httpUrl = (value: string | undefined): string | null => {
  const v = value?.trim();
  if (!v || !/^https?:\/\/[^\s/]+/i.test(v)) return null;
  return v.replace(/\/+$/, '');
};

export function supportConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): SupportConfig {
  const serviceKey = env.ASSISTANT_SERVICE_KEY?.trim() ?? '';
  return {
    baseUrl: httpUrl(env.ASSISTANT_PANEL_URL),
    serviceKey: serviceKey === '' ? null : serviceKey,
  };
}

export class EnvSupportConnection implements SupportConnection {
  config(): SupportConfig {
    return supportConfigFromEnv();
  }

  client(): SupportPort | null {
    const config = this.config();
    if (!config.baseUrl || !config.serviceKey) return null;
    return new assistant.BotPanelClient({
      baseUrl: config.baseUrl,
      serviceKey: config.serviceKey,
      bot: assistant.SUPPORT_BOT,
    });
  }
}
