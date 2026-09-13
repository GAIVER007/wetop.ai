import type { DataConnection } from '@pms/shared';

/** Credentials are consumed by the backend process, never returned or printed here. */
export function realConfig(env: NodeJS.ProcessEnv) {
  const startApi = !env.APP_API_URL?.trim();
  const apiPort = Number(env.API_PORT?.trim() || '3001');
  if (
    startApi &&
    (!Number.isInteger(apiPort) ||
      apiPort < 1 ||
      apiPort > 65535 ||
      [3000, 4311, 4312].includes(apiPort))
  )
    throw new Error('API_PORT должен быть свободным портом; 3000, 4311 и 4312 зарезервированы.');
  let url: URL;
  try {
    url = new URL(env.APP_API_URL?.trim() || `http://127.0.0.1:${apiPort}`);
  } catch {
    throw new Error('APP_API_URL должен содержать корректный адрес backend.');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    (url.protocol === 'http:' && !loopback) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    ['4311', '4312'].includes(url.port)
  )
    throw new Error(
      'APP_API_URL: используйте HTTPS или локальный backend без ключей в URL; demo/test источники запрещены.',
    );
  if (startApi && !env.DATABASE_URL?.trim())
    throw new Error(
      'Не задан DATABASE_URL. Настройте .env в корне проекта или APP_API_URL для уже работающего backend.',
    );
  return { apiUrl: url.toString().replace(/\/$/, ''), apiPort, startApi };
}

/** A bounded read. No provider calls, redirects, retries, POSTs or remote error-body logging. */
export async function checkRealApi(apiUrl: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/system/connection`, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('Backend недоступен. Проверьте запуск API и его адрес.');
  }
  if (!response.ok)
    throw new Error('Не удалось проверить базу. Обновите и проверьте backend проекта.');
  if (['demo', 'synthetic'].includes(response.headers.get('x-wetop-data-source') ?? ''))
    throw new Error('Подключён демонстрационный или тестовый источник.');
  let result: Partial<DataConnection> | null;
  try {
    result = (await response.json()) as Partial<DataConnection> | null;
  } catch {
    throw new Error('Backend вернул некорректный ответ проверки базы.');
  }
  if (result?.source !== 'database') throw new Error('Источник базы проекта не подтверждён.');
  if (result.state === 'PROPERTY_MISSING')
    throw new Error('База доступна, но гостиница проекта не найдена.');
  if (result.state !== 'READY' || result.database?.connected !== true)
    throw new Error('Backend запущен, но база проекта недоступна.');
}
