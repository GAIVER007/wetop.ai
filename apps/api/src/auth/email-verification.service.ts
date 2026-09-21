import 'reflect-metadata';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  VERIFY_BAD_LINK_MESSAGE,
  VERIFY_EXPIRED_MESSAGE,
  emailVerificationLetter,
  hashSessionToken,
  newSessionToken,
  validEmail,
  verifyExpiry,
  verifyLink,
  verifyState,
} from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { APP_URL, MAILER, type Mailer } from './password-reset.service';

/** Не чаще одного письма на человека в минуту: кнопка «выслать заново» не должна заваливать ящик. */
const REPEAT_SECONDS = 60;

/**
 * Подтверждение почты при самостоятельной регистрации (решение владельца 20.09.2026).
 *
 * Отправитель писем — тот же порт, что у сброса пароля (ADR-004): один отправитель на систему,
 * в тестах подставной. Если отправка не настроена, регистрация не падает: учётная запись заводится,
 * но письма нет — `sendFor` возвращает `false`, и стойка говорит про владельца, а не про «проверьте ящик».
 */
@Injectable()
export class EmailVerificationService {
  private readonly lastSent = new Map<string, number>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer | null,
    @Inject(APP_URL) private readonly appUrl: string,
  ) {}

  /**
   * Выдать ссылку и отправить письмо. Отказ почтовой службы не роняет вызывающего: учётная запись
   * уже заведена, и терять её из-за чужого сбоя нельзя — человек нажмёт «выслать заново».
   */
  async sendFor(
    input: { userId: string; email: string; name: string | null },
    now = new Date(),
  ): Promise<boolean> {
    if (!this.mailer) return false;

    const last = this.lastSent.get(input.email);
    if (last !== undefined && now.getTime() - last < REPEAT_SECONDS * 1_000) return true;

    const link = await this.issue(input.userId, now);
    const letter = emailVerificationLetter({ name: input.name, link });
    try {
      await this.mailer.send({ to: input.email, subject: letter.subject, text: letter.text });
    } catch {
      // Причину не показываем наружу: в тексте почтовой службы бывают внутренние идентификаторы.
      return false;
    }
    this.lastSent.set(input.email, now.getTime());
    return true;
  }

  /**
   * «Выслать письмо заново». Наружу — всегда тишина про то, есть ли такая почта и подтверждена ли
   * она: иначе форма превращается в проверку чужих адресов.
   */
  async resend(email: string, now = new Date()): Promise<void> {
    const normalized = validEmail(email);
    if (!normalized) return;
    const user = await this.prisma.db.user.findUnique({ where: { email: normalized } });
    if (!user || user.status === 'BLOCKED' || user.emailVerifiedAt !== null) return;
    await this.sendFor({ userId: user.id, email: normalized, name: user.name }, now);
  }

  /**
   * Подтверждение по ссылке. Отдаёт, кого впускать — сессию открывает вызывающий (`AuthService`).
   * Ссылка одноразовая: после успеха она больше не работает.
   */
  async confirm(
    token: string,
    now = new Date(),
  ): Promise<{ userId: string; organizationId: string }> {
    const row = token
      ? await this.prisma.db.emailVerification.findUnique({
          where: { tokenHash: hashSessionToken(token) },
          include: {
            user: { include: { memberships: { orderBy: { createdAt: 'asc' }, take: 1 } } },
          },
        })
      : null;
    if (!row || !row.user) throw new UnauthorizedException(VERIFY_BAD_LINK_MESSAGE);

    const state = verifyState(row, now);
    // Уже подтверждённая почта + использованная ссылка — это повторный переход по той же ссылке
    // (письмо открыли дважды, почтовый клиент сходил по ссылке сам). Это не ошибка человека.
    if (state === 'used' && row.user.emailVerifiedAt !== null) {
      const organizationId = row.user.memberships[0]?.organizationId;
      if (!organizationId) throw new UnauthorizedException(VERIFY_BAD_LINK_MESSAGE);
      return { userId: row.user.id, organizationId };
    }
    if (state === 'used') throw new UnauthorizedException(VERIFY_BAD_LINK_MESSAGE);
    if (state === 'expired') throw new UnauthorizedException(VERIFY_EXPIRED_MESSAGE);
    if (row.user.status === 'BLOCKED') throw new UnauthorizedException(VERIFY_BAD_LINK_MESSAGE);

    const organizationId = row.user.memberships[0]?.organizationId;
    if (!organizationId) throw new NotFoundException(VERIFY_BAD_LINK_MESSAGE);

    await this.prisma.db.user.update({
      where: { id: row.user.id },
      data: { emailVerifiedAt: now },
    });
    await this.prisma.db.emailVerification.update({ where: { id: row.id }, data: { usedAt: now } });
    await this.prisma.db.auditLog.create({
      data: {
        userId: row.user.id,
        entityType: 'user',
        entityId: row.user.id,
        action: 'user.email.verified',
        after: { email: row.user.email },
      },
    });

    return { userId: row.user.id, organizationId };
  }

  /** Новая ссылка гасит прежние неиспользованные: одна живая ссылка на человека. */
  private async issue(userId: string, now: Date): Promise<string> {
    await this.prisma.db.emailVerification.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    });
    const token = newSessionToken();
    await this.prisma.db.emailVerification.create({
      data: { userId, tokenHash: hashSessionToken(token), expiresAt: verifyExpiry(now) },
    });
    return verifyLink(this.appUrl, token);
  }
}

/** Пустая почта в запросе — это ошибка формы, а не тишина. */
export function requireEmail(email: unknown): string {
  if (typeof email !== 'string' || email.trim() === '') {
    throw new BadRequestException('email: укажите почту');
  }
  return email;
}
