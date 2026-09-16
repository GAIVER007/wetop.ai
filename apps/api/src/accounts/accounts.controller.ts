import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { CODE_REJECTED_MESSAGE, SESSION_ENDED_MESSAGE, SESSION_TTL_MS } from '@pms/domain';
import { AccountsService, type Session } from './accounts.service';
import { SESSION_COOKIE, cookieOptions, sessionFromCookieHeader } from './cookie';

/**
 * Откуда берём ключ. Основной способ — кука: она `HttpOnly`, и чужой скрипт на странице её не
 * прочитает. Заголовок `Authorization: Bearer` принимаем тоже — для проверок и для вызовов не
 * из браузера. Кука имеет приоритет: если пришло и то и другое, доверяем тому, что браузер
 * подставил сам.
 */
export function tokenFrom(cookieHeader: string | undefined, authorization: string | undefined): string | null {
  return sessionFromCookieHeader(cookieHeader) ?? bearer(authorization);
}

/** Ключ из заголовка `Authorization: Bearer <ключ>`. Ничего другого не принимаем. */
export function bearer(header: string | undefined): string | null {
  const v = header?.trim();
  if (!v) return null;
  const [scheme, ...rest] = v.split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token || null;
}

/**
 * За Cloudflare адрес соединения всегда один и тот же — адрес самого Cloudflare, и предел по
 * нему бесполезен. Настоящий адрес приходит заголовком `CF-Connecting-IP`
 * (`reports/wetop-domain-2026-09-15.md`). Если заголовка нет, предела по сети просто не будет:
 * выдумывать адрес нельзя, а предел на почтовый адрес работает в любом случае.
 */
export function clientIp(cfIp: string | undefined): string | null {
  const v = cfIp?.trim();
  return v ? v : null;
}

interface SessionView {
  email: string;
  organizationId: string;
  organizationName: string;
  organizationStatus: string;
  trialEndsAt: string | null;
}

function view(s: Session): SessionView {
  return {
    email: s.email,
    organizationId: s.organizationId,
    organizationName: s.organizationName,
    organizationStatus: s.organizationStatus,
    trialEndsAt: s.trialEndsAt ? s.trialEndsAt.toISOString() : null,
  };
}

@Controller('auth')
export class AccountsController {
  constructor(@Inject(AccountsService) private readonly accounts: AccountsService) {}

  /**
   * Запросить код. Всегда 204, что бы ни случилось: есть такой адрес, нет его, исчерпан предел —
   * ответ один. Иначе перебором по форме входа составляется список наших клиентов.
   */
  @Post('code')
  @HttpCode(204)
  async requestCode(
    @Body() body: { email?: unknown },
    @Headers('cf-connecting-ip') cfIp?: string,
  ): Promise<void> {
    await this.accounts.requestCode(body?.email, clientIp(cfIp));
  }

  /** Проверить код и войти. Отказ — всегда один и тот же текст, без подробностей. */
  @Post('verify')
  @HttpCode(200)
  async verify(
    @Body() body: { email?: unknown; code?: unknown },
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') userAgent?: string,
  ): Promise<{ token: string; session: SessionView }> {
    const result = await this.accounts.verify(body?.email, body?.code, userAgent?.trim() || null);
    if (!result) throw new UnauthorizedException(CODE_REJECTED_MESSAGE);
    const opts = cookieOptions(process.env, Math.floor(SESSION_TTL_MS / 1000));
    res.cookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: opts.secure,
      maxAge: opts.maxAgeSeconds * 1000,
      ...(opts.domain ? { domain: opts.domain } : {}),
    });
    // Ключ отдаём и телом: стойка ходит в API и со своего сервера, где куки браузера нет.
    return { token: result.token, session: view(result.session) };
  }

  /** Кто вошёл. Экрану `/login` нужно это, чтобы понимать, показывать форму или рабочее место. */
  @Get('me')
  async me(
    @Headers('cookie') cookie?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<SessionView> {
    const session = await this.accounts.whoIs(tokenFrom(cookie, authorization));
    if (!session) throw new UnauthorizedException(SESSION_ENDED_MESSAGE);
    return view(session);
  }

  /** Выход. Всегда 204: выйти повторно или с чужим ключом — не ошибка, а пустое действие. */
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Res({ passthrough: true }) res: Response,
    @Headers('cookie') cookie?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<void> {
    await this.accounts.logout(tokenFrom(cookie, authorization));
    const opts = cookieOptions(process.env, 0);
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: opts.secure,
      ...(opts.domain ? { domain: opts.domain } : {}),
    });
  }
}
