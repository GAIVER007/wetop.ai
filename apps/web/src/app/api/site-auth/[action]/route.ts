import { ApiError } from '../../../../lib/api-error';
import { authApi } from '../../../../lib/api';
import { field, handleSiteAuth, type SiteAuthAction } from '../../../../lib/site-auth';

/**
 * Окно входа и регистрации на wetop.ai (plans/site-auth-dialog-tour-2026-09-27.md, ADR-100). Те же вызовы API,
 * что у экранов `/login` и `/register` стойки: правила, тексты ошибок и пределы попыток — одни на оба пути.
 *
 * - `GET options` — открыта ли регистрация (ADR-055: при сбое — закрыта);
 * - `POST login` — вход паролем, кука сессии, `{ next }`;
 * - `POST register` — регистрация, письмо подтверждения; сессии нет, пока почта не подтверждена;
 * - `POST resend` — письмо ещё раз; ответ один для любой почты.
 */
const ACTIONS: Record<string, { method: 'GET' | 'POST'; run: SiteAuthAction }> = {
  options: {
    method: 'GET',
    run: async () => {
      const enabled = await authApi
        .options()
        .then((o) => o?.registrationEnabled === true)
        .catch(() => false);
      return { body: { registrationEnabled: enabled } };
    },
  },
  login: {
    method: 'POST',
    run: async (body, info) => {
      const email = field(body, 'email').trim();
      const password = field(body, 'password');
      if (!email || !password) throw new ApiError(400, 'Введите почту и пароль');
      const result = await authApi.login({ email, password }, info);
      return {
        body: { next: '/today' },
        session: { token: result.token, expiresAt: result.expiresAt },
      };
    },
  },
  register: {
    method: 'POST',
    run: async (body, info) => {
      const result = await authApi.register(
        {
          email: field(body, 'email').trim(),
          name: field(body, 'name').trim(),
          hotelName: field(body, 'hotelName').trim(),
          password: field(body, 'password'),
        },
        info,
      );
      return { body: { email: result.email, sent: result.sent } };
    },
  },
  resend: {
    method: 'POST',
    run: async (body, info) => {
      const email = field(body, 'email').trim();
      if (!email) throw new ApiError(400, 'Введите почту');
      await authApi.resendVerification({ email }, info);
      return { body: { ok: true } };
    },
  },
};

type Context = { params: Promise<{ action: string }> };

async function handle(request: Request, { params }: Context): Promise<Response> {
  const entry = ACTIONS[(await params).action];
  if (!entry) return Response.json({ message: 'Не найдено' }, { status: 404 });
  if (request.method !== 'OPTIONS' && request.method !== entry.method) {
    return Response.json({ message: 'Метод не поддерживается' }, { status: 405 });
  }
  return handleSiteAuth(request, entry.run, process.env);
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
