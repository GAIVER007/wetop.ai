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

const TIMEOUT_MS = 15_000;
/** Ход в песочнице — каскад моделей, до минуты (ТЗ §3 бота); ждём с запасом */
const SANDBOX_TIMEOUT_MS = 90_000;

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
  /** Чья это панель — для слов ошибок; без него — продавец, как было до «Техподдержки» */
  bot?: BotNames;
  fetch?: typeof fetch;
}

export interface BotKnowledgeFile {
  name: string;
  type: string;
  data: Uint8Array;
}

type Json = Record<string, unknown>;

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

export class BotPanelClient {
  private readonly base: string;
  /** Корень экземпляра без пути панели — для песочницы */
  private readonly origin: string;
  private readonly key: string;
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
    this.bot = config.bot ?? SELLER_BOT;
    this.fetchFn = config.fetch ?? fetch;
  }

  listConversations(query: { mode?: string; limit?: number } = {}): Promise<Json> {
    const params = new URLSearchParams();
    if (query.mode) params.set('mode', query.mode);
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    const qs = params.toString();
    return this.json('GET', `/conversations${qs ? `?${qs}` : ''}`);
  }

  conversation(id: string): Promise<Json> {
    return this.json('GET', `/conversations/${encodeURIComponent(id)}`);
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

  summary(): Promise<Json> {
    return this.json('GET', '/summary');
  }

  sandbox(input: { externalId: string; text: string }): Promise<Json> {
    return this.request(
      'POST',
      SANDBOX_PATH,
      JSON.stringify({ external_id: input.externalId, text: input.text }),
      SANDBOX_TIMEOUT_MS,
      this.origin,
    );
  }

  putProfile(payload: unknown): Promise<Json> {
    return this.json('PUT', '/seller/profile', payload);
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
