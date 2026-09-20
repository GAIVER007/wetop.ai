import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CODE_REJECTED_MESSAGE,
  INVITE_ALREADY_MEMBER_MESSAGE,
  INVITE_EMAIL_MESSAGE,
  INVITE_INVALID_MESSAGE,
  REGISTRATION_EMAIL_MESSAGE,
  REGISTRATION_NAME_MESSAGE,
  SESSION_ENDED_MESSAGE,
  SESSION_TTL_MS,
  isEmailShaped,
  isOrganizationNameShaped,
} from '@pms/domain';
import {
  AccountsService,
  type InvitePreview,
  type InviteView,
  type Session,
  type SessionRow,
} from './accounts.service';
import { SESSION_COOKIE, cookieOptions, sessionFromCookieHeader } from './cookie';

/**
 * Откуда берём ключ. Основной способ — кука: она `HttpOnly`, и чужой скрипт на странице её не
 * прочитает. Заголовок `Authorization: Bearer` принимаем тоже — для проверок и для вызовов не
 * из браузера. Кука имеет приоритет: если пришло и то и другое, доверяем тому, что браузер
 * подставил сам.
 */
export function tokenFrom(
  cookieHeader: string | undefined,
  authorization: string | undefined,
): string | null {
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

  /**
   * Регистрация: организация с пробным периодом на 7 дней и код на почту. Ошибки формы (пустое
   * название, не похожая на почту строка) — 400 с текстом: это про ввод человека, не про то, есть ли
   * у нас такой адрес. Всё остальное — 204, как у запроса кода: занят адрес или нет, наружу не видно.
   */
  @Post('register')
  @HttpCode(204)
  async register(
    @Body() body: { email?: unknown; organizationName?: unknown },
    @Headers('cf-connecting-ip') cfIp?: string,
  ): Promise<void> {
    const email = body?.email;
    const name = body?.organizationName;
    if (typeof email !== 'string' || !isEmailShaped(email)) {
      throw new BadRequestException(REGISTRATION_EMAIL_MESSAGE);
    }
    if (typeof name !== 'string' || !isOrganizationNameShaped(name)) {
      throw new BadRequestException(REGISTRATION_NAME_MESSAGE);
    }
    await this.accounts.register(email, name, clientIp(cfIp));
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

  // ── «Где я вошёл» и «выйти везде» (§13.5) ────────────────────────────────────────────────────

  /** Живые сессии вошедшего: устройство словами, своя помечена. 401 без сессии. */
  @Get('sessions')
  async sessions(
    @Headers('cookie') cookie?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<SessionJson[]> {
    const list = await this.accounts.sessions(tokenFrom(cookie, authorization));
    if (!list) throw new UnauthorizedException(SESSION_ENDED_MESSAGE);
    return list.map(sessionJson);
  }

  /** «Выйти везде»: все сессии человека отозваны, кука снята. Всегда 204, как обычный выход. */
  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(
    @Res({ passthrough: true }) res: Response,
    @Headers('cookie') cookie?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<void> {
    await this.accounts.logoutEverywhere(tokenFrom(cookie, authorization));
    const opts = cookieOptions(process.env, 0);
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: opts.secure,
      ...(opts.domain ? { domain: opts.domain } : {}),
    });
  }

  // ── Приглашения (этап 7, DATA_MODEL §13.6) ──────────────────────────────────────────────────

  /**
   * Пригласить по почте. Только для вошедшего (401 без сессии). Ошибки формы — 400 с текстом:
   * приглашающий уже внутри, скрывать от него состав своей организации незачем.
   */
  @Post('invites')
  @HttpCode(201)
  async createInvite(
    @Body() body: { email?: unknown },
    @Headers('cookie') cookie?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<InviteJson> {
    const outcome = await this.accounts.createInvite(tokenFrom(cookie, authorization), body?.email);
    if (!outcome) throw new UnauthorizedException(SESSION_ENDED_MESSAGE);
    if (!outcome.ok) {
      throw new BadRequestException(
        outcome.reason === 'member' ? INVITE_ALREADY_MEMBER_MESSAGE : INVITE_EMAIL_MESSAGE,
      );
    }
    return inviteJson(outcome.invite);
  }

  /** Ожидающие приглашения своей организации. Ключей в ответе нет — только кого и до когда. */
  @Get('invites')
  async invites(
    @Headers('cookie') cookie?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<InviteJson[]> {
    const list = await this.accounts.pendingInvites(tokenFrom(cookie, authorization));
    if (!list) throw new UnauthorizedException(SESSION_ENDED_MESSAGE);
    return list.map(inviteJson);
  }

  /** Кто зовёт и кого — по ключу из ссылки. Мёртвая ссылка — 404 одним текстом, без подробностей. */
  @Get('invites/:token')
  async inviteByToken(@Param('token') token: string): Promise<InvitePreviewJson> {
    const preview = await this.accounts.inviteByToken(token);
    if (!preview) throw new NotFoundException(INVITE_INVALID_MESSAGE);
    return previewJson(preview);
  }

  /** Принять: членство заведено, код для входа выслан. Повтор по той же ссылке — 404. */
  @Post('invites/:token/accept')
  @HttpCode(200)
  async acceptInvite(
    @Param('token') token: string,
    @Headers('cf-connecting-ip') cfIp?: string,
  ): Promise<InvitePreviewJson> {
    const preview = await this.accounts.acceptInvite(token, clientIp(cfIp));
    if (!preview) throw new NotFoundException(INVITE_INVALID_MESSAGE);
    return previewJson(preview);
  }
}

interface SessionJson {
  id: string;
  issuedAt: string;
  expiresAt: string;
  device: string;
  current: boolean;
}

function sessionJson(s: SessionRow): SessionJson {
  return {
    id: s.id,
    issuedAt: s.issuedAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    device: s.device,
    current: s.current,
  };
}

interface InviteJson {
  id: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

interface InvitePreviewJson {
  organizationName: string;
  email: string;
  expiresAt: string;
}

function inviteJson(i: InviteView): InviteJson {
  return {
    id: i.id,
    email: i.email,
    expiresAt: i.expiresAt.toISOString(),
    acceptedAt: i.acceptedAt ? i.acceptedAt.toISOString() : null,
    createdAt: i.createdAt.toISOString(),
  };
}

function previewJson(p: InvitePreview): InvitePreviewJson {
  return {
    organizationName: p.organizationName,
    email: p.email,
    expiresAt: p.expiresAt.toISOString(),
  };
}
