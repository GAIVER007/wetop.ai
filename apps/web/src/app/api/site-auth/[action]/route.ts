import { parseBusinessVertical } from '@pms/domain';
import { ApiError } from '../../../../lib/api-error';
import { authApi } from '../../../../lib/api';
import { safeReturnPath } from '../../../../lib/auth-entry';
import { sessionToken } from '../../../../lib/session';
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
  session: {
    method: 'GET',
    run: async () => {
      if (!(await sessionToken())) return { body: { authenticated: false } };
      try {
        return { body: { authenticated: !!(await authApi.me()).user } };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return { body: { authenticated: false } };
        }
        throw error;
      }
    },
  },
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
      const context = await authApi.registrationContext(result.token);
      return {
        body: {
          next:
            context && context.vertical !== 'HOSPITALITY'
              ? '/register/complete'
              : safeReturnPath(field(body, 'next')),
        },
        session: { token: result.token, expiresAt: result.expiresAt },
      };
    },
  },
  register: {
    method: 'POST',
    run: async (body, info) => {
      const raw = body as Record<string, unknown> | null;
      const hasVertical = Object.prototype.hasOwnProperty.call(raw ?? {}, 'vertical');
      const vertical = hasVertical ? parseBusinessVertical(raw?.vertical) : undefined;
      if (hasVertical && !vertical) throw new ApiError(400, 'Выберите направление бизнеса');
      const result = await authApi.register(
        {
          email: field(body, 'email').trim(),
          name: field(body, 'name').trim(),
          ...(vertical ? { vertical } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'businessName')
            ? { businessName: field(body, 'businessName').trim() }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'hotelName')
            ? { hotelName: field(body, 'hotelName').trim() }
            : {}),
          password: field(body, 'password'),
          phoneCountry: field(body, 'phoneCountry').trim(),
          phone: field(body, 'phone').trim(),
          // окно на главной шлёт JSON: согласие — только настоящее `true`
          privacyAccepted: (body as Record<string, unknown> | null)?.['privacyAccepted'] === true,
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
