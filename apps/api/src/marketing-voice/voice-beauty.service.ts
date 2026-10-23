import 'reflect-metadata';
import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { normalizePhone } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import {
  SiteFormsService,
  type FormSite,
  type VoiceBeautyCatalog,
} from '../site-forms/site-forms.service';
import { VOICE_INGEST_REPOSITORY, type VoiceIngestRepository } from './voice-ingest.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CALL_ID = /^[A-Za-z0-9._:-]{1,64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
/** Срок котировки голоса: как у брони из чата (решение владельца 01.10.2026) */
export const VOICE_QUOTE_TTL_MS = 30 * 60_000;
const QUOTES_PER_BOOKING = 3;
const NAME_MAX = 100;
const COMMENT_MAX = 1000;

export const VOICE_QUOTE_STORE = Symbol('VOICE_QUOTE_STORE');

export type VoiceQuoteKind = 'APPOINTMENT' | 'TABLE';
export type VoiceQuoteState = 'QUOTED' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED';

export interface VoiceQuoteRow {
  id: string;
  organizationId: string;
  locationId: string;
  agentId: string;
  callRef: string;
  kind: VoiceQuoteKind;
  selection: Record<string, unknown>;
  totalMinor: string | null;
  currency: string | null;
  expiresAt: Date;
  requestHash: string;
  state: VoiceQuoteState;
  resultId: string | null;
}

/** Котировки голоса для салона и ресторана: таблица `voice_booking_quotes` (миграция 147) */
export interface VoiceQuoteStore {
  countConfirmed(agentId: string, callRef: string): Promise<number>;
  countCreated(agentId: string, callRef: string): Promise<number>;
  /** Повтор того же запроса звонка (agent, call, hash) возвращает ту же строку */
  create(row: Omit<VoiceQuoteRow, 'id' | 'state' | 'resultId'>): Promise<VoiceQuoteRow>;
  find(id: string): Promise<VoiceQuoteRow | null>;
  /** Один переход из QUOTED; false: уже не QUOTED */
  settle(id: string, state: Exclude<VoiceQuoteState, 'QUOTED'>, resultId?: string): Promise<boolean>;
}

@Injectable()
export class PrismaVoiceQuoteStore implements VoiceQuoteStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  countConfirmed(agentId: string, callRef: string): Promise<number> {
    return this.prisma.db.voiceBookingQuote.count({ where: { agentId, callRef, state: 'CONFIRMED' } });
  }

  countCreated(agentId: string, callRef: string): Promise<number> {
    return this.prisma.db.voiceBookingQuote.count({ where: { agentId, callRef } });
  }

  async create(row: Omit<VoiceQuoteRow, 'id' | 'state' | 'resultId'>): Promise<VoiceQuoteRow> {
    const data = {
      organizationId: row.organizationId,
      locationId: row.locationId,
      agentId: row.agentId,
      callRef: row.callRef,
      kind: row.kind,
      selection: row.selection as object,
      totalMinor: row.totalMinor === null ? null : BigInt(row.totalMinor),
      currency: row.currency,
      expiresAt: row.expiresAt,
      requestHash: row.requestHash,
    };
    try {
      return toRow(await this.prisma.db.voiceBookingQuote.create({ data }));
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e;
      const found = await this.prisma.db.voiceBookingQuote.findUnique({
        where: { agentId_callRef_requestHash: { agentId: row.agentId, callRef: row.callRef, requestHash: row.requestHash } },
      });
      if (!found) throw e;
      return toRow(found);
    }
  }

  async find(id: string): Promise<VoiceQuoteRow | null> {
    const found = await this.prisma.db.voiceBookingQuote.findUnique({ where: { id } });
    return found ? toRow(found) : null;
  }

  async settle(id: string, state: Exclude<VoiceQuoteState, 'QUOTED'>, resultId?: string): Promise<boolean> {
    const done = await this.prisma.db.voiceBookingQuote.updateMany({
      where: { id, state: 'QUOTED' },
      data: { state, resultId: resultId ?? null, updatedAt: new Date() },
    });
    return done.count > 0;
  }
}

function toRow(r: {
  id: string; organizationId: string; locationId: string; agentId: string; callRef: string; kind: string;
  selection: unknown; totalMinor: bigint | null; currency: string | null; expiresAt: Date; requestHash: string;
  state: string; resultId: string | null;
}): VoiceQuoteRow {
  return {
    id: r.id, organizationId: r.organizationId, locationId: r.locationId, agentId: r.agentId, callRef: r.callRef,
    kind: r.kind as VoiceQuoteKind, selection: (r.selection ?? {}) as Record<string, unknown>,
    totalMinor: r.totalMinor === null ? null : r.totalMinor.toString(), currency: r.currency?.trim() ?? null,
    expiresAt: r.expiresAt, requestHash: r.requestHash, state: r.state as VoiceQuoteState, resultId: r.resultId,
  };
}

export interface VoiceSlots {
  date: string;
  service: { id: string; name: string; durationMinutes: number; priceMinor: string; currency: string };
  masters: Array<{ id: string; name: string }>;
  slots: Array<{ startsAt: string; time: string; masterIds: string[] }>;
}

export interface VoiceVisitQuote {
  quote: string;
  expiresAt: string;
  service: string;
  master: string;
  startsAt: string;
  time: string;
  date: string;
  priceMinor: string;
  currency: string;
}

export interface VoiceVisitBooked {
  status: string;
  service: string;
  master: string;
  startsAt: string;
  priceMinor: string;
  currency: string;
  /** Запись ждёт подтверждения администратора (статус BOOKED): гостю так и говорят */
  pendingApproval: boolean;
}

const obj = (raw: unknown): Record<string, unknown> => (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {});
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max + 1) : '');
const localDate = (at: Date, timezone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

/**
 * Запись в салон по телефону (DATA_MODEL VOICE-BOOKING-OWNER-APPROVAL-20261023). Окна, график, отпуска и занятость считает тот же
 * расчёт, что у формы сайта (`SiteFormsService`); голос добавляет выключатель, привязку к звонку, котировку на 30 минут с проверкой,
 * что время было в выдаче, лимиты и явное согласие. Запись создаётся со статусом BOOKED (ждёт подтверждения администратора).
 */
@Injectable()
export class VoiceBeautyService {
  constructor(
    @Inject(VOICE_INGEST_REPOSITORY) private readonly repo: VoiceIngestRepository,
    @Inject(SiteFormsService) private readonly forms: SiteFormsService,
    @Inject(VOICE_QUOTE_STORE) private readonly store: VoiceQuoteStore,
  ) {}

  async catalog(raw: unknown, now: Date = new Date()): Promise<VoiceBeautyCatalog> {
    const { fs } = await this.gate(obj(raw), now);
    return this.forms.voiceBeautyCatalog(fs);
  }

  async slots(raw: unknown, now: Date = new Date()): Promise<VoiceSlots> {
    const b = obj(raw);
    const { fs } = await this.gate(b, now);
    const serviceId = str(b.service, 36).toLowerCase();
    const date = str(b.date, 10);
    const employeeId = this.optionalId(b.employee, 'employee');
    if (!UUID.test(serviceId)) throw new BadRequestException('service: ожидался UUID');
    if (!DATE.test(date)) throw new BadRequestException('date: ГГГГ-ММ-ДД');
    const result = await this.forms.voiceBeautySlots(fs, { serviceId, employeeId, date }, now);
    return {
      date: result.date,
      service: result.service,
      masters: result.employees,
      slots: result.slots.map((s) => ({ startsAt: s.startsAt, time: s.time, masterIds: s.employeeIds })),
    };
  }

  async quote(raw: unknown, now: Date = new Date()): Promise<VoiceVisitQuote> {
    const b = obj(raw);
    const { agent, call, profile, fs } = await this.gate(b, now);
    const serviceId = str(b.service, 36).toLowerCase();
    const employeeId = this.optionalId(b.employee, 'employee');
    const startsAtRaw = str(b.startsAt, 40);
    if (!UUID.test(serviceId)) throw new BadRequestException('service: ожидался UUID');
    if (!INSTANT.test(startsAtRaw) || Number.isNaN(Date.parse(startsAtRaw)))
      throw new BadRequestException('startsAt: время ISO 8601 с поясом');
    const startsAt = new Date(startsAtRaw);
    if ((await this.store.countConfirmed(agent, call)) >= profile.booking.maxPerCall) throw new ConflictException(MAX_REACHED);
    if ((await this.store.countCreated(agent, call)) >= profile.booking.maxPerCall * QUOTES_PER_BOOKING)
      throw new HttpException('Слишком много вариантов за один звонок', HttpStatus.TOO_MANY_REQUESTS);
    // время обязано быть в выдаче свободных окон на эту дату прямо сейчас (и у названного мастера)
    const date = localDate(startsAt, fs.timezone);
    const result = await this.forms.voiceBeautySlots(fs, { serviceId, employeeId, date }, now);
    const slot = result.slots.find((s) => new Date(s.startsAt).getTime() === startsAt.getTime());
    if (!slot || (employeeId !== null && !slot.employeeIds.includes(employeeId)))
      throw new ConflictException('Это время недоступно: нужна новая проверка свободных окон');
    const masterName = employeeId === null ? 'любой свободный' : (result.employees.find((e) => e.id === employeeId)?.name ?? 'мастер');
    const requestHash = createHash('sha256').update(JSON.stringify([serviceId, employeeId, startsAt.toISOString()])).digest('hex');
    const row = await this.store.create({
      organizationId: fs.organizationId,
      locationId: fs.locationId,
      agentId: agent,
      callRef: call,
      kind: 'APPOINTMENT',
      selection: { serviceId, serviceName: result.service.name, employeeId, employeeName: masterName, startsAt: startsAt.toISOString(), date, time: slot.time },
      totalMinor: result.service.priceMinor,
      currency: result.service.currency,
      expiresAt: new Date(now.getTime() + VOICE_QUOTE_TTL_MS),
      requestHash,
    });
    return {
      quote: row.id,
      expiresAt: row.expiresAt.toISOString(),
      service: result.service.name,
      master: masterName,
      startsAt: startsAt.toISOString(),
      time: slot.time,
      date,
      priceMinor: result.service.priceMinor,
      currency: result.service.currency,
    };
  }

  async confirm(raw: unknown, now: Date = new Date()): Promise<VoiceVisitBooked> {
    const b = obj(raw);
    const { agent, call, profile, fs } = await this.gate(b, now);
    if (b.consent !== true) throw new BadRequestException('consent: нужно явное согласие звонящего');
    const quoteId = str(b.quote, 36).toLowerCase();
    const g = obj(b.guest);
    const name = str(g.name, NAME_MAX);
    const phone = normalizePhone(g.phone);
    const comment = str(g.comment, COMMENT_MAX);
    if (!name || name.length > NAME_MAX) throw new BadRequestException(`guest.name: от 1 до ${NAME_MAX} знаков`);
    if (!phone) throw new BadRequestException('guest.phone: не меньше 10 цифр');
    if (comment.length > COMMENT_MAX) throw new BadRequestException(`guest.comment: не больше ${COMMENT_MAX} знаков`);
    const row = quoteId ? await this.store.find(quoteId) : null;
    if (!row || row.agentId !== agent || row.callRef !== call || row.kind !== 'APPOINTMENT')
      throw new NotFoundException('Предложение не найдено');
    if (row.state === 'REJECTED' || row.state === 'EXPIRED') throw new ConflictException(STALE);
    if (row.state === 'QUOTED') {
      if (row.expiresAt.getTime() <= now.getTime()) {
        await this.store.settle(row.id, 'EXPIRED');
        throw new ConflictException(STALE);
      }
      if ((await this.store.countConfirmed(agent, call)) >= profile.booking.maxPerCall) throw new ConflictException(MAX_REACHED);
    }
    const sel = row.selection as { serviceId: string; employeeId: string | null; startsAt: string };
    let booked;
    try {
      booked = await this.forms.voiceBeautyBook(
        fs,
        { serviceId: sel.serviceId, serviceIds: [sel.serviceId], employeeId: sel.employeeId, startsAt: new Date(sel.startsAt), name, phone, comment: comment || null },
        `voice:${row.id}`,
        now,
      );
    } catch (e) {
      // время занято, график изменился, услуга не оказывается: котировка больше не действует, нужны новые окна
      if (e instanceof HttpException && [400, 404, 409, 422].includes(e.getStatus())) {
        await this.store.settle(row.id, 'REJECTED');
        throw new ConflictException(`${STALE}. ${e.message}`);
      }
      throw e;
    }
    if (row.state === 'QUOTED') await this.store.settle(row.id, 'CONFIRMED', booked.appointmentId);
    return {
      status: booked.status,
      service: booked.service.name,
      master: booked.employee.name,
      startsAt: booked.startsAt,
      priceMinor: booked.priceMinor,
      currency: booked.currency,
      pendingApproval: booked.status === 'BOOKED',
    };
  }

  private optionalId(v: unknown, field: string): string | null {
    if (v === undefined || v === null || v === '') return null;
    const id = str(v, 36).toLowerCase();
    if (!UUID.test(id)) throw new BadRequestException(`${field}: ожидался UUID`);
    return id;
  }

  private async gate(b: Record<string, unknown>, now: Date) {
    const agent = str(b.agent, 36).toLowerCase();
    if (!UUID.test(agent)) throw new BadRequestException('agent: ожидался UUID');
    const call = str(b.call, 64);
    if (!CALL_ID.test(call)) throw new BadRequestException('call: идентификатор звонка, 1-64 знака');
    const profile = await this.repo.profile(agent);
    if (profile === null) throw new NotFoundException('Агент не найден');
    if (profile === 'NO_LOCATION') throw new UnprocessableEntityException('У агента не выбран филиал');
    if (profile.vertical !== 'BEAUTY') throw new ConflictException('Запись по телефону для этого направления не подключена');
    if (!profile.booking.enabled) throw new ConflictException('Бронирование по телефону на объекте выключено');
    const scope = await this.repo.resolveAgent(agent);
    if (scope === null || scope === 'NO_LOCATION') throw new NotFoundException('Агент не найден');
    const fs: FormSite = await this.forms.voiceSite(scope.locationId, agent, now);
    if (fs.organizationId !== profile.organizationId || fs.vertical !== 'BEAUTY') throw new NotFoundException('Агент не найден');
    return { agent, call, profile, fs };
  }
}

const STALE = 'Предложение устарело: нужны новые свободные окна и новое согласие';
const MAX_REACHED = 'За один звонок записано максимум: дальше только через администратора';
