/**
 * Клиент панели бота (ТЗ ред. 1 П7, Б5; ADR-079, ADR-083; контракт — docs/assistant/README.md §4). Один образ бота —
 * две роли, и панель у них одна: продавец (`SELLER_URL`, раздел «ИИ-продавец») и помощник (`ASSISTANT_PANEL_URL`,
 * «Платформа → Техподдержка»). Отличаются только слова ошибок — `bot`.
 *
 * Все вызовы идут из API платформы по внутреннему адресу с заголовком `X-Service-Key` — браузер ни адреса, ни ключа не
 * видит. Отказы двух видов, и экраны показывают их по-разному: бот **недоступен** (нет связи, тайм-аут, 5xx) —
 * повторить позже; бот **отклонил** (4xx) — показать его причину, повтор не поможет. Ключа нет ни в адресе, ни в
 * тексте ошибки.
 */

import { createHmac } from 'node:crypto';

const TIMEOUT_MS = 15_000;
/** Ход в песочнице — каскад моделей, до минуты (ТЗ §3 бота); ждём с запасом */
const SANDBOX_TIMEOUT_MS = 90_000;
/**
 * Генерация сайта (MKT6): до трёх ступеней по 70 с у бота. Меньше аренды воркера (5 минут): ответ, не дождавшийся
 * этого срока, считается потерянным, и платформа ставит неизвестный расход, а не повтор.
 */
export const SITE_GENERATION_TIMEOUT_MS = 250_000;

/** Как бот называется в словах ошибок: «ИИ-продавец не ответил», «нет связи с ИИ-помощником» */
export interface BotNames {
  name: string;
  withName: string;
}

export const SELLER_BOT: BotNames = { name: 'ИИ-продавец', withName: 'ИИ-продавцом' };
export const SUPPORT_BOT: BotNames = { name: 'ИИ-помощник', withName: 'ИИ-помощником' };

/** Бот не ответил или ответил 5xx: повторить позже */
export class BotUnavailableError extends Error {
  override readonly name = 'BotUnavailableError';
}

/** Бот отказал (4xx): причина — его, повтор не поможет */
export class BotRejectedError extends Error {
  override readonly name = 'BotRejectedError';
  constructor(
    readonly status: number,
    readonly detail: string,
    /** Поля, которые бот назвал в отказе (Б6: `detail.fields`), — его имена, как в теле запроса */
    readonly fields: readonly string[] = [],
    bot: BotNames = SELLER_BOT,
  ) {
    super(`${bot.name} отклонил запрос (HTTP ${status}): ${detail}`);
  }
}

export interface BotPanelClientConfig {
  /** Внутренний адрес API панели бота, с путём панели (`DASHBOARD_PATH_PREFIX` бота) */
  baseUrl: string;
  serviceKey: string;
  /**
   * Организация вызова (Э4, ADR-083): у продавца много гостиниц, и панель отдаёт строки ровно одной — заголовок
   * `X-Organization` на каждом вызове, `organization_id` в теле песочницы. Без неё — помощник, как раньше.
   */
  organizationId?: string;
  /**
   * Агент вызова (SA2.5): заголовок `X-Agent` на каждом вызове. Бот сверяет, что агент принадлежит организации вызова
   * (чужой — 403). Без него — единственный агент организации с `id = organization_id`, как до SA2.5.
   */
  agentId?: string;
  /** Чья это панель — для слов ошибок; без него — продавец, как было до «Техподдержки» */
  bot?: BotNames;
  fetch?: typeof fetch;
}

/** Гостиница у продавца, как её заводит платформа (`PUT /seller/organizations/{id}`, Э4) */
export interface BotOrganization {
  name: string;
  publicKey: string;
  active: boolean;
  hosts: string[];
}

/**
 * Публичный ключ виджета гостиницы (Э4): `sk_` + первые 24 hex HMAC-SHA256(служебный ключ, `seller-widget|<org id>`).
 * Считает платформа и никуда не записывает — ключ выводим заново; из него служебный ключ не восстановить, поэтому ему
 * можно стоять в теге на чужой странице. Продавец хранит строку и просто сравнивает.
 */
export function widgetOrgKey(serviceKey: string, organizationId: string): string {
  return (
    'sk_' +
    createHmac('sha256', serviceKey).update(`seller-widget|${organizationId}`).digest('hex').slice(0, 24)
  );
}

/**
 * Публичный ключ виджета АГЕНТА (SA2.5): та же формула, от идентификатора агента. У перенесённого продавца
 * `agent.id = organization_id` (DATA_MODEL §20.4), поэтому ключ Luxx и всех существующих гостиниц не меняется; новый
 * агент получает ключ от своего UUID.
 */
export const widgetAgentKey = (serviceKey: string, agentId: string): string => widgetOrgKey(serviceKey, agentId);

export interface BotKnowledgeFile {
  name: string;
  type: string;
  data: Uint8Array;
}

type Json = Record<string, unknown>;

/** Отбор списка диалогов панели бота; всё необязательно — без отбора прежний ответ */
export interface ConversationListQuery {
  mode?: string;
  limit?: number;
  queue?: 'new' | 'waiting';
  nonempty?: boolean;
  closed?: boolean;
  /** Без диалогов вкладки «Проверка» (канал `sandbox`): они не обращения партнёров */
  excludeSandbox?: boolean;
}

/**
 * Причина отказа из ответа FastAPI: `detail` строкой, списком проверок `{ msg }` или объектом `{ message, fields }`
 * (Б6: поля, в которых слой 9 нашёл инструкции для модели). 401 у панели бота — «сессия истекла»: для служебного
 * ключа это неверный ключ. 403 бывает разным — адрес платформы не в списке панели, маршрут закрыт ключу, — и тогда
 * нужны слова продавца; без них это тоже ключ.
 */
function rejectionOf(
  body: unknown,
  status: number,
  bot: BotNames,
): { detail: string; fields: string[] } {
  const keyRejected = `${bot.name} не принял служебный ключ платформы`;
  const none = { detail: '', fields: [] as string[] };
  const detail =
    body && typeof body === 'object' ? (body as { detail?: unknown }).detail : undefined;
  let found = none;
  if (typeof detail === 'string' && detail.trim() !== '')
    found = { detail: detail.trim(), fields: [] };
  else if (Array.isArray(detail)) {
    const messages = detail
      .map((d) => (d && typeof d === 'object' ? (d as { msg?: unknown }).msg : d))
      .filter((m): m is string => typeof m === 'string' && m.trim() !== '');
    if (messages.length > 0) found = { detail: messages.join('; '), fields: [] };
  } else if (detail && typeof detail === 'object') {
    const { message, fields } = detail as { message?: unknown; fields?: unknown };
    if (typeof message === 'string' && message.trim() !== '')
      found = {
        detail: message.trim(),
        fields: Array.isArray(fields)
          ? fields.filter((f): f is string => typeof f === 'string' && f.trim() !== '')
          : [],
      };
  }
  if (status === 401) return { detail: keyRejected, fields: [] };
  if (status === 403) return found.detail ? found : { detail: keyRejected, fields: [] };
  return found.detail ? found : { detail: `HTTP ${status}`, fields: [] };
}

/** Песочница у бота — в корне экземпляра (`/internal/sandbox`), а не под путём панели: путь зафиксирован его планом */
const SANDBOX_PATH = '/internal/sandbox';
/** Генерация сайта (MKT6) тоже в корне экземпляра, только по служебному ключу */
const SITE_GENERATION_PATH = '/internal/site-generation';

export class BotPanelClient {
  private readonly base: string;
  /** Корень экземпляра без пути панели — для песочницы */
  private readonly origin: string;
  private readonly key: string;
  private readonly organizationId: string | null;
  private readonly agentId: string | null;
  private readonly bot: BotNames;
  private readonly fetchFn: typeof fetch;

  constructor(config: BotPanelClientConfig) {
    const base = config.baseUrl.trim();
    if (!/^https?:\/\/[^\s/]+/i.test(base))
      throw new Error('Клиент панели бота: нужен адрес http(s)://');
    if (config.serviceKey.trim() === '')
      throw new Error('Клиент панели бота: нужен служебный ключ');
    this.base = base.replace(/\/+$/, '');
    this.origin = new URL(this.base).origin;
    this.key = config.serviceKey.trim();
    this.organizationId = config.organizationId?.trim() || null;
    this.agentId = config.agentId?.trim() || null;
    this.bot = config.bot ?? SELLER_BOT;
    this.fetchFn = config.fetch ?? fetch;
  }

  /**
   * Отбор: режим; очередь техподдержки (`new`: за сутки, `waiting`: ждёт ответа), без пустых,
   * открытые или закрытые, без песочницы. Старый образ бота лишние параметры запроса игнорирует.
   */
  listConversations(query: ConversationListQuery = {}): Promise<Json> {
    const params = new URLSearchParams();
    if (query.mode) params.set('mode', query.mode);
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.queue) params.set('queue', query.queue);
    if (query.nonempty) params.set('nonempty', 'true');
    if (query.closed !== undefined) params.set('closed', String(query.closed));
    if (query.excludeSandbox) params.set('exclude_sandbox', 'true');
    const qs = params.toString();
    return this.json('GET', `/conversations${qs ? `?${qs}` : ''}`);
  }

  /** Закрыть обращение: следующее сообщение того же человека откроет новый диалог */
  close(id: string): Promise<Json> {
    return this.json('POST', `/conversations/${encodeURIComponent(id)}/close`);
  }

  conversation(id: string): Promise<Json> {
    return this.json('GET', `/conversations/${encodeURIComponent(id)}`);
  }

  // ── база знаний WETOP Support (S3): только помощник; автора и утверждающего называет платформа ──────────────────

  kbList(query: { status?: string; category?: string; visibility?: string; q?: string }): Promise<Json> {
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(query)) if (value) params.set(name, value);
    const qs = params.toString();
    return this.json('GET', `/support-knowledge${qs ? `?${qs}` : ''}`);
  }

  kbCreate(body: Json): Promise<Json> {
    return this.json('POST', '/support-knowledge', body);
  }

  kbRead(id: string): Promise<Json> {
    return this.json('GET', `/support-knowledge/${encodeURIComponent(id)}`);
  }

  kbUpdate(id: string, body: Json): Promise<Json> {
    return this.json('PUT', `/support-knowledge/${encodeURIComponent(id)}`, body);
  }

  kbPublish(id: string, approvedBy: string): Promise<Json> {
    return this.json('POST', `/support-knowledge/${encodeURIComponent(id)}/publish`, { approved_by: approvedBy });
  }

  kbStatus(id: string, status: string, by: string | null): Promise<Json> {
    return this.json('POST', `/support-knowledge/${encodeURIComponent(id)}/status`, { status, by });
  }

  /** На каких знаниях строились ответы в диалоге — оператору в кабинете */
  conversationKnowledge(id: string): Promise<Json> {
    return this.json('GET', `/conversations/${encodeURIComponent(id)}/knowledge`);
  }

  /** Журнал действий бота в диалоге (S6): предложил, подтвердил, выполнил, передал человеку */
  conversationActions(id: string): Promise<Json> {
    return this.json('GET', `/conversations/${encodeURIComponent(id)}/actions`);
  }

  /** Пустой черновик знания из закрытого обращения; переписка не копируется */
  knowledgeDraft(id: string, by: string | null): Promise<Json> {
    return this.json('POST', `/conversations/${encodeURIComponent(id)}/knowledge-draft`, { by });
  }

  takeover(id: string): Promise<Json> {
    return this.json('POST', `/conversations/${encodeURIComponent(id)}/takeover`);
  }

  release(id: string): Promise<Json> {
    return this.json('POST', `/conversations/${encodeURIComponent(id)}/release`);
  }

  reply(id: string, text: string): Promise<Json> {
    return this.json('POST', `/conversations/${encodeURIComponent(id)}/reply`, { text });
  }

  knowledge(): Promise<Json> {
    return this.json('GET', '/knowledge');
  }

  uploadKnowledge(file: BotKnowledgeFile): Promise<Json> {
    const form = new FormData();
    // копия на своём ArrayBuffer: Blob не принимает представление поверх чужого (SharedArrayBuffer)
    form.append('file', new Blob([new Uint8Array(file.data)], { type: file.type }), file.name);
    return this.request('POST', '/knowledge', form, TIMEOUT_MS);
  }

  /** `excludeSandbox` убирает из чисел диалоги вкладки «Проверка», как и в очереди */
  summary(excludeSandbox = false): Promise<Json> {
    return this.json('GET', `/summary${excludeSandbox ? '?exclude_sandbox=true' : ''}`);
  }

  sandbox(input: { externalId: string; text: string }): Promise<Json> {
    return this.request(
      'POST',
      SANDBOX_PATH,
      JSON.stringify({
        external_id: input.externalId,
        text: input.text,
        // у продавца ход песочницы идёт в организации: чей промпт и чьи знания брать (Э4)
        ...(this.organizationId ? { organization_id: this.organizationId } : {}),
      }),
      SANDBOX_TIMEOUT_MS,
      this.origin,
    );
  }

  /**
   * Генерация первой версии сайта (MKT6, контракт `site-generation/0`). Клиент для неё создаётся без организации и
   * агента: ключ модели только платформы, и бот организацию на этом входе не принимает. Исходы модели бот отдаёт
   * ответом 200; нет связи, таймаут и 5xx здесь `BotUnavailableError`, их расход неизвестен.
   */
  siteGeneration(body: Json): Promise<Json> {
    return this.request('POST', SITE_GENERATION_PATH, JSON.stringify(body), SITE_GENERATION_TIMEOUT_MS, this.origin);
  }

  /** Завести или поправить гостиницу у продавца (Э4): имя, действует ли, домены, публичный ключ виджета */
  putOrganization(id: string, org: BotOrganization): Promise<Json> {
    return this.json('PUT', `/seller/organizations/${encodeURIComponent(id)}`, {
      name: org.name,
      public_key: org.publicKey,
      active: org.active,
      hosts: org.hosts,
    });
  }

  /**
   * Правила бота — текст системного промпта (`GET /prompt`). Служебному ключу бот открывает их только у помощника
   * (`BOT_ROLE=support`, ADR-084): ядро правил продавца платформа не переписывает.
   */
  prompt(): Promise<Json> {
    return this.json('GET', '/prompt');
  }

  putPrompt(text: string): Promise<Json> {
    return this.json('PUT', '/prompt', { text });
  }

  /** Модель и список разрешённых (`GET /settings`): секретов в ответе бота нет */
  settings(): Promise<Json> {
    return this.json('GET', '/settings');
  }

  /** Смена модели — только из списка бота (`LLM_ALLOWED_MODELS`), свободного поля нет */
  putModel(model: string): Promise<Json> {
    return this.json('PUT', '/settings/model', { model });
  }

  putProfile(payload: unknown): Promise<Json> {
    return this.json('PUT', '/seller/profile', payload);
  }

  /** Инструкция продавцу одним текстом (ADR-097): ядро правил бот ставит сам и сверху */
  putSellerPrompt(payload: { object_name: string; text: string }): Promise<Json> {
    return this.json('PUT', '/seller/prompt', payload);
  }

  /** Ключ модели партнёра (С2): статус — только «установлен + последние 4 знака», сам ключ бот не отдаёт */
  llmKeyStatus(orgId: string): Promise<Json> {
    return this.json('GET', `/seller/organizations/${encodeURIComponent(orgId)}/llm-key`);
  }

  /** Пустой ключ снимает сохранённый */
  putLlmKey(orgId: string, key: string): Promise<Json> {
    return this.json('PUT', `/seller/organizations/${encodeURIComponent(orgId)}/llm-key`, { key });
  }

  /** Проверка ключа живым вызовом роутера у бота; наружу — только вердикт */
  checkLlmKey(orgId: string, key: string): Promise<Json> {
    return this.json('POST', `/seller/organizations/${encodeURIComponent(orgId)}/llm-key/check`, {
      key,
    });
  }

  /** Подключение WhatsApp (С3): токен и секрет Meta бот хранит шифрованными и назад не отдаёт */
  telegram(orgId: string, action: 'status' | 'check' | 'connect' | 'disconnect', body?: unknown): Promise<Json> {
    const path = `/seller/organizations/${encodeURIComponent(orgId)}/telegram`;
    if (action === 'status') return this.json('GET', path);
    if (action === 'connect') return this.json('PUT', path, body);
    return this.json('POST', `${path}/${action}`, body);
  }

  whatsappStatus(orgId: string): Promise<Json> {
    return this.json('GET', `/seller/organizations/${encodeURIComponent(orgId)}/whatsapp`);
  }

  putWhatsApp(
    orgId: string,
    input: { phoneNumberId: string; token: string; appSecret: string },
  ): Promise<Json> {
    return this.json('PUT', `/seller/organizations/${encodeURIComponent(orgId)}/whatsapp`, {
      phone_number_id: input.phoneNumberId,
      token: input.token,
      app_secret: input.appSecret,
    });
  }

  checkWhatsApp(orgId: string, input: { phoneNumberId: string; token: string }): Promise<Json> {
    return this.json('POST', `/seller/organizations/${encodeURIComponent(orgId)}/whatsapp/check`, {
      phone_number_id: input.phoneNumberId,
      token: input.token,
    });
  }

  /**
   * Рассказ владельца → поля анкеты (С1 «под ключ»): бот раскладывает свободный текст по полям Б6/Б7 своей
   * моделью и слоем 9; промптом рассказ не становится. Таймаут — как у песочницы: внутри вызов модели.
   */
  generateInstruction(story: string): Promise<Json> {
    return this.request('POST', '/generate-instruction', JSON.stringify({ story }), SANDBOX_TIMEOUT_MS);
  }

  extractProfile(story: string): Promise<Json> {
    return this.request('POST', '/extract-profile', JSON.stringify({ story }), SANDBOX_TIMEOUT_MS);
  }

  putFacts(payload: unknown): Promise<Json> {
    return this.json('PUT', '/seller/facts', payload);
  }

  private json(method: string, path: string, body?: unknown): Promise<Json> {
    return this.request(
      method,
      path,
      body === undefined ? undefined : JSON.stringify(body),
      TIMEOUT_MS,
    );
  }

  private async request(
    method: string,
    path: string,
    body: string | FormData | undefined,
    timeoutMs: number,
    root: string = this.base,
  ): Promise<Json> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-service-key': this.key,
      ...(this.organizationId ? { 'x-organization': this.organizationId } : {}),
      ...(this.agentId ? { 'x-agent': this.agentId } : {}),
    };
    // У FormData заголовок с границей ставит сам fetch
    if (typeof body === 'string') headers['content-type'] = 'application/json';
    let res: Response;
    try {
      res = await this.fetchFn(`${root}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut =
        error instanceof DOMException &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');
      // Текст исходной ошибки не пробрасываем: в нём бывает адрес, а то и заголовки запроса
      throw new BotUnavailableError(
        timedOut ? `${this.bot.name} не ответил вовремя` : `Нет связи с ${this.bot.withName}`,
      );
    }
    // тело не JSON — отказ всё равно называется по коду ответа
    const parsed: unknown = await res.json().catch(() => null);
    if (res.status >= 500)
      throw new BotUnavailableError(`${this.bot.name} недоступен (HTTP ${res.status})`);
    if (!res.ok) {
      const { detail, fields } = rejectionOf(parsed, res.status, this.bot);
      throw new BotRejectedError(res.status, detail, fields, this.bot);
    }
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Json) : {};
  }
}

/**
 * Прежние имена раздела «ИИ-продавец» — те же классы, а не копии: его проверки `instanceof` и заглушки тестов работают
 * как раньше.
 */
export {
  BotPanelClient as SellerClient,
  BotRejectedError as SellerRejectedError,
  BotUnavailableError as SellerUnavailableError,
};
export type SellerClientConfig = BotPanelClientConfig;
export type SellerKnowledgeFile = BotKnowledgeFile;
