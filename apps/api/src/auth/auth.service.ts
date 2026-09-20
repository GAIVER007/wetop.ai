import 'reflect-metadata';
import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  checkPassword,
  evaluateLogin,
  hashPassword,
  hashSessionToken,
  newSessionToken,
  validEmail,
  SESSION_TTL_MS,
  sessionExpiresAt,
  sessionExpiry,
  sessionState,
  shouldRenewSession,
  verifyPassword,
  type UserStatus,
} from '@pms/domain';
import { hashSecret } from '@pms/shared';
import { PrismaService } from '../database/prisma.provider';

/** Что знает о вошедшем весь остальной API. Ни хеша пароля, ни токена здесь нет. */
export interface SignedInUser {
  id: string;
  email: string;
  /** Имя в модели необязательно (§13.2) — тогда человека зовём по почте */
  name: string | null;
  /** Организация, под которой открыта сессия (§13.5). Ролей нет: ADR-023 в силе */
  organizationId: string;
}

/** Организация сессии — то, что показывает экран входа: имя, состояние и пробный период (ADR-046, §13.1). */
export interface SignedInOrganization {
  name: string;
  status: string;
  trialEndsAt: string | null;
}

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: SignedInUser;
}

/**
 * Два отпечатка одного ключа, пока Q-146 открыт: вход по паролю пишет в `sessions.token_hash` SHA-256
 * (ADR-049), вход по коду на почту — HMAC с `SESSION_SECRET` (ADR-046, `@pms/shared/auth-hash`).
 * Замок API и `/auth/me` обязаны узнавать обе, иначе вошедший по коду получал бы 401 на каждый экран.
 * Без `SESSION_SECRET` второго отпечатка нет — и сессий по коду тоже (их не из чего было выдать).
 */
export function codeSessionHash(
  token: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const secret = env.SESSION_SECRET?.trim();
  return secret ? hashSecret(token, secret) : null;
}

/** Один и тот же ответ на неверную почту и на неверный пароль: форма входа не рассказывает, кто у нас есть. */
const WRONG = 'Неверная почта или пароль';
/** Чтобы неизвестная почта отвечала не быстрее неверного пароля, проверка идёт и в пустую. */
const DECOY_HASH = hashPassword('пароля-нет-такого-пользователя');

const visible = (
  user: { id: string; email: string; name: string | null },
  organizationId: string,
): SignedInUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  organizationId,
});

/**
 * Вход в стойку по логину и паролю (DATA_MODEL §13.8, ADR-049, решение владельца 15.09.2026 по Q-139).
 *
 * Модель учётных записей пришла из ADR-046 (организации, членство, приглашения); способ входа — открытая
 * развилка Q-146: коды на почту в схеме есть, но не реализованы, пароль работает. Сессия всегда открыта под
 * организацией (§13.5): её берём из членства человека.
 *
 * Правила входа живут в домене (`@pms/domain/accounts`), здесь только база и журнал. Пароль не попадает
 * ни в журнал, ни в ответы, ни в текст ошибок; в базе лежит хеш пароля и хеш токена сессии.
 * Cloudflare Access остаётся замком на периметре — этот вход его не отменяет (ADR-045).
 */
@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async login(
    input: { email: string; password: string; userAgentFamily?: string | null },
    now = new Date(),
  ): Promise<LoginResult> {
    const email = validEmail(input.email);
    const user = email
      ? await this.prisma.db.user.findUnique({
          where: { email },
          include: { memberships: { orderBy: { createdAt: 'asc' }, take: 1 } },
        })
      : null;

    if (!user) {
      verifyPassword(input.password, DECOY_HASH);
      throw new UnauthorizedException(WRONG);
    }

    const decision = evaluateLogin({
      user: {
        status: user.status as UserStatus,
        passwordHash: user.passwordHash,
        failedAttempts: user.failedAttempts,
        lockedUntil: user.lockedUntil,
      },
      password: input.password,
      now,
    });

    if (decision.outcome === 'locked') {
      const until = decision.lockedUntil ?? now;
      throw new UnauthorizedException(
        `Вход заперт после нескольких неверных попыток. Попробуйте после ${until.toISOString()}`,
      );
    }

    if (decision.outcome !== 'ok') {
      if (decision.outcome === 'wrong') {
        await this.prisma.db.user.update({
          where: { id: user.id },
          data: { failedAttempts: decision.failedAttempts, lockedUntil: decision.lockedUntil },
        });
      }
      throw new UnauthorizedException(WRONG);
    }

    // Сессия открывается под организацией: без членства человеку нечего открывать (§13.3, §13.5)
    const organizationId = user.memberships[0]?.organizationId;
    if (!organizationId) throw new UnauthorizedException(WRONG);

    const token = newSessionToken();
    await this.prisma.db.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: now },
    });
    const expiresAt = sessionExpiry(now);
    await this.prisma.db.session.create({
      data: {
        userId: user.id,
        organizationId,
        tokenHash: hashSessionToken(token),
        userAgent: input.userAgentFamily ?? null,
        expiresAt,
      },
    });
    await this.record(user.id, 'user.login', { via: 'password' });

    return { token, expiresAt: expiresAt.toISOString(), user: visible(user, organizationId) };
  }

  /** Кто пришёл с этим токеном. Негодный токен — это `null`, а не исключение: решает вызывающий. */
  async whoami(
    token: string,
    now = new Date(),
  ): Promise<{
    user: SignedInUser;
    organization: SignedInOrganization | null;
    expiresAt: string;
  } | null> {
    const found = await this.session(token, now);
    if (!found) return null;
    // §13.5 «30 суток, продление при активности»: тем же запросом, которым отмечаем работу. Смену
    // по паролю (ADR-049) не двигаем — она кончается через 12 часов намеренно.
    const renew =
      found.login === 'code' && shouldRenewSession(found.session.expiresAt, now, SESSION_TTL_MS);
    const expiresAt = renew ? sessionExpiresAt(now) : found.session.expiresAt;
    await this.prisma.db.session.update({
      where: { id: found.session.id },
      data: { lastSeenAt: now, ...(renew ? { expiresAt } : {}) },
    });
    const org = found.session.organization;
    return {
      user: visible(found.user, found.session.organizationId),
      organization: org
        ? {
            name: org.name,
            status: org.status,
            trialEndsAt: org.trialEndsAt ? org.trialEndsAt.toISOString() : null,
          }
        : null,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /** «Выйти». Идемпотентен: неизвестный или уже отозванный токен ничего не ломает и в журнал не пишет. */
  async logout(token: string, now = new Date()): Promise<void> {
    const found = await this.findByToken(token);
    if (!found || found.row.revokedAt !== null) return;
    await this.prisma.db.session.update({ where: { id: found.row.id }, data: { revokedAt: now } });
    await this.record(found.row.userId, 'user.logout', {});
  }

  /** Смена пароля своей учётной записи: прочие сессии этого сотрудника гаснут. */
  async changePassword(
    input: { token: string; currentPassword: string; newPassword: string },
    now = new Date(),
  ): Promise<void> {
    const found = await this.session(input.token, now);
    if (!found) throw new UnauthorizedException('Войдите заново: сессия не годится');

    const full = await this.prisma.db.user.findUnique({ where: { id: found.user.id } });
    if (!full || !verifyPassword(input.currentPassword, full.passwordHash))
      throw new UnauthorizedException('Неверный текущий пароль');

    const policy = checkPassword(input.newPassword);
    if (!policy.ok) throw new BadRequestException(`Пароль не годится: ${policy.reason}`);

    await this.prisma.db.user.update({
      where: { id: full.id },
      data: { passwordHash: hashPassword(input.newPassword) },
    });
    const { count } = await this.prisma.db.session.updateMany({
      where: { userId: full.id, revokedAt: null, id: { not: found.session.id } },
      data: { revokedAt: now },
    });
    await this.record(full.id, 'user.password.changed', { sessionsRevoked: count });
  }

  /**
   * Строка сессии по ключу: сначала отпечаток пароля, потом — если задан секрет — отпечаток кода.
   * Каким отпечатком нашли, тем и живёт сессия: у входов разные сроки (12 часов и 30 суток), и
   * продлевать их по одному правилу нельзя.
   */
  private async findByToken(token: string) {
    const byHash = (tokenHash: string) =>
      this.prisma.db.session.findUnique({
        where: { tokenHash },
        include: { user: true, organization: true },
      });
    const own = await byHash(hashSessionToken(token));
    if (own) return { row: own, login: 'password' as const };
    const alt = codeSessionHash(token);
    if (!alt) return null;
    const row = await byHash(alt);
    return row ? { row, login: 'code' as const } : null;
  }

  private async session(token: string, now: Date) {
    if (!token) return null;
    const found = await this.findByToken(token);
    if (!found?.row.user) return null;
    if (sessionState(found.row, now) !== 'active') return null;
    if (found.row.user.status !== 'ACTIVE') return null;
    return { session: found.row, user: found.row.user, login: found.login };
  }

  /** Журнал: кто и что сделал. Пароли и токены здесь не появляются никогда. */
  private async record(
    userId: string,
    action: string,
    after: Record<string, unknown>,
  ): Promise<void> {
    const json = JSON.parse(JSON.stringify(after));
    await this.prisma.db.auditLog.create({
      data: { userId, entityType: 'user', entityId: userId, action, after: json },
    });
  }
}
