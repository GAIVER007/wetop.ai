/**
 * Клиент ИИ-продавца (ТЗ ред. 1 П7, Б5; ADR-079; контракт — docs/assistant/README.md §4).
 *
 * Все вызовы идут из API платформы по внутреннему адресу `SELLER_URL` с заголовком `X-Service-Key` — браузер ни
 * адреса, ни ключа не видит. Отказы двух видов, и раздел показывает их по-разному: продавец **недоступен** (нет связи,
 * тайм-аут, 5xx) — повторить позже; продавец **отклонил** (4xx) — показать его причину, повтор не поможет.
 * Ключа нет ни в адресе, ни в тексте ошибки.
 */

const TIMEOUT_MS = 15_000;
/** Ход в песочнице — каскад моделей, до минуты (ТЗ §3 бота); ждём с запасом */
const SANDBOX_TIMEOUT_MS = 90_000;

/** Продавец не ответил или ответил 5xx: повторить позже */
export class SellerUnavailableError extends Error {
  override readonly name = 'SellerUnavailableError';
}

/** Продавец отказал (4xx): причина — его, повтор не поможет */
export class SellerRejectedError extends Error {
  override readonly name = 'SellerRejectedError';
  constructor(
    readonly status: number,
    readonly detail: string,
    /** Поля, которые продавец назвал в отказе (Б6: `detail.fields`), — его имена, как в теле запроса */
    readonly fields: readonly string[] = [],
  ) {
    super(`ИИ-продавец отклонил запрос (HTTP ${status}): ${detail}`);
  }
}

export interface SellerClientConfig {
  /** Внутренний адрес API панели продавца, с путём панели */
  baseUrl: string;
  serviceKey: string;
  fetch?: typeof fetch;
}

export interface SellerKnowledgeFile {
  name: string;
  type: string;
  data: Uint8Array;
}

type Json = Record<string, unknown>;

const KEY_REJECTED = 'ИИ-продавец не принял служебный ключ платформы';

/**
 * Причина отказа из ответа FastAPI: `detail` строкой, списком проверок `{ msg }` или объектом `{ message, fields }`
 * (Б6: поля, в которых слой 9 нашёл инструкции для модели). 401 у панели бота — «сессия истекла»: для служебного
 * ключа это неверный ключ. 403 бывает разным — адрес платформы не в списке панели, маршрут закрыт ключу, — и тогда
 * нужны слова продавца; без них это тоже ключ.
 */
function rejectionOf(body: unknown, status: number): { detail: string; fields: string[] } {
  const none = { detail: '', fields: [] as string[] };
  const detail = body && typeof body === 'object' ? (body as { detail?: unknown }).detail : undefined;
  let found = none;
  if (typeof detail === 'string' && detail.trim() !== '') found = { detail: detail.trim(), fields: [] };
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
  if (status === 401) return { detail: KEY_REJECTED, fields: [] };
  if (status === 403) return found.detail ? found : { detail: KEY_REJECTED, fields: [] };
  return found.detail ? found : { detail: `HTTP ${status}`, fields: [] };
}

/** Песочница у бота — в корне экземпляра (`/internal/sandbox`), а не под путём панели: путь зафиксирован его планом */
const SANDBOX_PATH = '/internal/sandbox';

export class SellerClient {
  private readonly base: string;
  /** Корень экземпляра без пути панели — для песочницы */
  private readonly origin: string;
  private readonly key: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: SellerClientConfig) {
    const base = config.baseUrl.trim();
    if (!/^https?:\/\/[^\s/]+/i.test(base)) throw new Error('Клиент продавца: нужен адрес http(s)://');
    if (config.serviceKey.trim() === '') throw new Error('Клиент продавца: нужен служебный ключ');
    this.base = base.replace(/\/+$/, '');
    this.origin = new URL(this.base).origin;
    this.key = config.serviceKey.trim();
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

  uploadKnowledge(file: SellerKnowledgeFile): Promise<Json> {
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
        error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
      // Текст исходной ошибки не пробрасываем: в нём бывает адрес, а то и заголовки запроса
      throw new SellerUnavailableError(
        timedOut ? 'ИИ-продавец не ответил вовремя' : 'Нет связи с ИИ-продавцом',
      );
    }
    // тело не JSON — отказ всё равно называется по коду ответа
    const parsed: unknown = await res.json().catch(() => null);
    if (res.status >= 500) throw new SellerUnavailableError(`ИИ-продавец недоступен (HTTP ${res.status})`);
    if (!res.ok) {
      const { detail, fields } = rejectionOf(parsed, res.status);
      throw new SellerRejectedError(res.status, detail, fields);
    }
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Json) : {};
  }
}
