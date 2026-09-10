import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { channex } from '@pms/integrations';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { PrismaService } from '../database/prisma.provider';
import type { LocalDailyRate, LocalRestriction } from './ari';
import type {
  LocalCategoryForChannex,
  LocalPropertyForChannex,
  LocalRatePlanForChannex,
} from './setup-plan';

/** Подмножество клиента Channex, которое нужно синхронизации; в тестах — фальшивка. */
export type ChannexGateway = Pick<
  channex.ChannexClient,
  | 'createProperty'
  | 'createRoomType'
  | 'createRatePlan'
  | 'updateAvailability'
  | 'updateRestrictions'
  | 'listProperties'
  | 'bookingRevisionsFeed'
  | 'getBookingRevision'
  | 'ackBookingRevision'
  | 'listWebhooks'
  | 'createWebhook'
  | 'updateWebhook'
  | 'testWebhook'
>;
export const CHANNEX_GATEWAY = Symbol('CHANNEX_GATEWAY');

export interface MappingRow {
  id: string;
  localAccommodationTypeId: string | null;
  localAccommodationTypeCode: string | null;
  localRatePlanId: string | null;
  providerPropertyId: string;
  providerRoomTypeId: string | null;
  providerRatePlanId: string | null;
}
export interface LocalSetup {
  property: LocalPropertyForChannex & { id: string };
  categories: LocalCategoryForChannex[];
  ratePlan: LocalRatePlanForChannex | null;
}

export interface ChannelsRepository {
  localSetup(ratePlanCode: string): Promise<LocalSetup>;
  mappings(provider: string): Promise<MappingRow[]>;
  savePropertyMapping(
    propertyId: string,
    provider: string,
    providerPropertyId: string,
  ): Promise<void>;
  saveRatePlanMapping(row: {
    propertyId: string;
    provider: string;
    localAccommodationTypeId: string;
    localRatePlanId: string;
    providerPropertyId: string;
    providerRoomTypeId: string;
    providerRatePlanId: string;
  }): Promise<void>;
  dailyRates(ratePlanIds: string[], from: string, to: string): Promise<LocalDailyRate[]>;
  restrictions(ratePlanIds: string[], from: string, to: string): Promise<LocalRestriction[]>;
  audit(action: string, after: unknown): Promise<void>;
  // ── доступность для каналов (DATA_MODEL §7): единицы − блокировки − проданные проживания ──
  categoryUnits(): Promise<Array<{ code: string; active: number; capacityAdults: number }>>;
  categoryBlocks(
    from: string,
    toExclusive: string,
  ): Promise<Array<{ accommodationTypeCode: string; dateFrom: string; dateTo: string }>>;
  soldItems(
    from: string,
    toExclusive: string,
  ): Promise<Array<{ accommodationTypeCode: string; arrivalDate: string; departureDate: string }>>;
  // ── очередь исходящих изменений (ChannelOutbox) ──
  enqueueOutbox(provider: string, kind: OutboxKind, payload: unknown[]): Promise<string>;
  pendingOutbox(provider: string, kind: OutboxKind, now: Date): Promise<OutboxRow[]>;
  markOutboxSent(ids: string[], taskId: string | null): Promise<void>;
  markOutboxRetry(
    ids: string[],
    error: string,
    nextAttemptAt: Date,
    failed: boolean,
  ): Promise<void>;
  /** code → id тарифов объекта (для перевода изменений цен в маппинг) */
  ratePlanIdsByCode(): Promise<Record<string, string>>;
  outboxSummary(provider: string): Promise<{
    pending: number;
    failed: number;
    sent: number;
    lastSentAt: string | null;
    lastTaskId: string | null;
    /** Когда поставлена самая старая неотправленная дельта: если давно — канал не знает об изменениях (T6) */
    oldestPendingAt: string | null;
  }>;
}
export type OutboxKind = 'AVAILABILITY' | 'RESTRICTIONS';
export interface OutboxRow {
  id: string;
  kind: OutboxKind;
  payload: unknown[];
  attempts: number;
  createdAt: Date;
}
export const CHANNELS_REPOSITORY = Symbol('CHANNELS_REPOSITORY');

/** Адрес объекта для Channex — OBJECT.md (в схеме Property нет страны/города). */
const OBJECT_LOCATION = { country: 'KZ', city: 'Алматы' };
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

@Injectable()
export class PrismaChannelsRepository implements ChannelsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async localSetup(ratePlanCode: string): Promise<LocalSetup> {
    const p = await this.prisma.db.property.findFirstOrThrow({
      where: { name: LUXX_APARTS_PROPERTY.name },
    });
    const types = await this.prisma.db.accommodationType.findMany({
      where: { propertyId: p.id, active: true },
      orderBy: { code: 'asc' },
      include: { _count: { select: { units: { where: { active: true } } } } },
    });
    const rp = await this.prisma.db.ratePlan.findUnique({
      where: { propertyId_code: { propertyId: p.id, code: ratePlanCode } },
      select: { id: true, code: true, name: true, currency: true },
    });
    return {
      property: {
        id: p.id,
        name: p.name,
        currency: p.currency,
        timezone: p.timezone,
        address: p.address,
        email: null,
        phone: null,
        ...OBJECT_LOCATION,
      },
      categories: types.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        kind: t.kind,
        capacityAdults: t.capacityAdults,
        units: t._count.units,
      })),
      ratePlan: rp,
    };
  }
  async mappings(provider: string): Promise<MappingRow[]> {
    const rows = await this.prisma.db.channelMapping.findMany({
      where: { provider },
      include: { accommodationType: { select: { code: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      localAccommodationTypeId: r.localAccommodationTypeId,
      localAccommodationTypeCode: r.accommodationType?.code ?? null,
      localRatePlanId: r.localRatePlanId,
      providerPropertyId: r.providerPropertyId,
      providerRoomTypeId: r.providerRoomTypeId,
      providerRatePlanId: r.providerRatePlanId,
    }));
  }
  async savePropertyMapping(
    propertyId: string,
    provider: string,
    providerPropertyId: string,
  ): Promise<void> {
    await this.prisma.db.channelMapping.create({
      data: { propertyId, provider, providerPropertyId },
    });
  }
  async saveRatePlanMapping(
    row: Parameters<ChannelsRepository['saveRatePlanMapping']>[0],
  ): Promise<void> {
    await this.prisma.db.channelMapping.create({ data: row });
  }
  async dailyRates(ratePlanIds: string[], from: string, to: string): Promise<LocalDailyRate[]> {
    const rows = await this.prisma.db.dailyRate.findMany({
      where: { ratePlanId: { in: ratePlanIds }, date: { gte: asDate(from), lte: asDate(to) } },
      include: { accommodationType: { select: { code: true } } },
    });
    return rows.map((r) => ({
      date: iso(r.date),
      accommodationTypeCode: r.accommodationType.code,
      ratePlanId: r.ratePlanId,
      occupancy: r.occupancy,
      priceMinor: r.price,
    }));
  }
  async restrictions(ratePlanIds: string[], from: string, to: string): Promise<LocalRestriction[]> {
    const rows = await this.prisma.db.restriction.findMany({
      where: { ratePlanId: { in: ratePlanIds }, date: { gte: asDate(from), lte: asDate(to) } },
      include: { accommodationType: { select: { code: true } } },
    });
    return rows.map((r) => ({
      date: iso(r.date),
      accommodationTypeCode: r.accommodationType.code,
      ratePlanId: r.ratePlanId,
      minStay: r.minStay,
      maxStay: r.maxStay,
      stopSell: r.stopSell,
      closedToArrival: r.closedToArrival,
      closedToDeparture: r.closedToDeparture,
    }));
  }
  async audit(action: string, after: unknown): Promise<void> {
    const p = await this.prisma.db.property.findFirstOrThrow({
      where: { name: LUXX_APARTS_PROPERTY.name },
      select: { id: true },
    });
    await this.prisma.db.auditLog.create({
      data: {
        entityType: 'Property',
        entityId: p.id,
        action,
        after: JSON.parse(JSON.stringify(after)),
      },
    });
  }
  async categoryUnits(): Promise<Array<{ code: string; active: number; capacityAdults: number }>> {
    const p = await this.prisma.db.property.findFirstOrThrow({
      where: { name: LUXX_APARTS_PROPERTY.name },
      select: { id: true },
    });
    const types = await this.prisma.db.accommodationType.findMany({
      where: { propertyId: p.id, active: true },
      select: {
        code: true,
        capacityAdults: true,
        _count: { select: { units: { where: { active: true } } } },
      },
    });
    return types.map((t) => ({
      code: t.code,
      active: t._count.units,
      capacityAdults: t.capacityAdults,
    }));
  }
  async categoryBlocks(from: string, toExclusive: string) {
    const rows = await this.prisma.db.inventoryBlock.findMany({
      where: { dateFrom: { lt: asDate(toExclusive) }, dateTo: { gt: asDate(from) } },
      include: { inventoryUnit: { select: { accommodationType: { select: { code: true } } } } },
    });
    return rows.map((b) => ({
      accommodationTypeCode: b.inventoryUnit.accommodationType.code,
      dateFrom: iso(b.dateFrom),
      dateTo: iso(b.dateTo),
    }));
  }
  async soldItems(from: string, toExclusive: string) {
    const rows = await this.prisma.db.reservationItem.findMany({
      where: {
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        arrivalDate: { lt: asDate(toExclusive) },
        departureDate: { gt: asDate(from) },
      },
      select: {
        arrivalDate: true,
        departureDate: true,
        accommodationType: { select: { code: true } },
      },
    });
    return rows.map((r) => ({
      accommodationTypeCode: r.accommodationType.code,
      arrivalDate: iso(r.arrivalDate),
      departureDate: iso(r.departureDate),
    }));
  }
  async enqueueOutbox(provider: string, kind: OutboxKind, payload: unknown[]): Promise<string> {
    const row = await this.prisma.db.channelOutbox.create({
      data: { provider, kind, payload: JSON.parse(JSON.stringify(payload)) },
      select: { id: true },
    });
    return row.id;
  }
  async pendingOutbox(provider: string, kind: OutboxKind, now: Date): Promise<OutboxRow[]> {
    const rows = await this.prisma.db.channelOutbox.findMany({
      where: { provider, kind, status: 'PENDING', nextAttemptAt: { lte: now } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      payload: r.payload as unknown[],
      attempts: r.attempts,
      createdAt: r.createdAt,
    }));
  }
  async markOutboxSent(ids: string[], taskId: string | null): Promise<void> {
    await this.prisma.db.channelOutbox.updateMany({
      where: { id: { in: ids } },
      data: { status: 'SENT', taskId, sentAt: new Date(), lastError: null },
    });
  }
  async markOutboxRetry(
    ids: string[],
    error: string,
    nextAttemptAt: Date,
    failed: boolean,
  ): Promise<void> {
    await this.prisma.db.channelOutbox.updateMany({
      where: { id: { in: ids } },
      data: {
        attempts: { increment: 1 },
        lastError: error.slice(0, 1000),
        nextAttemptAt,
        ...(failed ? { status: 'FAILED' } : {}),
      },
    });
  }
  async ratePlanIdsByCode(): Promise<Record<string, string>> {
    const p = await this.prisma.db.property.findFirstOrThrow({
      where: { name: LUXX_APARTS_PROPERTY.name },
      select: { id: true },
    });
    const rows = await this.prisma.db.ratePlan.findMany({
      where: { propertyId: p.id },
      select: { code: true, id: true },
    });
    return Object.fromEntries(rows.map((r) => [r.code, r.id]));
  }
  async outboxSummary(provider: string) {
    const [pending, failed, sent, last, oldest] = await Promise.all([
      this.prisma.db.channelOutbox.count({ where: { provider, status: 'PENDING' } }),
      this.prisma.db.channelOutbox.count({ where: { provider, status: 'FAILED' } }),
      this.prisma.db.channelOutbox.count({ where: { provider, status: 'SENT' } }),
      this.prisma.db.channelOutbox.findFirst({
        where: { provider, status: 'SENT' },
        orderBy: { sentAt: 'desc' },
        select: { sentAt: true, taskId: true },
      }),
      this.prisma.db.channelOutbox.findFirst({
        where: { provider, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);
    return {
      pending,
      failed,
      sent,
      lastSentAt: last?.sentAt?.toISOString() ?? null,
      lastTaskId: last?.taskId ?? null,
      oldestPendingAt: oldest?.createdAt?.toISOString() ?? null,
    };
  }
}

/** Клиент Channex из окружения. Без ключа — каждая операция отвечает 503 с понятным текстом. */
export function channexGatewayFromEnv(): ChannexGateway {
  const apiKey = process.env.CHANNEX_API_KEY?.trim();
  const baseUrl = process.env.CHANNEX_API_BASE_URL?.trim() || undefined;
  if (!apiKey) {
    const fail = () =>
      Promise.reject(
        new channex.ChannexApiError(
          'CHANNEX_API_KEY не задан в .env — вписывает владелец (SECURITY.md §3)',
          503,
          '/',
        ),
      );
    return {
      createProperty: fail,
      createRoomType: fail,
      createRatePlan: fail,
      updateAvailability: fail,
      updateRestrictions: fail,
      listProperties: fail,
      bookingRevisionsFeed: fail,
      getBookingRevision: fail,
      ackBookingRevision: fail,
      listWebhooks: fail,
      createWebhook: fail,
      updateWebhook: fail,
      testWebhook: fail,
    };
  }
  return new channex.ChannexClient(baseUrl ? { apiKey, baseUrl } : { apiKey });
}
