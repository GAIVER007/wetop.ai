import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { Inject, Injectable, Logger, Optional, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { normalizePhone } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';

/** Окно лимита: скользящие 24 часа (владелец 23.10.2026). Хэш телефона обнуляется через 7 дней */
export const PHONE_LIMIT_WINDOW_MS = 24 * 3_600_000;
export const PHONE_HASH_PURGE_MS = 7 * 24 * 3_600_000;
const PURGE_EVERY_MS = 3_600_000;

/**
 * Хэш канонического номера (E.164) с серверным секретом: утечка базы не позволяет перебором восстановить номера.
 * Нет ключа или номера: хэша нет (лимит в этом случае не работает, номер не записывается нигде).
 */
export function hashPhone(phone: unknown, key: string | undefined): string | null {
  const canonical = normalizePhone(phone);
  if (!canonical || !key) return null;
  return createHmac('sha256', key).update(canonical).digest('hex');
}

export const PHONE_LIMIT_STORE = Symbol('PHONE_LIMIT_STORE');
export const PHONE_HASH_KEY = Symbol('PHONE_HASH_KEY');

export interface PhoneLimitStore {
  /** Подтверждённые голосовые брони агента с этим хэшем после момента `since` во всех таблицах голоса */
  countConfirmedSince(agentId: string, hash: string, since: Date): Promise<number>;
  /** Обнуляет хэши старше границы; число обнулённых строк */
  clearOlderThan(cutoff: Date): Promise<number>;
}

@Injectable()
export class PrismaPhoneLimitStore implements PhoneLimitStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async countConfirmedSince(agentId: string, hash: string, since: Date): Promise<number> {
    const where = { agentId, guestPhoneHash: hash, state: 'CONFIRMED' as const, updatedAt: { gt: since } };
    const [intents, quotes] = await Promise.all([
      this.prisma.db.sellerBookingIntent.count({ where: { ...where, channel: 'voice' } }),
      this.prisma.db.voiceBookingQuote.count({ where }),
    ]);
    return intents + quotes;
  }

  async clearOlderThan(cutoff: Date): Promise<number> {
    const where = { guestPhoneHash: { not: null }, updatedAt: { lt: cutoff } };
    const [intents, quotes] = await Promise.all([
      this.prisma.db.sellerBookingIntent.updateMany({ where, data: { guestPhoneHash: null } }),
      this.prisma.db.voiceBookingQuote.updateMany({ where, data: { guestPhoneHash: null } }),
    ]);
    return intents.count + quotes.count;
  }
}

/**
 * Суточный лимит голосовых броней на один телефон, на агента (DATA_MODEL VOICE-PHONE-LIMIT-OWNER-APPROVAL-20261023).
 * Секрет `VOICE_PHONE_HASH_KEY` в `.env` API; пока его нет, лимит выключен и API пишет об этом в журнал при запуске.
 */
@Injectable()
export class VoicePhoneLimit implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VoicePhoneLimit.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(PHONE_LIMIT_STORE) private readonly store: PhoneLimitStore,
    @Optional() @Inject(PHONE_HASH_KEY) private readonly key?: string,
  ) {}

  get enabled(): boolean {
    return !!this.key;
  }

  hashOf(phone: unknown): string | null {
    return hashPhone(phone, this.key);
  }

  /** Достигнут ли лимит: подтверждённых броней этого телефона у агента за последние 24 часа уже не меньше `max` */
  async reached(agentId: string, hash: string | null, max: number, now: Date = new Date()): Promise<boolean> {
    if (!hash || !this.enabled) return false;
    return (await this.store.countConfirmedSince(agentId, hash, new Date(now.getTime() - PHONE_LIMIT_WINDOW_MS))) >= max;
  }

  purge(now: Date = new Date()): Promise<number> {
    return this.store.clearOlderThan(new Date(now.getTime() - PHONE_HASH_PURGE_MS));
  }

  onModuleInit(): void {
    if (!this.enabled && process.env.NODE_ENV !== 'test')
      this.logger.warn('VOICE_PHONE_HASH_KEY не задан: суточный лимит голосовых броней на телефон выключен');
    if (process.env.NODE_ENV === 'test' || !this.enabled) return;
    this.timer = setInterval(
      () => void this.purge().catch((e: unknown) => this.logger.warn(`Обнуление хэшей телефонов: ${(e as Error).name}`)),
      PURGE_EVERY_MS,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
