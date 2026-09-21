import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { channex } from '@pms/integrations';
import { Prisma } from '@pms/database';
import { guardAriGateway } from './ari-switch';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { assertPropertyVisible, propertyIdRef } from '../database/property-ref';
import { loadReservationCard, type ReservationCard } from '../reservations/reservation-card';
import { stayFacts } from '../chessboard/stay-facts';
import type { LocalDailyRate, LocalRestriction } from './ari';
import type {
  LocalCategoryForChannex,
  LocalPropertyForChannex,
  LocalRatePlanForChannex,
} from './setup-plan';
import { auditUserId } from '../accounts/actor';

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
  /** `warning` — Channex принял запрос, но отклонил часть значений (meta.warnings): остаётся в last_error */
  markOutboxSent(ids: string[], taskId: string | null, warning?: string | null): Promise<void>;
  /** Тот же репозиторий поверх транзакции команды — очередь пишется вместе с её данными */
  withClient?(db: unknown): ChannelsRepository;
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
  /** Журнал входящих событий канала (ADR-007): что пришло, обработалось ли, сколько попыток, ошибка */
  recentEvents(provider: string, limit: number): Promise<InboundEventRow[]>;
  /** Строки очереди ARI: что именно уехало в Channex (срез 7.2, сцена показа сертификации) */
  recentOutbox(provider: string, limit: number): Promise<OutboxMessageRow[]>;
  /** Срез 7.2: страница журнала с фильтрами, поиском по номеру брони / unique_id и связью с бронью */
  eventsPage(
    provider: string,
    q: EventsQuery,
  ): Promise<{ rows: InboundEventListRow[]; total: number }>;
  /** Одно событие с сохранённой ревизией (payload) — для страницы «Приём брони из канала» */
  eventByRevision(
    provider: string,
    revisionId: string,
  ): Promise<(InboundEventRow & { payload: unknown }) | null>;
  /** Карточка брони по unique_id ревизии плюс остаток счёта по проживаниям (тем же folioBalance) */
  reservationCardByExternalId(
    externalId: string,
  ): Promise<{ card: ReservationCard; balances: Record<string, string> } | null>;
  /** Строки очереди ARI для журнала интеграции (срез 7.2) */
  outboxRows(
    provider: string,
    q: { status?: OutboxStatus | undefined; limit: number },
  ): Promise<OutboxListRow[]>;
  /** Когда последний раз событие пришло этим путём (сторож webhook); typePrefix — например 'booking' */
  lastEventAt(
    provider: string,
    via: 'WEBHOOK' | 'PULL' | 'MANUAL',
    typePrefix?: string,
  ): Promise<Date | null>;
  /** Когда последний раз выполнялось действие из журнала аудита (расписание полной выгрузки) */
  lastAuditAt(action: string): Promise<Date | null>;
}
export interface InboundEventRow {
  externalEventId: string;
  type: string;
  status: string;
  attempts: number;
  /** Пришло по webhook, подобрал опрос ленты или разобрано вручную */
  receivedVia: 'WEBHOOK' | 'PULL' | 'MANUAL';
  receivedAt: string;
  processedAt: string | null;
  lastError: string | null;
  /**
   * Номер брони PMS, если ревизию удалось связать: ищется по `unique_id` ревизии в `externalId`
   * брони — тем же ключом, которым приём связывает бронь (срез 7.2). `null` — ревизия не разобрана
   * или бронь удалена.
   */
  reservationNumber: string | null;
}

/** Одно сообщение очереди ARI: что уезжает, чем кончилось (`channel_outbox`, только чтение) */
export interface OutboxMessageRow {
  id: string;
  kind: OutboxKind;
  status: 'PENDING' | 'SENT' | 'FAILED';
  attempts: number;
  taskId: string | null;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
  /** сколько строк значений внутри сообщения */
  lines: number;
  /** крайние даты по всем строкам: за какие ночи изменение */
  dateFrom: string | null;
  dateTo: string | null;
  /** адреса Channex внутри сообщения: по ним экран подписывает категорию и тариф именами */
  roomTypeIds: string[];
  ratePlanIds: string[];
}
export interface EventsQuery {
  limit: number;
  offset: number;
  status?: string | undefined;
  type?: string | undefined;
  /** номер брони PMS или unique_id канала, подстрокой */
  q?: string | undefined;
}
export interface InboundEventListRow extends InboundEventRow {
  uniqueId: string | null;
  otaName: string | null;
  /** бронь PMS, связанная с ревизией по externalId = unique_id (ADR-024) */
  confirmationNumber: string | null;
}
export type OutboxStatus = 'PENDING' | 'SENT' | 'FAILED';
export interface OutboxListRow {
  id: string;
  kind: OutboxKind;
  payload: unknown;
  status: OutboxStatus;
  attempts: number;
  taskId: string | null;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
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
    assertPropertyVisible(p);
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
    const p = { id: await propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name) };
    await this.prisma.db.auditLog.create({
      data: {
        userId: auditUserId(),
        entityType: 'Property',
        entityId: p.id,
        action,
        after: JSON.parse(JSON.stringify(after)),
      },
    });
  }
  async categoryUnits(): Promise<Array<{ code: string; active: number; capacityAdults: number }>> {
    const p = { id: await propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name) };
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
  async markOutboxSent(
    ids: string[],
    taskId: string | null,
    warning?: string | null,
  ): Promise<void> {
    await this.prisma.db.channelOutbox.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'SENT',
        taskId,
        sentAt: new Date(),
        lastError: warning ? warning.slice(0, 1000) : null,
      },
    });
  }
  withClient(db: unknown): ChannelsRepository {
    // клиент транзакции Prisma вместо общего: те же запросы, но в транзакции вызывающей команды
    return new PrismaChannelsRepository({ db } as unknown as PrismaService);
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
    const p = { id: await propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name) };
    const rows = await this.prisma.db.ratePlan.findMany({
      where: { propertyId: p.id },
      select: { code: true, id: true },
    });
    return Object.fromEntries(rows.map((r) => [r.code, r.id]));
  }
  async lastEventAt(
    provider: string,
    via: 'WEBHOOK' | 'PULL' | 'MANUAL',
    typePrefix?: string,
  ): Promise<Date | null> {
    const row = await this.prisma.db.externalEvent.findFirst({
      where: {
        provider,
        receivedVia: via,
        ...(typePrefix ? { type: { startsWith: typePrefix } } : {}),
      },
      orderBy: { receivedAt: 'desc' },
      select: { receivedAt: true },
    });
    return row?.receivedAt ?? null;
  }
  async lastAuditAt(action: string): Promise<Date | null> {
    const row = await this.prisma.db.auditLog.findFirst({
      where: { action },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  }
  /**
   * Журнал входящих. Из снимка ревизии наружу едет только `unique_id`: сам снимок — это вся бронь
   * с проживаниями, и тянуть его ради одного поля незачем (волна 4). По `unique_id` подставляется
   * номер брони PMS — на экране от ревизии сразу открывается бронь (срез 7.2).
   */
  async recentEvents(provider: string, limit: number): Promise<InboundEventRow[]> {
    const rows = await this.prisma.db.$queryRaw<
      Array<{
        external_event_id: string;
        type: string;
        status: string;
        attempt_count: number;
        received_via: 'WEBHOOK' | 'PULL' | 'MANUAL';
        received_at: Date;
        processed_at: Date | null;
        last_error: string | null;
        unique_id: string | null;
      }>
    >(Prisma.sql`
      SELECT external_event_id, type, status::text AS status, attempt_count,
             received_via::text AS received_via, received_at, processed_at, last_error,
             CASE WHEN jsonb_typeof(payload) = 'object' THEN payload->>'unique_id' END AS unique_id
        FROM external_events
       WHERE provider = ${provider}
       ORDER BY received_at DESC
       LIMIT ${limit}
    `);
    const uniqueIds = [...new Set(rows.map((r) => r.unique_id).filter((x): x is string => !!x))];
    const numbers = uniqueIds.length
      ? await this.prisma.db.reservation.findMany({
          where: { externalId: { in: uniqueIds } },
          select: { externalId: true, confirmationNumber: true },
        })
      : [];
    const byExternalId = new Map(numbers.map((r) => [r.externalId, r.confirmationNumber]));
    return rows.map((r) => ({
      externalEventId: r.external_event_id,
      type: r.type,
      status: r.status,
      attempts: r.attempt_count,
      receivedVia: r.received_via,
      receivedAt: r.received_at.toISOString(),
      processedAt: r.processed_at?.toISOString() ?? null,
      lastError: r.last_error,
      reservationNumber: (r.unique_id && byExternalId.get(r.unique_id)) ?? null,
    }));
  }
  /**
   * Строки очереди ARI. Сводка по payload считается здесь: наружу едут числа и даты, а не сами
   * значения — сообщение полной выгрузки содержит тысячи строк.
   */
  async recentOutbox(provider: string, limit: number): Promise<OutboxMessageRow[]> {
    const rows = await this.prisma.db.channelOutbox.findMany({
      where: { provider },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => {
      const values = Array.isArray(r.payload) ? (r.payload as Array<Record<string, unknown>>) : [];
      const str = (v: unknown) => (typeof v === 'string' ? v : null);
      const dates = values.flatMap((v) => [str(v['date_from']), str(v['date_to'])].filter(Boolean));
      const ids = (key: string) => [
        ...new Set(values.map((v) => str(v[key])).filter((x): x is string => !!x)),
      ];
      return {
        id: r.id,
        kind: r.kind,
        status: r.status,
        attempts: r.attempts,
        taskId: r.taskId,
        lastError: r.lastError,
        createdAt: r.createdAt.toISOString(),
        sentAt: r.sentAt?.toISOString() ?? null,
        lines: values.length,
        dateFrom: dates.length ? (dates as string[]).reduce((a, b) => (a < b ? a : b)) : null,
        dateTo: dates.length ? (dates as string[]).reduce((a, b) => (a > b ? a : b)) : null,
        roomTypeIds: ids('room_type_id'),
        ratePlanIds: ids('rate_plan_id'),
      };
    });
  }

  async eventsPage(
    provider: string,
    q: EventsQuery,
  ): Promise<{ rows: InboundEventListRow[]; total: number }> {
    const needle = q.q?.trim();
    // Поиск по номеру брони PMS: номер → externalId брони → unique_id ревизии (payload)
    const byNumber = needle
      ? await this.prisma.db.reservation.findMany({
          where: {
            property: { name: LUXX_APARTS_PROPERTY.name },
            externalId: { not: null },
            OR: [
              { confirmationNumber: { contains: needle } },
              { externalId: { contains: needle } },
            ],
          },
          select: { externalId: true },
          take: 50,
        })
      : [];
    const externalIds = byNumber.map((r) => r.externalId).filter((x): x is string => !!x);
    const where = {
      provider,
      ...(q.status
        ? { status: q.status as 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' }
        : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(needle
        ? {
            OR: [
              { externalEventId: { contains: needle } },
              { payload: { path: ['unique_id'], string_contains: needle } },
              ...externalIds.map((id) => ({ payload: { path: ['unique_id'], equals: id } })),
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.db.externalEvent.count({ where }),
      this.prisma.db.externalEvent.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip: q.offset,
        take: q.limit,
        select: {
          externalEventId: true,
          type: true,
          status: true,
          attemptCount: true,
          receivedVia: true,
          receivedAt: true,
          processedAt: true,
          lastError: true,
          payload: true,
        },
      }),
    ]);
    const facts = rows.map((r) => {
      const p =
        r.payload && typeof r.payload === 'object' ? (r.payload as Record<string, unknown>) : {};
      return {
        uniqueId: typeof p['unique_id'] === 'string' ? (p['unique_id'] as string) : null,
        otaName: typeof p['ota_name'] === 'string' ? (p['ota_name'] as string) : null,
      };
    });
    const ids = [...new Set(facts.map((f) => f.uniqueId).filter((x): x is string => !!x))];
    const linked = ids.length
      ? await this.prisma.db.reservation.findMany({
          where: { property: { name: LUXX_APARTS_PROPERTY.name }, externalId: { in: ids } },
          select: { externalId: true, confirmationNumber: true },
        })
      : [];
    const numberByExternal = new Map(linked.map((r) => [r.externalId, r.confirmationNumber]));
    return {
      total,
      rows: rows.map((r, i) => ({
        externalEventId: r.externalEventId,
        type: r.type,
        status: r.status,
        attempts: r.attemptCount,
        receivedVia: r.receivedVia,
        receivedAt: r.receivedAt.toISOString(),
        processedAt: r.processedAt?.toISOString() ?? null,
        lastError: r.lastError,
        uniqueId: facts[i]!.uniqueId,
        otaName: facts[i]!.otaName,
        reservationNumber: facts[i]!.uniqueId
          ? (numberByExternal.get(facts[i]!.uniqueId) ?? null)
          : null,
        confirmationNumber: facts[i]!.uniqueId
          ? (numberByExternal.get(facts[i]!.uniqueId) ?? null)
          : null,
      })),
    };
  }
  async eventByRevision(provider: string, revisionId: string) {
    const r = await this.prisma.db.externalEvent.findUnique({
      where: { provider_externalEventId: { provider, externalEventId: revisionId } },
    });
    if (!r) return null;
    return {
      externalEventId: r.externalEventId,
      type: r.type,
      status: r.status,
      attempts: r.attemptCount,
      receivedVia: r.receivedVia,
      receivedAt: r.receivedAt.toISOString(),
      processedAt: r.processedAt?.toISOString() ?? null,
      lastError: r.lastError,
      payload: r.payload,
      reservationNumber: null,
    };
  }
  async reservationCardByExternalId(externalId: string) {
    const property = await this.prisma.db.property.findFirstOrThrow({
      where: { name: LUXX_APARTS_PROPERTY.name },
      select: { id: true, name: true, organizationId: true },
    });
    assertPropertyVisible(property);
    const r = await this.prisma.db.reservation.findFirst({
      where: { propertyId: property.id, externalId },
      select: { confirmationNumber: true },
    });
    if (!r) return null;
    const card = await loadReservationCard(this.prisma.db, property.id, r.confirmationNumber);
    if (!card) return null;
    const items = await this.prisma.db.reservationItem.findMany({
      where: { reservation: { propertyId: property.id, confirmationNumber: r.confirmationNumber } },
      select: {
        id: true,
        reservation: { select: { source: true, channel: true } },
        folio: {
          select: {
            charges: { select: { amount: true, voidedAt: true } },
            allocations: { select: { amount: true } },
            refunds: { select: { amount: true } },
          },
        },
      },
    });
    const balances: Record<string, string> = {};
    for (const it of items) {
      const b = stayFacts(it).balanceMinor;
      if (b !== undefined) balances[it.id] = b;
    }
    return { card, balances };
  }
  async outboxRows(
    provider: string,
    q: { status?: OutboxStatus | undefined; limit: number },
  ): Promise<OutboxListRow[]> {
    const rows = await this.prisma.db.channelOutbox.findMany({
      where: { provider, ...(q.status ? { status: q.status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: q.limit,
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      payload: r.payload,
      status: r.status,
      attempts: r.attempts,
      taskId: r.taskId,
      lastError: r.lastError,
      createdAt: r.createdAt.toISOString(),
      sentAt: r.sentAt?.toISOString() ?? null,
    }));
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
  // Остатки и ограничения — только через выключатель ARI (Q-126, ADR-041)
  return guardAriGateway(new channex.ChannexClient(baseUrl ? { apiKey, baseUrl } : { apiKey }));
}
