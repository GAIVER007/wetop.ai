/**
 * Вход клиента через Facebook Login for Business и обмен кода на ключ SUAT (docs/meta/README.md, «Вход клиента и
 * чтение кабинета»). Секрет приложения и код живут только в серверном запросе к Graph API и в текст ошибки не попадают.
 */
import { MetaApiError, META_API_VERSION } from './client';

export interface MetaAppConfig {
  appId: string;
  appSecret: string;
  /** Конфигурация входа из App Dashboard: вид ключа SUAT, право ads_read, рекламные кабинеты */
  configId: string;
  /** Адрес возврата, тот же, что в «Valid OAuth redirect URIs» приложения */
  redirectUri: string;
}

/** Приложение Meta настроено, только если владелец вписал все четыре значения (SECURITY.md §3) */
export function metaAppConfigFromEnv(env: Record<string, string | undefined>): MetaAppConfig | null {
  const appId = env.META_APP_ID?.trim();
  const appSecret = env.META_APP_SECRET?.trim();
  const configId = env.META_LOGIN_CONFIG_ID?.trim();
  const redirectUri = env.META_REDIRECT_URI?.trim();
  return appId && appSecret && configId && redirectUri ? { appId, appSecret, configId, redirectUri } : null;
}

/** Окно входа: код авторизации (SUAT выдаётся только так), конфигурация вместо `scope` */
export function metaLoginUrl(c: Pick<MetaAppConfig, 'appId' | 'configId' | 'redirectUri'> & { state: string }): string {
  const url = new URL(`https://www.facebook.com/${META_API_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', c.appId);
  url.searchParams.set('redirect_uri', c.redirectUri);
  url.searchParams.set('state', c.state);
  url.searchParams.set('config_id', c.configId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('override_default_response_type', 'true');
  return url.toString();
}

/** Код из адреса возврата → ключ SUAT; только сервером */
export async function exchangeMetaCode(
  c: Pick<MetaAppConfig, 'appId' | 'appSecret' | 'redirectUri'> & { code: string; fetch?: typeof fetch },
): Promise<string> {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`);
  url.searchParams.set('client_id', c.appId);
  url.searchParams.set('redirect_uri', c.redirectUri);
  url.searchParams.set('client_secret', c.appSecret);
  url.searchParams.set('code', c.code);
  type TokenResponse = { access_token?: string; error?: { message?: string; code?: number } };
  let body: TokenResponse | null = null;
  let status = 0;
  try {
    const res = await (c.fetch ?? fetch)(url.toString(), { signal: AbortSignal.timeout(30_000) });
    status = res.status;
    body = (await res.json().catch(() => null)) as TokenResponse | null;
  } catch {
    // сеть: ответа нет
  }
  if (status === 200 && body?.access_token) return body.access_token;
  const text = (body?.error?.message ?? `HTTP ${status || 'нет ответа'}`)
    .split(c.appSecret)
    .join('***')
    .split(c.code)
    .join('***');
  throw new MetaApiError(`Meta не выдала ключ: ${text}`, body?.error?.code ?? 0, false);
}
