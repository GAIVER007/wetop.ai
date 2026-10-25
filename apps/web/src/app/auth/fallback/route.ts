import {
  PHONE_COUNTRIES,
  PRIVACY_POLICY_URL,
  BUSINESS_VERTICALS,
  parseBusinessVertical,
  verticalDefinition,
} from '@pms/domain';
import { ApiError, authApi } from '../../../lib/api';
import { publicAuthUrl, safeReturnPath } from '../../../lib/auth-entry';
import { readBoundedText } from '../../../lib/bounded-body';
import { sessionCookieHeader } from '../../../lib/site-auth';
import { clearScopeCookieHeader, scopeResolvePath } from '../../../lib/scope-pointer';
import { msg, translator, type DeskLocale, type Translate } from '../../../i18n';
import { cookieLocale } from '../../../i18n/server';

/** Полный HTML-ответ: резервный вход не зависит от JS и потоковой гидратации React. */
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const headers = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
};

function formPage(
  lang: DeskLocale,
  t: Translate,
  mode: string,
  next: string,
  email = '',
  error = '',
  status = 200,
  vertical = 'HOSPITALITY',
) {
  const register = mode === 'register';
  const field = (label: string, name: string, type = 'text', extra = '') =>
    `<label>${t(label)}<input name="${name}" type="${type}" required ${extra}></label>`;
  return new Response(
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${register ? t('Регистрация') : t('Вход')}: WETOP</title>
    <style>body{margin:0;background:#0a1322;color:#edf2fa;font:16px/1.5 system-ui}main{max-width:440px;padding:32px 24px;margin:4vh auto}a{color:#80bbff;display:inline-block;padding:10px 0}h1{font-size:28px}form,label{display:grid;gap:8px}form{gap:18px}input,select,button{box-sizing:border-box;width:100%;min-height:46px;border-radius:8px;padding:10px;font:inherit;background:#122236;color:inherit;border:1px solid #58718d}button{background:#146bcb;color:white;cursor:pointer}input:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #80bbff;outline-offset:3px}.consent{display:flex;align-items:flex-start}.consent input{width:24px;min-height:24px;flex:none}.error{padding:12px;border:1px solid #eba988;border-radius:8px}p{color:#b9c9dc}</style></head><body><main>
    <a href="${escape(publicAuthUrl())}">${t('← На главную WETOP')}</a><h1>${register ? t('Регистрация') : t('Вход в WETOP')}</h1>
    <p>${t('Резервная форма. Работает без JavaScript.')}</p>${error ? `<p class="error" role="alert">${escape(t(error))}</p>` : ''}
    <form method="post" action="/auth/fallback"><input type="hidden" name="mode" value="${register ? 'register' : 'login'}"><input type="hidden" name="next" value="${escape(safeReturnPath(next))}">
    ${field('Email', 'email', 'email', `autocomplete="username" maxlength="254" value="${escape(email)}"`)}
    ${register ? `${field(msg('Имя'), 'name', 'text', 'autocomplete="name" maxlength="200"')}${field(msg('Название бизнеса'), 'businessName', 'text', 'maxlength="200"')}<label>${t('Чем вы управляете?')}<select name="vertical">${BUSINESS_VERTICALS.map((id) => `<option value="${id}"${id === vertical ? ' selected' : ''}>${escape(t(verticalDefinition(id).label))}${id === 'HOSPITALITY' ? '' : t(' (Пилот, по приглашению)')}</option>`).join('')}</select></label><label>${t('Код страны')}<select name="phoneCountry">${PHONE_COUNTRIES.map((c) => `<option value="${escape(c.code)}"${c.code === 'KZ' ? ' selected' : ''}>${escape(c.name)} ${escape(c.dial)}</option>`).join('')}</select></label>${field(msg('Телефон'), 'phone', 'tel', 'autocomplete="tel-national" maxlength="40"')}` : ''}
    ${field(msg('Пароль'), 'password', 'password', `autocomplete="${register ? 'new-password' : 'current-password'}"${register ? ' minlength="10"' : ''}`)}
    ${register ? `<label class="consent"><input type="checkbox" name="privacyAccepted" required><span>${t('Я ознакомился с')} <a href="${PRIVACY_POLICY_URL}">${t('политикой конфиденциальности')}</a> ${t('и согласен на обработку данных')}</span></label>` : ''}
    <button type="submit">${register ? t('Создать организацию') : t('Войти')}</button></form>
    <p><a href="/login/reset">${t('Забыли пароль?')}</a></p><a href="/auth/fallback?mode=${register ? 'login' : 'register'}">${register ? t('Войти') : t('Регистрация')}</a>
    </main></body></html>`,
    { status, headers },
  );
}

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const mode = q.get('mode') ?? 'login';
  const lang = await cookieLocale();
  const t = translator(lang);
  if (mode === 'register' && !(await authApi.options().catch(() => null))?.registrationEnabled) {
    return formPage(
      lang,
      t,
      'login',
      q.get('next') ?? '',
      '',
      msg('Самостоятельная регистрация временно закрыта.'),
    );
  }
  return formPage(
    lang,
    t,
    mode,
    q.get('next') ?? '',
    q.get('email')?.slice(0, 254) ?? '',
    '',
    200,
    parseBusinessVertical(q.get('vertical')) ?? 'HOSPITALITY',
  );
}

export async function POST(request: Request): Promise<Response> {
  // Нативная форма не использует CORS: защищаем вход и регистрацию от login-CSRF проверкой Origin.
  const origin = new URL(process.env.APP_URL || request.url).origin;
  const lang = await cookieLocale();
  const t = translator(lang);
  if (request.headers.get('origin') !== origin)
    return new Response(t('Запрос не с приложения WETOP'), { status: 403 });
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
    return new Response(t('Нужна форма'), { status: 415 });
  }
  const body = await readBoundedText(request, 16_384);
  if (!body.ok) return new Response(t('Слишком большой запрос'), { status: 413 });
  const form = new URLSearchParams(body.text);
  const field = (key: string) => (form.get(key) ?? '').trim();
  const email = field('email');
  const mode = field('mode');
  const next = safeReturnPath(field('next'));
  const info = {
    ip: request.headers.get('cf-connecting-ip'),
    userAgent: request.headers.get('user-agent'),
  };
  try {
    if (mode === 'register') {
      const vertical = parseBusinessVertical(field('vertical'));
      if (form.has('vertical') && !vertical)
        throw new ApiError(400, msg('Выберите направление бизнеса'));
      const result = await authApi.register(
        {
          email,
          name: field('name'),
          ...(form.has('businessName')
            ? { businessName: field('businessName'), ...(vertical ? { vertical } : {}) }
            : { hotelName: field('hotelName') }),
          password: form.get('password') ?? '',
          phoneCountry: field('phoneCountry'),
          phone: field('phone'),
          privacyAccepted: form.get('privacyAccepted') === 'on',
        },
        info,
      );
      return new Response(null, {
        status: 303,
        headers: {
          'cache-control': 'no-store',
          location: `/login/check-email?email=${encodeURIComponent(result.email)}${result.sent ? '' : '&sent=0'}`,
        },
      });
    }
    if (!email || !form.get('password'))
      return formPage(lang, t, mode, next, email, msg('Введите почту и пароль'), 400);
    const result = await authApi.login({ email, password: form.get('password')! }, info);
    // Сессия новая, указатель прошлого входа снимается; филиал выберет сервер по `GET /branches` (SCOPE-HARDENING)
    const headers = new Headers({ 'cache-control': 'no-store', location: scopeResolvePath(next) });
    headers.append('set-cookie', sessionCookieHeader(result, process.env));
    headers.append('set-cookie', clearScopeCookieHeader(process.env));
    return new Response(null, { status: 303, headers });
  } catch (error) {
    return formPage(
      lang,
      t,
      mode,
      next,
      email,
      error instanceof ApiError ? error.message : msg('Нет связи с сервером. Попробуйте ещё раз.'),
      error instanceof ApiError ? error.status : 503,
    );
  }
}
