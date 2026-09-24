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
  INVITE_ALREADY_MEMBER_MESSAGE,
  INVITE_EMAIL_MESSAGE,
  INVITE_INVALID_MESSAGE,
  SESSION_ENDED_MESSAGE,
} from '@pms/domain';
import {
  AccountsService,
  type InvitePreview,
  type InviteView,
  type SessionRow,
} from './accounts.service';
import { SESSION_COOKIE, cookieOptions, sessionFromCookieHeader } from './cookie';
import { Public } from '../auth/public.decorator';

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

@Controller('auth')
export class AccountsController {
  constructor(@Inject(AccountsService) private readonly accounts: AccountsService) {}

  // Вход по коду на почту снят 20.09.2026 (ADR-053): маршруты POST /auth/code и POST /auth/verify
  // убраны вместе с ним. Здесь же висели GET /auth/me и POST /auth/logout — они не отвечали никому:
  // AuthModule подключён раньше AccountsModule, и те же пути перехватывал AuthController, который
  // понимает отпечаток сессии по паролю. Сняты как мёртвые, чтобы двух хозяев у одного пути не было.

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
  @Public()
  async inviteByToken(@Param('token') token: string): Promise<InvitePreviewJson> {
    const preview = await this.accounts.inviteByToken(token);
    if (!preview) throw new NotFoundException(INVITE_INVALID_MESSAGE);
    return previewJson(preview);
  }

  /**
   * Принять: членство заведено, в ответ — ключ «задайте пароль» (ADR-053; раньше уходил код на почту).
   * Повтор по той же ссылке — 404: ключ выдаётся один раз, вместе с вступлением.
   */
  @Post('invites/:token/accept')
  @Public()
  @HttpCode(200)
  async acceptInvite(@Param('token') token: string): Promise<InvitePreviewJson> {
    const preview = await this.accounts.acceptInvite(token);
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
  /** Только у принятия: ключ, по которому человек задаёт себе пароль. null — пароль у него уже есть. */
  setPasswordToken?: string | null;
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
    ...(p.setPasswordToken === undefined ? {} : { setPasswordToken: p.setPasswordToken }),
  };
}
