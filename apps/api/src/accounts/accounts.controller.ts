import 'reflect-metadata';
import {
  BadRequestException,
  ForbiddenException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  INVITE_ALREADY_MEMBER_MESSAGE,
  INVITE_EMAIL_MESSAGE,
  INVITE_INVALID_MESSAGE,
  INVITE_LIMIT_MESSAGE,
  INVITE_MANAGER_OWNER_ONLY_MESSAGE,
  INVITE_ROLE_MESSAGE,
  INVITE_STAFF_ONLY_MESSAGE,
  MEMBER_DETAILS_FORBIDDEN_MESSAGE,
  MEMBER_MANAGER_REMOVES_STAFF_MESSAGE,
  MEMBER_NOT_FOUND_MESSAGE,
  MEMBER_OWNER_MESSAGE,
  MEMBER_ROLE_MESSAGE,
  MEMBER_ROLE_OWNER_ONLY_MESSAGE,
  MEMBER_SELF_MESSAGE,
  SESSION_ENDED_MESSAGE,
  type MembershipRole,
} from '@pms/domain';
import {
  AccountsService,
  type InvitePreview,
  type InviteView,
  type MemberRefusal,
  type MemberView,
  type SessionRow,
} from './accounts.service';
import { SESSION_COOKIE, cookieOptions, sessionFromCookieHeader } from './cookie';
import { Public } from '../auth/public.decorator';
import { Access } from '../auth/access.decorator';

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
  @Access('self')
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
  @Access('self')
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
  @Access('staff')
  @Post('invites')
  @HttpCode(201)
  async createInvite(
    @Body() body: { email?: unknown; role?: unknown },
    @Headers('cookie') cookie?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<InviteJson> {
    const outcome = await this.accounts.createInvite(
      tokenFrom(cookie, authorization),
      body?.email,
      body?.role,
    );
    if (!outcome) throw new UnauthorizedException(SESSION_ENDED_MESSAGE);
    // приглашают владелец и управляющий; управляющих — только владелец (DATA_MODEL §16.5, ADR-107)
    if (!outcome.ok && outcome.reason === 'owner') throw new ForbiddenException(INVITE_STAFF_ONLY_MESSAGE);
    if (!outcome.ok && outcome.reason === 'manager-role')
      throw new ForbiddenException(INVITE_MANAGER_OWNER_ONLY_MESSAGE);
    if (!outcome.ok && outcome.reason === 'role') throw new BadRequestException(INVITE_ROLE_MESSAGE);
    if (!outcome.ok && outcome.reason === 'limit')
      throw new HttpException(INVITE_LIMIT_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    if (!outcome.ok) {
      throw new BadRequestException(
        outcome.reason === 'member' ? INVITE_ALREADY_MEMBER_MESSAGE : INVITE_EMAIL_MESSAGE,
      );
    }
    return inviteJson(outcome.invite);
  }

  /** Ожидающие приглашения своей организации. Ключей в ответе нет — только кого и до когда. */
  @Access('staff')
  @Get('invites')
  async invites(
    @Headers('cookie') cookie?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<InviteJson[]> {
    const list = await this.accounts.pendingInvites(tokenFrom(cookie, authorization));
    if (!list) throw new UnauthorizedException(SESSION_ENDED_MESSAGE);
    if (list === 'owner') throw new ForbiddenException(INVITE_STAFF_ONLY_MESSAGE);
    return list.map(inviteJson);
  }

  /**
   * Отозвать приглашение своей организации (аудит 26.09, С-10). Отзывает тот, кто вправе позвать с этой ролью (ADR-107);
   * чужое, мёртвое и не по роли — 404.
   */
  @Access('staff')
  @Delete('invites/:id')
  @HttpCode(200)
  async revokeInvite(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<{ ok: true }> {
    const outcome = await this.accounts.revokeInvite(tokenFrom(cookie, authorization), id);
    if (!outcome) throw new UnauthorizedException(SESSION_ENDED_MESSAGE);
    if (outcome === 'owner') throw new ForbiddenException(INVITE_STAFF_ONLY_MESSAGE);
    if (outcome === 'missing') throw new NotFoundException(INVITE_INVALID_MESSAGE);
    return { ok: true };
  }

  // ── Сотрудники (ADR-107, DATA_MODEL §16.1 v1.14) ────────────────────────────────────────────

  /** Люди своей организации с ролями — владельцу и управляющему; что каждый из них может с человеком — в строке */
  @Access('staff')
  @Get('members')
  async members(
    @Headers('cookie') cookie?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<MemberJson[]> {
    const list = await this.accounts.members(tokenFrom(cookie, authorization));
    if (!list) throw new UnauthorizedException(SESSION_ENDED_MESSAGE);
    if (list === 'staff') throw new ForbiddenException(INVITE_STAFF_ONLY_MESSAGE);
    return list.map(memberJson);
  }

  /** Отключить сотрудника: членство удаляется, его сессии этой организации гаснут на следующем запросе */
  @Access('staff')
  @Delete('members/:userId')
  @HttpCode(200)
  async removeMember(
    @Param('userId') userId: string,
    @Headers('cookie') cookie?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<{ ok: true }> {
    const outcome = await this.accounts.removeMember(tokenFrom(cookie, authorization), userId);
    if (!outcome) throw new UnauthorizedException(SESSION_ENDED_MESSAGE);
    if (outcome !== 'ok') throw memberRefusal(outcome);
    return { ok: true };
  }

  /** Роль между управляющим и администратором — только владелец; владельца назначает команда на сервере */
  @Access('owner')
  @Patch('members/:userId')
  async setMemberRole(
    @Param('userId') userId: string,
    @Body() body: { role?: unknown },
    @Headers('cookie') cookie?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<{ userId: string; role: MembershipRole }> {
    const outcome = await this.accounts.setMemberRole(tokenFrom(cookie, authorization), userId, body?.role);
    if (!outcome) throw new UnauthorizedException(SESSION_ENDED_MESSAGE);
    if (!outcome.ok) throw memberRefusal(outcome.reason);
    return outcome.member;
  }

  /** Телефон и должность (TEAM2, Q-244): свои: каждому с правом `staff`, чужие: тому, кто вправе отключить */
  @Access('staff')
  @Patch('members/:userId/details')
  async setMemberDetails(
    @Param('userId') userId: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<{ userId: string; phone: string | null; position: string | null }> {
    const outcome = await this.accounts.setMemberDetails(tokenFrom(cookie, authorization), userId, body);
    if (!outcome) throw new UnauthorizedException(SESSION_ENDED_MESSAGE);
    if (!outcome.ok)
      throw 'message' in outcome
        ? new BadRequestException(outcome.message)
        : memberRefusal(outcome.reason);
    return outcome.member;
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
  role: MembershipRole;
  revocable: boolean;
}

interface MemberJson {
  userId: string;
  email: string;
  name: string | null;
  role: MembershipRole;
  joinedAt: string;
  lastLoginAt: string | null;
  you: boolean;
  removable: boolean;
  roleEditable: boolean;
  phone: string | null;
  position: string | null;
  detailsEditable: boolean;
}

function memberJson(m: MemberView): MemberJson {
  return {
    userId: m.userId,
    email: m.email,
    name: m.name,
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
    lastLoginAt: m.lastLoginAt ? m.lastLoginAt.toISOString() : null,
    you: m.you,
    removable: m.removable,
    roleEditable: m.roleEditable,
    phone: m.phone,
    position: m.position,
    detailsEditable: m.detailsEditable,
  };
}

/** Отказ в действии над сотрудником — словами из домена */
function memberRefusal(reason: MemberRefusal): HttpException {
  switch (reason) {
    case 'staff':
      return new ForbiddenException(INVITE_STAFF_ONLY_MESSAGE);
    case 'missing':
      return new NotFoundException(MEMBER_NOT_FOUND_MESSAGE);
    case 'self':
      return new ForbiddenException(MEMBER_SELF_MESSAGE);
    case 'owner-target':
      return new ForbiddenException(MEMBER_OWNER_MESSAGE);
    case 'manager-target':
      return new ForbiddenException(MEMBER_MANAGER_REMOVES_STAFF_MESSAGE);
    case 'role':
      return new BadRequestException(MEMBER_ROLE_MESSAGE);
    case 'owner-only':
      return new ForbiddenException(MEMBER_ROLE_OWNER_ONLY_MESSAGE);
    case 'details-target':
      return new ForbiddenException(MEMBER_DETAILS_FORBIDDEN_MESSAGE);
  }
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
    role: i.role,
    revocable: i.revocable,
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
