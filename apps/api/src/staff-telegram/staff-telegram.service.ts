import 'reflect-metadata';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import {
  newStaffLinkCode,
  parseStaffBotUpdate,
  STAFF_LINK_CODE_TTL_MS,
  staffLinkCodeHash,
} from '@pms/domain';
import { telegram } from '@pms/integrations';
import { AttemptWindows } from '../auth/attempt-limits';
import { currentUserId, withServiceDatabase } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';

export const STAFF_BOT = Symbol('STAFF_BOT');
/** Бот уведомлений сотрудникам: клиент и секрет вебхука; null, пока администратор платформы не вписал токен */
export interface StaffBot {
  client: Pick<telegram.StaffBotClient, 'sendMessage' | 'username'>;
  webhookSecret: string | null;
}

export function staffBotFromEnv(env: Record<string, string | undefined> = process.env): StaffBot | null {
  const config = telegram.staffBotConfigFromEnv(env);
  return config ? { client: new telegram.StaffBotClient({ token: config.token }), webhookSecret: config.webhookSecret } : null;
}

export const BOT_NOT_CONFIGURED = 'Бот WETOP подключается администратором платформы';
const CODES_PER_WINDOW = 5;
const CODES_WINDOW_MS = 15 * 60_000;

export interface StaffTelegramStatus {
  /** Токен бота задан на сервере */
  botConfigured: boolean;
  /** Имя бота (getMe); null, если бот не настроен или Telegram не ответил */
  botUsername: string | null;
  link: { username: string | null; linkedAt: string; siteBookings: boolean } | null;
}

const sameSecret = (presented: string, expected: string) => {
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Подключение сотрудника к боту WETOP (STAFF-TG-20261020, план plans/staff-telegram-notifications-2026-10-20.md).
 * Экран «Уведомления» работает от имени вошедшего (роль базы `wetop_app`, RLS по членству); вебхук бота работает
 * служебной ролью: Telegram организации не знает, сотрудника находит хэш одноразового кода.
 */
@Injectable()
export class StaffTelegramService {
  private codes = new AttemptWindows(CODES_PER_WINDOW, CODES_WINDOW_MS);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(STAFF_BOT) private readonly bot: StaffBot | null = null,
  ) {}

  /** Часы: подменяются в тестах */
  now: () => Date = () => new Date();

  private me(): string {
    const userId = currentUserId();
    if (!userId) throw new UnauthorizedException('Войдите в систему');
    return userId;
  }

  async status(): Promise<StaffTelegramStatus> {
    const userId = this.me();
    const row = await this.prisma.db.staffTelegramLink.findUnique({ where: { userId } });
    return {
      botConfigured: this.bot !== null,
      botUsername: this.bot ? await this.bot.client.username().catch(() => null) : null,
      link:
        row && !row.disabledAt
          ? { username: row.username, linkedAt: row.linkedAt.toISOString(), siteBookings: row.siteBookings }
          : null,
    };
  }

  /** Одноразовый код и ссылка t.me: 8 знаков, 15 минут, в базе хэш; новый код гасит прежние */
  async issueCode(): Promise<{ code: string; link: string; expiresAt: string }> {
    const userId = this.me();
    if (!this.bot) throw new ServiceUnavailableException(BOT_NOT_CONFIGURED);
    const username = await this.bot.client.username().catch(() => null);
    if (!username) throw new ServiceUnavailableException('Telegram сейчас не отвечает, попробуйте через минуту');
    const now = this.now();
    if (!this.codes.allow(userId, now.getTime()))
      throw new HttpException('Слишком много кодов подряд, подождите 15 минут', HttpStatus.TOO_MANY_REQUESTS);
    const code = newStaffLinkCode((n) => randomBytes(n));
    const expiresAt = new Date(now.getTime() + STAFF_LINK_CODE_TTL_MS);
    await this.prisma.db.$transaction(async (tx) => {
      await tx.staffTelegramLinkCode.updateMany({
        where: { userId, usedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });
      await tx.staffTelegramLinkCode.create({ data: { codeHash: staffLinkCodeHash(code), userId, expiresAt } });
    });
    return { code, link: `https://t.me/${username}?start=${code}`, expiresAt: expiresAt.toISOString() };
  }

  /** Переключатель «Брони с сайта» */
  async setPreferences(raw: unknown): Promise<StaffTelegramStatus> {
    const userId = this.me();
    const siteBookings = (raw as { siteBookings?: unknown } | null)?.siteBookings;
    if (typeof siteBookings !== 'boolean') throw new BadRequestException('siteBookings: true или false');
    const done = await this.prisma.db.staffTelegramLink.updateMany({
      where: { userId, disabledAt: null },
      data: { siteBookings },
    });
    if (done.count === 0) throw new NotFoundException('Telegram не подключён');
    return this.status();
  }

  /** «Отключить»: строка остаётся с отметкой времени, сообщения больше не идут */
  async disconnect(): Promise<StaffTelegramStatus> {
    const userId = this.me();
    await this.prisma.db.staffTelegramLink.updateMany({
      where: { userId, disabledAt: null },
      data: { disabledAt: this.now() },
    });
    return this.status();
  }

  /** «Проверить»: пробное сообщение в подключённый чат; 403 отключает привязку */
  async test(): Promise<{ delivered: true }> {
    const userId = this.me();
    if (!this.bot) throw new ServiceUnavailableException(BOT_NOT_CONFIGURED);
    const link = await this.prisma.db.staffTelegramLink.findUnique({ where: { userId } });
    if (!link || link.disabledAt) throw new NotFoundException('Telegram не подключён');
    const result = await this.bot.client.sendMessage(
      link.chatId.toString(),
      'Проверка связи WETOP: сюда будут приходить новые брони и записи с сайта.',
    );
    if (result.ok) return { delivered: true };
    if (result.blocked) {
      await this.prisma.db.staffTelegramLink.updateMany({ where: { userId, disabledAt: null }, data: { disabledAt: this.now() } });
      throw new ConflictException('Бот заблокирован в Telegram. Подключите Telegram заново.');
    }
    throw new ServiceUnavailableException('Telegram не принял сообщение, попробуйте позже');
  }

  /**
   * Вебхук бота: секрет из заголовка `X-Telegram-Bot-Api-Secret-Token` (setWebhook secret_token). Без секрета на
   * сервере вебхук закрыт (404). Ответ 200 несёт `sendMessage` прямо в теле: Telegram выполнит его сам (Bot API,
   * «Making requests when getting updates»); любой разобранный апдейт получает 200, иначе Telegram повторяет его.
   */
  async webhook(secretHeader: string | undefined, update: unknown): Promise<Record<string, unknown>> {
    const secret = this.bot?.webhookSecret;
    if (!this.bot || !secret) throw new NotFoundException();
    if (typeof secretHeader !== 'string' || !sameSecret(secretHeader, secret)) throw new UnauthorizedException();
    const command = parseStaffBotUpdate(update);
    if (command.kind === 'ignore') return {};
    const reply = (text: string) => ({ method: 'sendMessage', chat_id: command.chatId, text });
    return withServiceDatabase(async () => {
      if (command.kind === 'stop') {
        await this.prisma.db.staffTelegramLink.updateMany({
          where: { chatId: BigInt(command.chatId), disabledAt: null },
          data: { disabledAt: this.now() },
        });
        return reply('Уведомления WETOP отключены. Подключить снова: Профиль → Уведомления.');
      }
      if (command.kind === 'other' || !command.code)
        return reply('Это бот уведомлений WETOP. Подключение: Профиль → Уведомления → «Подключить Telegram».');
      const linked = await this.link(command.code, command.chatId, command.username);
      return reply(
        linked
          ? 'Готово, сюда будут приходить брони с сайта.'
          : 'Код не подошёл или устарел. Получите новый: Профиль → Уведомления → «Подключить Telegram».',
      );
    });
  }

  /** Код гасится и чат привязывается одной транзакцией; повтор того же кода не проходит */
  private async link(code: string, chatId: string, username: string | null): Promise<boolean> {
    const now = this.now();
    return this.prisma.db.$transaction(async (tx) => {
      const used = await tx.staffTelegramLinkCode.updateMany({
        where: { codeHash: staffLinkCodeHash(code), usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (used.count !== 1) return false;
      const row = await tx.staffTelegramLinkCode.findUniqueOrThrow({
        where: { codeHash: staffLinkCodeHash(code) },
        select: { userId: true },
      });
      await tx.staffTelegramLink.upsert({
        where: { userId: row.userId },
        create: { userId: row.userId, chatId: BigInt(chatId), username, linkedAt: now },
        update: { chatId: BigInt(chatId), username, linkedAt: now, disabledAt: null },
      });
      return true;
    });
  }
}
