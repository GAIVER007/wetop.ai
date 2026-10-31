import { publicAuthUrl } from '../../lib/auth-entry';
import { PARTNER_COOKIE, PARTNER_COOKIE_MAX_AGE, partnerChannelOf, partnerCodeOf, partnerCookieValue } from '../../lib/partner-ref';

export const dynamic = 'force-dynamic';

/**
 * Ссылка партнёра для клиентов (DATA_MODEL §63.3): `app.wetop.ai/start?p=P001&ch=instagram`. Код и канал ложатся в
 * куку на 30 дней, дальше обычная регистрация; при регистрации API само привяжет клиента к партнёру. Без кода или с
 * чужой строкой: просто регистрация, кука не ставится.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = partnerCodeOf(url.searchParams.get('p'));
  const headers = new Headers({ location: publicAuthUrl('register'), 'cache-control': 'no-store' });
  if (code) {
    const secure = url.protocol === 'https:' ? '; Secure' : '';
    const value = encodeURIComponent(partnerCookieValue(code, partnerChannelOf(url.searchParams.get('ch'))));
    // SameSite=None: окно регистрации на wetop.ai шлёт запрос на app.wetop.ai с куками (credentials: include)
    headers.append(
      'set-cookie',
      `${PARTNER_COOKIE}=${value}; Path=/; Max-Age=${PARTNER_COOKIE_MAX_AGE}; HttpOnly; SameSite=${secure ? 'None' : 'Lax'}${secure}`,
    );
  }
  return new Response(null, { status: 307, headers });
}
