/**
 * Обращение скриптов и задач к API PMS (DATA_MODEL §13 шаг 1, ADR-046).
 *
 * Сторож, импорт из Exely и сверки — не люди: сессии у них нет, и записи в журнале от них идут без автора.
 * Когда замок API включают (`AUTH_REQUIRED=1`), они проходят по служебному ключу `SERVICE_API_KEY`.
 * Пока замок выключен, ключа может не быть — запрос уходит как раньше, ничего не меняется.
 */
export function serviceHeaders(env: Record<string, string | undefined>): Record<string, string> {
  const key = env['SERVICE_API_KEY']?.trim();
  return key ? { 'x-wetop-service-key': key } : {};
}

export class ServiceApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceApiError';
  }
}

/**
 * Тот же `fetch`, но со служебным ключом. Ответы отдаются как есть — у каждого скрипта свой разбор;
 * перехватывается только 401: иначе после включения замка скрипты падали бы с непонятным «HTTP 401».
 */
export async function serviceFetch(
  url: string,
  init: RequestInit = {},
  options: { env?: Record<string, string | undefined>; fetch?: typeof fetch } = {},
): Promise<Response> {
  const env = options.env ?? process.env;
  const call = options.fetch ?? fetch;
  const response = await call(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), ...serviceHeaders(env) },
  });

  if (response.status === 401) {
    let detail = '';
    try {
      const body = (await response.clone().json()) as { message?: string };
      if (body.message) detail = `: ${body.message}`;
    } catch {
      /* тело не JSON */
    }
    const key = env['SERVICE_API_KEY']?.trim();
    throw new ServiceApiError(
      401,
      key
        ? `API не принял служебный ключ${detail}. Проверьте SERVICE_API_KEY — он должен совпадать со значением в окружении API`
        : `API требует входа${detail}. Скриптам нужен служебный ключ: впишите SERVICE_API_KEY в .env (одно значение для API и для скриптов)`,
    );
  }
  return response;
}
