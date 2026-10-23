import 'reflect-metadata';
import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { canWrite } from '@pms/domain';
import { currentLocationId, currentOrganizationId, hasSignedInActor } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import type { VoiceDirection, VoiceState } from './voice-events';

/**
 * Чтение журнала звонков для стойки (раздел «Голосовой агент» в «Продвижении»). Запросы человека идут ролью `wetop_app`:
 * RLS отдаёт только строки его организации, поверх этого строгий филиал, как у «Бюджета» (без филиала 409).
 */
export const MARKETING_VOICE_REPOSITORY = Symbol('MARKETING_VOICE_REPOSITORY');
export const CHOOSE_LOCATION = 'Выберите филиал';

export interface ReadScope {
  organizationId: string;
  locationId: string;
  /** IANA-пояс филиала: от него считается месяц (AGENTS.md §13) */
  timezone: string;
}

export interface SummaryData {
  total: number;
  byState: Record<VoiceState, number>;
  answered: number;
  withCallback: number;
  withTransfer: number;
  durationSum: number;
  durationCount: number;
}

export interface CallRecord {
  id: string;
  receivedAt: Date;
  callerMasked: string | null;
  state: VoiceState;
  direction: VoiceDirection;
  durationSeconds: number | null;
  transferRequested: boolean;
  callbackRequested: boolean;
  endReason: string | null;
}

export interface CallbackRecord {
  id: string;
  callId: string;
  phone: string;
  name: string;
  note: string;
  status: 'NEW' | 'DONE';
  createdAt: Date;
  doneAt: Date | null;
}

/** Агент голоса филиала и его настройка брони по телефону (`voice_profiles`, миграции 147 и 149) */
export interface BookingAgentRecord {
  agentId: string;
  lifecycle: string;
  vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
  enabled: boolean;
  needsApproval: boolean;
  maxPerCall: number;
}

export interface BookingPatch {
  enabled?: boolean;
  maxPerCall?: number;
}

export interface MarketingVoiceRepository {
  /** Неархивный агент ИИ-продавца филиала со строкой настройки (умолчания, если строки профиля ещё нет); null: агента нет */
  bookingAgent(scope: ReadScope): Promise<BookingAgentRecord | null>;
  /** Чего не хватает для брони по телефону на этом направлении (пустой список: всё готово) */
  readiness(scope: ReadScope, vertical: BookingAgentRecord['vertical']): Promise<string[]>;
  saveBooking(scope: ReadScope, agentId: string, patch: BookingPatch, userId: string | null): Promise<void>;
  scope(): Promise<ReadScope>;
  assertWritable(organizationId: string): Promise<void>;
  summary(scope: ReadScope, start: Date, end: Date): Promise<SummaryData>;
  calls(scope: ReadScope, start: Date, end: Date, limit: number, offset: number): Promise<{ rows: CallRecord[]; total: number }>;
  callbacks(scope: ReadScope, status: 'NEW' | 'DONE' | null, limit: number): Promise<CallbackRecord[]>;
  /** null: просьбы нет у этого филиала. Закрытая просьба возвращается как есть */
  closeCallback(scope: ReadScope, id: string, userId: string | null): Promise<CallbackRecord | null>;
}

const STATES: readonly VoiceState[] = ['RECEIVED', 'ANSWERED', 'ENDED', 'REJECTED', 'FAILED'];
const callbackSelect = {
  id: true, voiceCallId: true, phone: true, name: true, note: true, status: true, createdAt: true, doneAt: true,
} as const;
const toCallback = (r: {
  id: string; voiceCallId: string; phone: string; name: string; note: string;
  status: 'NEW' | 'DONE'; createdAt: Date; doneAt: Date | null;
}): CallbackRecord => ({
  id: r.id, callId: r.voiceCallId, phone: r.phone, name: r.name, note: r.note,
  status: r.status, createdAt: r.createdAt, doneAt: r.doneAt,
});

@Injectable()
export class PrismaMarketingVoiceRepository implements MarketingVoiceRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async scope(): Promise<ReadScope> {
    const organizationId = currentOrganizationId();
    if (!hasSignedInActor() || !organizationId) throw new ForbiddenException('Войдите в организацию');
    const locationId = currentLocationId();
    if (!locationId) throw new ConflictException(CHOOSE_LOCATION);
    const location = await this.prisma.db.location.findFirst({
      where: { id: locationId, status: 'ACTIVE', business: { organizationId } },
      select: { id: true, timezone: true },
    });
    if (!location) throw new ForbiddenException('Выбранный филиал недоступен: выберите филиал заново');
    return { organizationId, locationId: location.id, timezone: location.timezone };
  }

  async bookingAgent(scope: ReadScope): Promise<BookingAgentRecord | null> {
    const agent = await this.prisma.db.sellerAgent.findFirst({
      where: { organizationId: scope.organizationId, locationId: scope.locationId, scenario: 'sales', lifecycle: { not: 'archived' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        lifecycle: true,
        location: { select: { business: { select: { vertical: true } } } },
        voiceProfile: { select: { bookingEnabled: true, bookingNeedsApproval: true, bookingMaxPerCall: true } },
      },
    });
    if (!agent?.location) return null;
    return {
      agentId: agent.id,
      lifecycle: agent.lifecycle,
      vertical: agent.location.business.vertical,
      enabled: agent.voiceProfile?.bookingEnabled ?? false,
      needsApproval: agent.voiceProfile?.bookingNeedsApproval ?? true,
      maxPerCall: agent.voiceProfile?.bookingMaxPerCall ?? 3,
    };
  }

  async readiness(scope: ReadScope, vertical: BookingAgentRecord['vertical']): Promise<string[]> {
    const db = this.prisma.db;
    const blockers: string[] = [];
    if (vertical === 'BEAUTY') {
      const n = await db.beautyService.count({
        where: {
          active: true,
          locations: { some: { locationId: scope.locationId, enabled: true } },
          employees: { some: { employee: { status: 'ACTIVE', locations: { some: { locationId: scope.locationId } } } } },
        },
      });
      if (n === 0) blockers.push('Нет услуг, которые оказывает хотя бы один мастер этого филиала');
    } else if (vertical === 'FOOD_SERVICE') {
      const [periods, tables] = await Promise.all([
        db.servicePeriod.count({ where: { locationId: scope.locationId, active: true } }),
        db.diningTable.count({ where: { active: true, area: { locationId: scope.locationId, active: true } } }),
      ]);
      if (periods === 0) blockers.push('Не заданы периоды обслуживания');
      if (tables === 0) blockers.push('Нет столов в зале');
    } else {
      const sites = await db.trackedSite.count({ where: { locationId: scope.locationId, status: 'ACTIVE', bookingEnabled: true } });
      if (sites === 0) blockers.push('У объекта нет сайта с включённым бронированием');
    }
    return blockers;
  }

  async saveBooking(scope: ReadScope, agentId: string, patch: BookingPatch, userId: string | null): Promise<void> {
    const data = {
      ...(patch.enabled !== undefined ? { bookingEnabled: patch.enabled } : {}),
      ...(patch.maxPerCall !== undefined ? { bookingMaxPerCall: patch.maxPerCall } : {}),
    };
    await this.prisma.db.$transaction(async (tx) => {
      const found = await tx.voiceProfile.findUnique({ where: { agentId }, select: { agentId: true } });
      if (found) {
        await tx.voiceProfile.update({ where: { agentId }, data });
      } else {
        const biz = await tx.location.findFirstOrThrow({
          where: { id: scope.locationId, business: { organizationId: scope.organizationId } },
          select: { businessId: true },
        });
        await tx.voiceProfile.create({
          data: { agentId, organizationId: scope.organizationId, businessId: biz.businessId, ...data },
        });
      }
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId,
          entityType: 'voice_profile',
          entityId: agentId,
          action: 'voice.booking.settings',
          after: { locationId: scope.locationId, ...patch },
        },
      });
    });
  }

  async assertWritable(organizationId: string): Promise<void> {
    const org = await this.prisma.db.organization.findUnique({
      where: { id: organizationId },
      select: { status: true, trialEndsAt: true },
    });
    if (!org || !canWrite(org.status, org.trialEndsAt, new Date()))
      throw new ForbiddenException('Организация доступна только для чтения');
  }

  async summary(scope: ReadScope, start: Date, end: Date): Promise<SummaryData> {
    const where = { organizationId: scope.organizationId, locationId: scope.locationId, receivedAt: { gte: start, lt: end } };
    const [groups, answered, withCallback, withTransfer, duration] = await Promise.all([
      this.prisma.db.voiceCall.groupBy({ by: ['state'], where, _count: { _all: true } }),
      this.prisma.db.voiceCall.count({ where: { ...where, answeredAt: { not: null } } }),
      this.prisma.db.voiceCall.count({ where: { ...where, callbackRequested: true } }),
      this.prisma.db.voiceCall.count({ where: { ...where, transferRequested: true } }),
      this.prisma.db.voiceCall.aggregate({ where: { ...where, durationSeconds: { not: null } }, _sum: { durationSeconds: true }, _count: { durationSeconds: true } }),
    ]);
    const byState = Object.fromEntries(STATES.map((s) => [s, 0])) as Record<VoiceState, number>;
    for (const g of groups) byState[g.state] = g._count._all;
    return {
      total: STATES.reduce((sum, s) => sum + byState[s], 0),
      byState,
      answered,
      withCallback,
      withTransfer,
      durationSum: duration._sum.durationSeconds ?? 0,
      durationCount: duration._count.durationSeconds,
    };
  }

  async calls(scope: ReadScope, start: Date, end: Date, limit: number, offset: number) {
    const where = { organizationId: scope.organizationId, locationId: scope.locationId, receivedAt: { gte: start, lt: end } };
    const [rows, total] = await Promise.all([
      this.prisma.db.voiceCall.findMany({
        where,
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
        select: {
          id: true, receivedAt: true, callerMasked: true, state: true, direction: true, durationSeconds: true,
          transferRequested: true, callbackRequested: true, endReason: true,
        },
      }),
      this.prisma.db.voiceCall.count({ where }),
    ]);
    return { rows, total };
  }

  async callbacks(scope: ReadScope, status: 'NEW' | 'DONE' | null, limit: number): Promise<CallbackRecord[]> {
    const rows = await this.prisma.db.voiceCallback.findMany({
      where: { organizationId: scope.organizationId, call: { locationId: scope.locationId }, ...(status ? { status } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: callbackSelect,
    });
    return rows.map(toCallback);
  }

  async closeCallback(scope: ReadScope, id: string, userId: string | null): Promise<CallbackRecord | null> {
    const found = await this.prisma.db.voiceCallback.findFirst({
      where: { id, organizationId: scope.organizationId, call: { locationId: scope.locationId } },
      select: callbackSelect,
    });
    if (!found) return null;
    if (found.status === 'DONE') return toCallback(found);
    // Условное закрытие: из двух одновременных закрытий отметку (кто и когда) оставляет первое, второе её не переписывает
    await this.prisma.db.voiceCallback.updateMany({
      where: { id, organizationId: scope.organizationId, status: 'NEW' },
      data: { status: 'DONE', doneAt: new Date(), doneById: userId },
    });
    const done = await this.prisma.db.voiceCallback.findFirst({
      where: { id, organizationId: scope.organizationId, call: { locationId: scope.locationId } },
      select: callbackSelect,
    });
    return done ? toCallback(done) : null;
  }
}
