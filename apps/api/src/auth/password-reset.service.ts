import 'reflect-metadata';
import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  checkPassword,
  hashPassword,
  hashSessionToken,
  invitationLetter,
  newSessionToken,
  normalizeEmail,
  passwordResetLetter,
  resetExpiry,
  resetLink,
  resetState,
} from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';

/** Кому отдаём письмо. Настоящий отправитель — `@pms/integrations` mail (ADR-004), в тестах подставной. */
export interface Mailer {
  send(letter: { to: string; subject: string; text: string }): Promise<{ id: string }>;
}
export const MAILER = Symbol('MAILER');
export const APP_URL = Symbol('APP_URL');

/** Не чаще одного письма на почту в пять минут: иначе ящик можно завалить чужими запросами. */
const REPEAT_MINUTES = 5;

/**
 * Приглашение сотрудника и сброс пароля по одноразовой ссылке (DATA_MODEL §13.8–13.9, ADR-047,
 * решение владельца 15.09.2026 — письма через сервис отправки, `docs/mail/README.md`).
 *
 * Пароль человек задаёт себе сам; в письме и в базе его нет — только хеш токена ссылки и хеш пароля.
 * Запрос сброса наружу всегда выглядит одинаково: по ответу нельзя узнать, есть ли такая почта в системе.
 */
@Injectable()
export class PasswordResetService {
  private readonly lastSent = new Map<string, number>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer | null,
    @Inject(APP_URL) private readonly appUrl: string,
  ) {}

  /** «Забыли пароль». Наружу — всегда тишина: ни «нет такой почты», ни «заблокирован». */
  async request(email: string, now = new Date()): Promise<void> {
    if (!this.mailer)
      throw new ServiceUnavailableException('Отправка писем не настроена: обратитесь к владельцу');

    const normalized = normalizeEmail(email);
    if (!normalized) return;
    const user = await this.prisma.db.user.findUnique({ where: { email: normalized } });
    if (!user || user.status === 'BLOCKED') return;

    const last = this.lastSent.get(normalized);
    if (last !== undefined && now.getTime() - last < REPEAT_MINUTES * 60_000) return;

    const link = await this.issue(user.id, now);
    const letter = passwordResetLetter({ link });
    await this.mailer.send({ to: normalized, subject: letter.subject, text: letter.text });
    this.lastSent.set(normalized, now.getTime());
  }

  /** Пароль по ссылке из письма. Ссылка одноразовая: после успеха она больше не работает. */
  async confirm(input: { token: string; password: string }, now = new Date()): Promise<void> {
    const row = input.token
      ? await this.prisma.db.passwordReset.findUnique({
          where: { tokenHash: hashSessionToken(input.token) },
          include: { user: true },
        })
      : null;
    if (!row || !row.user) throw new UnauthorizedException('Ссылка не годится: запросите новую');

    const state = resetState(row, now);
    if (state === 'used') throw new UnauthorizedException('Ссылка уже использована: запросите новую');
    if (state === 'expired') throw new UnauthorizedException('Срок ссылки истёк: запросите новую');
    if (row.user.status === 'BLOCKED')
      throw new UnauthorizedException('Ссылка не годится: запросите новую');

    const policy = checkPassword(input.password);
    if (!policy.ok) throw new BadRequestException(`Пароль не годится: ${policy.reason}`);

    await this.prisma.db.user.update({
      where: { id: row.user.id },
      data: {
        passwordHash: hashPassword(input.password),
        status: 'ACTIVE',
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.prisma.db.passwordReset.update({ where: { id: row.id }, data: { usedAt: now } });
    const { count } = await this.prisma.db.session.updateMany({
      where: { userId: row.user.id, revokedAt: null },
      data: { revokedAt: now },
    });
    await this.record(row.user.id, 'user.password.changed', { by: 'link', sessionsRevoked: count });
  }

  /**
   * Пригласить сотрудника: учётная запись без пароля, письмо со ссылкой. Пароля не выдаём даже владельцу —
   * человек задаёт его сам. Если отправка не настроена, ссылка возвращается вызывающему (это CLI владельца).
   */
  async invite(
    input: { email: string; name: string; organizationId: string },
    now = new Date(),
  ): Promise<{ link: string; sent: boolean }> {
    const email = normalizeEmail(input.email);
    if (!email) throw new BadRequestException('email: непохоже на почту');
    const name = input.name.trim();
    if (!name) throw new BadRequestException('name: журналу нужно имя, а не только почта');
    if (!input.organizationId) throw new BadRequestException('organizationId: в какую организацию звать');

    const existing = await this.prisma.db.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException(`Сотрудник с почтой ${email} уже есть`);

    // Пароль пустой: человек задаст его сам по ссылке. Членство в организации даёт доступ (§13.3)
    const user = await this.prisma.db.user.create({
      data: { email, name, status: 'ACTIVE', passwordHash: '' },
    });
    await this.prisma.db.membership.create({
      data: { userId: user.id, organizationId: input.organizationId },
    });
    await this.record(user.id, 'user.invited', { email, organizationId: input.organizationId });

    const link = await this.issue(user.id, now);
    if (!this.mailer) return { link, sent: false };

    const letter = invitationLetter({ name, link });
    await this.mailer.send({ to: email, subject: letter.subject, text: letter.text });
    this.lastSent.set(email, now.getTime());
    return { link, sent: true };
  }

  /** Новая ссылка гасит прежние неиспользованные: одна живая ссылка на человека. */
  private async issue(userId: string, now: Date): Promise<string> {
    await this.prisma.db.passwordReset.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    });
    const token = newSessionToken();
    await this.prisma.db.passwordReset.create({
      data: { userId, tokenHash: hashSessionToken(token), expiresAt: resetExpiry(now) },
    });
    return resetLink(this.appUrl, token);
  }

  private async record(userId: string, action: string, after: Record<string, unknown>): Promise<void> {
    const json = JSON.parse(JSON.stringify(after));
    await this.prisma.db.auditLog.create({
      data: { userId, entityType: 'user', entityId: userId, action, after: json },
    });
  }
}
