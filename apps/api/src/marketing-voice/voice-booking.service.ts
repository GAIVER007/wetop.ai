import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import {
  BookingIntentsService,
  VOICE_CHANNELS,
  type IntentBooking,
  type IntentQuote,
} from '../web-booking/booking-intents.service';
import { WebBookingService } from '../web-booking/web-booking.service';
import { VoicePhoneLimit } from './voice-phone-limit';
import { VOICE_INGEST_REPOSITORY, type AgentProfile, type VoiceIngestRepository } from './voice-ingest.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CALL_ID = /^[A-Za-z0-9._:-]{1,64}$/;
/** Котировок за звонок не больше, чем броней × 3: поиск вариантов нужен, но таблицу забивать звонком нельзя */
const QUOTES_PER_BOOKING = 3;
const PENDING_NOTE = 'Ожидает подтверждения администратора';

export const VOICE_BOOKING_STORE = Symbol('VOICE_BOOKING_STORE');

export interface VoiceIntentRow {
  agentId: string;
  conversationId: string;
  channel: string;
  state: string;
}

/** Чтение котировок голоса для лимитов и принадлежности звонку; считаем из данных, отдельного счётчика нет */
export interface VoiceBookingStore {
  countConfirmed(agentId: string, callId: string): Promise<number>;
  countCreated(agentId: string, callId: string): Promise<number>;
  intentOf(intentId: string): Promise<VoiceIntentRow | null>;
  /** Хэш телефона подтверждённой котировки для суточного лимита (миграция 153) */
  stampPhoneHash(intentId: string, hash: string): Promise<void>;
}

@Injectable()
export class PrismaVoiceBookingStore implements VoiceBookingStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  countConfirmed(agentId: string, callId: string): Promise<number> {
    return this.prisma.db.sellerBookingIntent.count({
      where: { agentId, conversationId: callId, channel: 'voice', state: 'CONFIRMED' },
    });
  }

  countCreated(agentId: string, callId: string): Promise<number> {
    return this.prisma.db.sellerBookingIntent.count({ where: { agentId, conversationId: callId, channel: 'voice' } });
  }

  async stampPhoneHash(intentId: string, hash: string): Promise<void> {
    await this.prisma.db.sellerBookingIntent.updateMany({
      where: { id: intentId, channel: 'voice', state: 'CONFIRMED', guestPhoneHash: null },
      data: { guestPhoneHash: hash },
    });
  }

  async intentOf(intentId: string): Promise<VoiceIntentRow | null> {
    return this.prisma.db.sellerBookingIntent.findUnique({
      where: { id: intentId },
      select: { agentId: true, conversationId: true, channel: true, state: true },
    });
  }
}

export interface VoiceAvailability {
  arrivalDate: string;
  departureDate: string;
  nights: number;
  adults: number;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  /** Только код, название, признак наличия и цена платформы: числа мест и тарифов агенту не нужны */
  categories: Array<{ code: string; name: string; free: 'yes' | 'no'; totalMinor: string | null }>;
}

export interface VoiceBookingResult extends IntentBooking {
  /** true: бронь ждёт подтверждения администратора, гостю так и говорят */
  pendingApproval: boolean;
}

const obj = (raw: unknown): Record<string, unknown> =>
  raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max + 1) : '');

/**
 * Бронь гостиницы по телефону (DATA_MODEL VOICE-BOOKING-OWNER-APPROVAL-20261023). Платформа считает цены и места, голос
 * только читает и подтверждает: организацию и объект даёт агент и его сайт, звонок связывает котировку с разговором,
 * выключатель и лимиты берутся из `voice_profiles`. Подтверждается только котировка этого же звонка.
 */
@Injectable()
export class VoiceBookingService {
  constructor(
    @Inject(VOICE_INGEST_REPOSITORY) private readonly repo: VoiceIngestRepository,
    @Inject(WebBookingService) private readonly web: WebBookingService,
    @Inject(BookingIntentsService) private readonly intents: BookingIntentsService,
    @Inject(VOICE_BOOKING_STORE) private readonly store: VoiceBookingStore,
    @Optional() @Inject(VoicePhoneLimit) private readonly phoneLimit?: VoicePhoneLimit,
  ) {}

  async availability(raw: unknown, now: Date = new Date()): Promise<VoiceAvailability> {
    const b = obj(raw);
    const { agent } = await this.gate(b);
    // промокод по телефону не принимается: скидку агент не обещает (план, п. 5 «Деньги считает платформа»)
    const quote = await this.web.quoteForAgent(
      agent,
      { arrival: b.arrival, departure: b.departure, adults: b.adults },
      now,
    );
    return {
      arrivalDate: quote.arrivalDate,
      departureDate: quote.departureDate,
      nights: quote.nights,
      adults: quote.adults,
      currency: quote.currency,
      checkInTime: quote.checkInTime,
      checkOutTime: quote.checkOutTime,
      categories: quote.categories.map((c) => ({
        code: c.code,
        name: c.name,
        free: c.fits && !c.closed && c.available > 0 && c.totalMinor !== null ? 'yes' : 'no',
        totalMinor: c.fits && !c.closed && c.available > 0 ? c.totalMinor : null,
      })),
    };
  }

  async quote(raw: unknown, now: Date = new Date()): Promise<IntentQuote> {
    const b = obj(raw);
    const { agent, call, profile } = await this.gate(b);
    if ((await this.store.countConfirmed(agent, call)) >= profile.booking.maxPerCall)
      throw new ConflictException('За один звонок забронировано максимум: дальше только через администратора');
    if ((await this.store.countCreated(agent, call)) >= profile.booking.maxPerCall * QUOTES_PER_BOOKING)
      throw new HttpException('Слишком много вариантов за один звонок', HttpStatus.TOO_MANY_REQUESTS);
    return this.intents.quote(
      {
        agent,
        conversation: call,
        channel: 'voice',
        category: b.category,
        arrival: b.arrival,
        departure: b.departure,
        adults: b.adults,
      },
      now,
      { channels: VOICE_CHANNELS },
    );
  }

  async confirm(raw: unknown, now: Date = new Date()): Promise<VoiceBookingResult> {
    const b = obj(raw);
    const { agent, call, profile } = await this.gate(b);
    if (b.consent !== true) throw new BadRequestException('consent: нужно явное согласие звонящего');
    const intentId = str(b.intent, 36).toLowerCase();
    if (!UUID.test(intentId)) throw new BadRequestException('intent: ожидался UUID');
    const row = await this.store.intentOf(intentId);
    if (!row || row.agentId !== agent || row.conversationId !== call || row.channel !== 'voice')
      throw new NotFoundException('Предложение не найдено');
    if (row.state !== 'CONFIRMED' && (await this.store.countConfirmed(agent, call)) >= profile.booking.maxPerCall)
      throw new ConflictException('За один звонок забронировано максимум: дальше только через администратора');
    const phone = obj(b.guest).phone;
    const phoneHash = this.phoneLimit?.hashOf(phone) ?? null;
    if (row.state !== 'CONFIRMED' && (await this.phoneLimit?.reached(agent, phoneHash, profile.booking.maxPerPhoneDay, now)))
      throw new ConflictException('За сутки с этого телефона забронировано максимум: дальше только через администратора');
    const pendingApproval = profile.booking.needsApproval;
    const booking = await this.intents.confirm(
      {
        agent,
        intent: intentId,
        message: `voice:${call}:${intentId}`,
        guest: b.guest,
      },
      now,
      { channels: VOICE_CHANNELS, ...(pendingApproval ? { notes: PENDING_NOTE } : {}) },
    );
    if (phoneHash && row.state !== 'CONFIRMED') await this.store.stampPhoneHash(intentId, phoneHash);
    return { ...booking, pendingApproval };
  }

  private async gate(b: Record<string, unknown>): Promise<{ agent: string; call: string; profile: AgentProfile }> {
    const agent = str(b.agent, 36).toLowerCase();
    if (!UUID.test(agent)) throw new BadRequestException('agent: ожидался UUID');
    const call = str(b.call, 64);
    if (!CALL_ID.test(call)) throw new BadRequestException('call: идентификатор звонка, 1-64 знака');
    const profile = await this.repo.profile(agent);
    if (profile === null) throw new NotFoundException('Агент не найден');
    if (profile === 'NO_LOCATION') throw new UnprocessableEntityException('У агента не выбран филиал');
    if (profile.vertical !== 'HOSPITALITY')
      throw new ConflictException('Бронь по телефону для этого направления пока не подключена');
    if (!profile.booking.enabled) throw new ConflictException('Бронирование по телефону на объекте выключено');
    return { agent, call, profile };
  }
}
