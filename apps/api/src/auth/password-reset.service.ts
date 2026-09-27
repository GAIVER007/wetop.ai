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
  hashSessionToken,
  newSessionToken,
  validEmail,
  passwordResetLetter,
  resetExpiry,
  resetLink,
  resetState,
} from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { hashPasswordQueued } from './attempt-limits';

/**
 * Кому отдаём письмо. Порт — общий с входом по коду (`@pms/integrations` mail, ADR-004): один
 * отправитель на систему, в тестах подставной. 16.09.2026 две сессии написали по клиенту Resend;
 * оставлен проверенный живым письмом (`docs/mail/resend-api.md`), мой удалён.
 */
export interface Mailer {
  send(letter: { to: string; subject: string; text: string }): Promise<void>;
}
export const MAILER = Symbol('MAILER');
export const APP_URL = Symbol('APP_URL');

/** Не чаще одного письма на почту в пять минут: иначе ящик можно завалить чужими запросами. */
const REPEAT_MINUTES = 5;

/**
 * Приглашение сотрудника и сброс пароля по одноразовой ссылке (DATA_MODEL §13.8–13.9, ADR-049,
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

    const normalized = validEmail(email);
    if (!normalized) return;
    const user = await this.prisma.db.user.findUnique({ where: { email: normalized } });
    if (!user || user.status === 'BLOCKED') return;

    const last = this.lastSent.get(normalized);
    if (last !== undefined && now.getTime() - last < REPEAT_MINUTES * 60_000) return;

    const link = await this.issue(user.id, now);
    const letter = passwordResetLetter({ link });
    try {
      await this.mailer.send({ to: normalized, subject: letter.subject, text: letter.text });
    } catch {
      // Почтовая служба отказала. Ссылка уже выдана и погасила прежнюю — значит, человек остался
      // без обеих. Гасим свежую сразу и не запоминаем отправку: следующая попытка выдаст новую,
      // а не упрётся в «не чаще одного письма в пять минут» (сверка 20.09.2026).
      await this.prisma.db.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });
      return;
    }
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
        passwordHash: await hashPasswordQueued(input.password),
        status: 'ACTIVE',
        failedAttempts: 0,
        lockedUntil: null,
        // Ссылка пришла на эту почту — значит, почта его. Приглашённый задаёт пароль этой же дорогой и без отметки
        // упирался в «Почта не подтверждена» навсегда, вопреки ADR-060 (аудит 26.09, С-9)
        emailVerifiedAt: row.user.emailVerifiedAt ?? now,
      },
    });
    await this.prisma.db.passwordReset.update({ where: { id: row.id }, data: { usedAt: now } });
    const { count } = await this.prisma.db.session.updateMany({
      where: { userId: row.user.id, revokedAt: null },
      data: { revokedAt: now },
    });
    await this.record(row.user.id, 'user.password.changed', { by: 'link', sessionsRevoked: count });
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
