import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, HttpException, HttpStatus, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { normalizePhone } from '@pms/domain';
import { SiteFormsService } from '../site-forms/site-forms.service';
import { VOICE_QUOTE_STORE, VOICE_QUOTE_TTL_MS, type VoiceQuoteStore } from './voice-beauty.service';
import { obj, str, voiceGate } from './voice-gate';
import { VoicePhoneLimit } from './voice-phone-limit';
import { VOICE_INGEST_REPOSITORY, type VoiceIngestRepository } from './voice-ingest.repository';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const QUOTES_PER_BOOKING = 3;
const NAME_MAX = 100;
const COMMENT_MAX = 1000;
const MAX_PARTY = 50;
const STALE = 'Предложение устарело: нужна новая проверка свободного и новое согласие';
const PHONE_REACHED = 'За сутки с этого телефона забронировано максимум: дальше только через администратора';
const MAX_REACHED = 'За один звонок забронировано максимум: дальше только через администратора';

export interface VoiceFoodAvailability {
  ok: boolean;
  /** Причина отказа словами платформы (правила брони, нет периода обслуживания, нет свободного стола) */
  reason?: string;
  date: string;
  time: string;
  partySize: number;
  period?: string;
}

export interface VoiceTableQuote {
  quote: string;
  expiresAt: string;
  date: string;
  time: string;
  partySize: number;
  period: string;
}

export interface VoiceTableBooked {
  status: string;
  date: string;
  time: string;
  partySize: number;
  /** Бронь ждёт подтверждения администратора (статус BOOKED), стол назначит администратор */
  pendingApproval: boolean;
}

/**
 * Бронь стола в ресторане по телефону (DATA_MODEL VOICE-BOOKING-OWNER-APPROVAL-20261023). Период обслуживания, правила брони и
 * свободный стол считает тот же расчёт, что у формы сайта; голос добавляет выключатель, привязку к звонку, котировку на 30 минут,
 * лимиты и явное согласие. Стол гостю не называется и не назначается: его назначает администратор.
 */
@Injectable()
export class VoiceFoodService {
  constructor(
    @Inject(VOICE_INGEST_REPOSITORY) private readonly repo: VoiceIngestRepository,
    @Inject(SiteFormsService) private readonly forms: SiteFormsService,
    @Inject(VOICE_QUOTE_STORE) private readonly store: VoiceQuoteStore,
    @Optional() @Inject(VoicePhoneLimit) private readonly phoneLimit?: VoicePhoneLimit,
  ) {}

  async check(raw: unknown, now: Date = new Date()): Promise<VoiceFoodAvailability> {
    const b = obj(raw);
    const { fs } = await voiceGate(this.repo, this.forms, b, now, 'FOOD_SERVICE');
    const q = this.slot(b);
    const result = await this.forms.voiceFoodCheck(fs, q, now);
    return result.ok
      ? { ok: true, ...q, period: result.period }
      : { ok: false, reason: result.reason, ...q };
  }

  async quote(raw: unknown, now: Date = new Date()): Promise<VoiceTableQuote> {
    const b = obj(raw);
    const { agent, call, profile, fs } = await voiceGate(this.repo, this.forms, b, now, 'FOOD_SERVICE');
    const q = this.slot(b);
    if ((await this.store.countConfirmed(agent, call)) >= profile.booking.maxPerCall) throw new ConflictException(MAX_REACHED);
    if ((await this.store.countCreated(agent, call)) >= profile.booking.maxPerCall * QUOTES_PER_BOOKING)
      throw new HttpException('Слишком много вариантов за один звонок', HttpStatus.TOO_MANY_REQUESTS);
    const result = await this.forms.voiceFoodCheck(fs, q, now);
    if (!result.ok) throw new ConflictException(result.reason);
    const requestHash = createHash('sha256').update(JSON.stringify([q.date, q.time, q.partySize])).digest('hex');
    const row = await this.store.create({
      organizationId: fs.organizationId,
      locationId: fs.locationId,
      agentId: agent,
      callRef: call,
      kind: 'TABLE',
      selection: { ...q, startsAt: result.startsAt, period: result.period },
      totalMinor: null,
      currency: null,
      expiresAt: new Date(now.getTime() + VOICE_QUOTE_TTL_MS),
      requestHash,
    });
    return { quote: row.id, expiresAt: row.expiresAt.toISOString(), ...q, period: result.period };
  }

  async confirm(raw: unknown, now: Date = new Date()): Promise<VoiceTableBooked> {
    const b = obj(raw);
    const { agent, call, profile, fs } = await voiceGate(this.repo, this.forms, b, now, 'FOOD_SERVICE');
    if (b.consent !== true) throw new BadRequestException('consent: нужно явное согласие звонящего');
    const quoteId = str(b.quote, 36).toLowerCase();
    const g = obj(b.guest);
    const name = str(g.name, NAME_MAX);
    const phone = normalizePhone(g.phone);
    const comment = str(g.comment, COMMENT_MAX);
    if (!name || name.length > NAME_MAX) throw new BadRequestException(`guest.name: от 1 до ${NAME_MAX} знаков`);
    if (!phone) throw new BadRequestException('guest.phone: не меньше 10 цифр');
    if (comment.length > COMMENT_MAX) throw new BadRequestException(`guest.comment: не больше ${COMMENT_MAX} знаков`);
    const phoneHash = this.phoneLimit?.hashOf(phone) ?? null;
    const row = quoteId ? await this.store.find(quoteId) : null;
    if (!row || row.agentId !== agent || row.callRef !== call || row.kind !== 'TABLE') throw new NotFoundException('Предложение не найдено');
    if (row.state === 'REJECTED' || row.state === 'EXPIRED') throw new ConflictException(STALE);
    if (row.state === 'QUOTED') {
      if (row.expiresAt.getTime() <= now.getTime()) {
        await this.store.settle(row.id, 'EXPIRED');
        throw new ConflictException(STALE);
      }
      if ((await this.store.countConfirmed(agent, call)) >= profile.booking.maxPerCall) throw new ConflictException(MAX_REACHED);
      if (await this.phoneLimit?.reached(agent, phoneHash, profile.booking.maxPerPhoneDay, now)) throw new ConflictException(PHONE_REACHED);
    }
    const sel = row.selection as { date: string; time: string; partySize: number };
    let booked;
    try {
      booked = await this.forms.voiceFoodReserve(
        fs,
        { date: sel.date, time: sel.time, partySize: sel.partySize, name, phone, comment: comment || null },
        `voice:${row.id}`,
        now,
      );
    } catch (e) {
      // стол заняли, правило изменилось, период закрылся: котировка больше не действует
      if (e instanceof HttpException && [400, 404, 409, 422].includes(e.getStatus())) {
        await this.store.settle(row.id, 'REJECTED');
        throw new ConflictException(`${STALE}. ${e.message}`);
      }
      throw e;
    }
    if (row.state === 'QUOTED') await this.store.settle(row.id, 'CONFIRMED', booked.reservationId, phoneHash);
    return { status: booked.status, date: booked.date, time: booked.time, partySize: booked.partySize, pendingApproval: booked.status === 'BOOKED' };
  }

  private slot(b: Record<string, unknown>): { date: string; time: string; partySize: number } {
    const date = str(b.date, 10);
    const time = str(b.time, 5);
    const party = typeof b.party === 'number' ? b.party : Number(str(b.party, 3));
    if (!DATE.test(date)) throw new BadRequestException('date: ГГГГ-ММ-ДД');
    if (!TIME.test(time)) throw new BadRequestException('time: ЧЧ:ММ');
    if (!Number.isInteger(party) || party < 1 || party > MAX_PARTY) throw new BadRequestException(`party: от 1 до ${MAX_PARTY} гостей`);
    return { date, time, partySize: party };
  }
}
