import 'reflect-metadata';
import { createHash } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { channex } from '@pms/integrations';
import type { ReservationStatus } from '@pms/domain';
import {
  AllocationOverlapError,
  RESERVATIONS_UOW,
  type ChannelMappingRef,
  type NewReservation,
  type ReservationsRepository,
  type UnitOfWork,
} from '../reservations/reservations.repository';
import { ARI_PUBLISHER, type AriPublisher } from './ari-publisher';
import { CHANNEX_GATEWAY, type ChannexGateway } from './channels.repository';
import { PROVIDER } from './sync.service';

export interface RevisionOutcome {
  revisionId: string;
  uniqueId: string;
  status: channex.ChannexBookingRevisionAttributes['status'];
  result: 'created' | 'modified' | 'cancelled' | 'skipped_duplicate' | 'failed';
  confirmationNumber: string | null;
  error?: string;
  warnings: string[];
  /** Затронутые категории и ночи — для дельты доступности */
  affected?: { categoryCodes: string[]; from: string; toExclusive: string };
}
export interface PullResult {
  received: number;
  outcomes: RevisionOutcome[];
  acknowledged: number;
}

/** Ревизия целиком, кроме `guarantee` (данные карты — не хранить, SECURITY.md §4) и `services` мусора. */
export function sanitizeRevision(
  attrs: channex.ChannexBookingRevisionAttributes,
): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...attrs };
  delete copy['guarantee'];
  return copy;
}

/** "153.00" → 15300n без float. */
export function decimalToMinor(value: string, where: string): bigint {
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim());
  if (!m) throw new Error(`${where}: сумма «${value}» не десятичное число`);
  const minor = BigInt(m[2]!) * 100n + BigInt((m[3] ?? '').padEnd(2, '0'));
  return m[1] ? -minor : minor;
}

class UnmappedRoomError extends Error {
  override readonly name = 'UnmappedRoomError';
}

function payloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** Периодический опрос ленты ревизий — страховка, если webhook не дошёл (туннель, сеть, простой PMS). */
export const DEFAULT_PULL_INTERVAL_MS = 5 * 60_000;

@Injectable()
export class InboundBookingsService implements OnModuleInit, OnModuleDestroy {
  private pullTimer: NodeJS.Timeout | undefined;
  private pulling = false;
  /** Фоновый опрос только в живом процессе с ключом; в тестах (NODE_ENV=test) и без ключа — выключен. */
  onModuleInit(): void {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.CHANNEX_PULL === 'off' ||
      !process.env.CHANNEX_API_KEY?.trim()
    )
      return;
    const every = Number(process.env.CHANNEX_PULL_INTERVAL_MS) || DEFAULT_PULL_INTERVAL_MS;
    this.pullTimer = setInterval(() => void this.scheduledPull(), every);
    this.pullTimer.unref();
  }
  onModuleDestroy(): void {
    if (this.pullTimer) clearInterval(this.pullTimer);
  }
  private async scheduledPull(): Promise<void> {
    if (this.pulling) return;
    this.pulling = true;
    try {
      const r = await this.pull();
      if (r.received > 0)
        this.log.log(`опрос ленты: получено ${r.received}, подтверждено ${r.acknowledged}`);
    } catch (e) {
      this.log.warn(`опрос ленты Channex не удался: ${(e as Error).message}`);
    } finally {
      this.pulling = false;
    }
  }

  constructor(
    @Inject(CHANNEX_GATEWAY) private readonly gateway: ChannexGateway,
    @Inject(RESERVATIONS_UOW) private readonly uow: UnitOfWork,
    @Inject(ARI_PUBLISHER) private readonly publisher: AriPublisher,
  ) {}

  /** Webhook Channex (webhook-collection.md): общий секрет в заголовке, затем pull ревизии по ID. */
  /** Очередь фоновой обработки webhook: по одному, в порядке прихода. Тесты ждут через drain(). */
  private queue: Promise<void> = Promise.resolve();
  private readonly log = new Logger(InboundBookingsService.name);
  drain(): Promise<void> {
    return this.queue;
  }

  /**
   * Webhook Channex: проверяем секрет и форму, отвечаем сразу (webhook-collection.md: событие — сигнал
   * забрать ревизию; Channex повторяет только 5xx, а туннели/прокси рвут долгие ответы), обработку ставим в очередь.
   * Ошибка обработки — в журнал; ревизия остаётся неподтверждённой в ленте, её доберёт pull.
   */
  async handleWebhook(
    secretHeader: string | undefined,
    body: { event?: string; payload?: unknown; property_id?: string; timestamp?: string },
  ): Promise<{ ok: true; accepted: true }> {
    const expected = process.env.CHANNEX_WEBHOOK_SECRET?.trim();
    if (!expected)
      throw new ServiceUnavailableException(
        'CHANNEX_WEBHOOK_SECRET не задан в .env — webhook отклонён',
      );
    if (!secretHeader || secretHeader !== expected)
      throw new UnauthorizedException('Неверный секрет webhook');
    if (!body || typeof body.event !== 'string') throw new BadRequestException('Нет поля event');
    if (body.event.startsWith('booking')) {
      const p = body.payload as { revision_id?: string } | undefined;
      if (!p?.revision_id) throw new BadRequestException('Нет payload.revision_id');
    }
    const event = body.event;
    const run = () =>
      this.processWebhookEvent(body).catch((e) =>
        this.log.error(`webhook ${event}: ${(e as Error).message}`),
      );
    this.queue = this.queue.then(run, run);
    return { ok: true, accepted: true };
  }

  private async processWebhookEvent(body: {
    event?: string;
    payload?: unknown;
    property_id?: string;
    timestamp?: string;
  }): Promise<void> {
    if (body.event!.startsWith('booking')) {
      const p = body.payload as { revision_id: string };
      const rev = await this.fetchRevision(p.revision_id);
      await this.processRevision(rev);
      return;
    }
    // Остальные события журналируем и считаем обработанными (sync_error и т.п. — для человека)
    await this.uow.run(async (repo) => {
      const ev = await repo.recordExternalEvent({
        provider: PROVIDER,
        externalEventId: `${body.event}:${body.timestamp ?? Date.now()}:${payloadHash(body.payload).slice(0, 12)}`,
        type: body.event!,
        payloadHash: payloadHash(body.payload),
        payload: body.payload,
      });
      if (ev.isNew)
        await repo.updateExternalEvent(ev.id, {
          status: 'PROCESSED',
          processedAt: new Date(),
          countAttempt: true,
        });
    });
  }

  /**
   * Q-094 (умолчание как в Exely, 1043 из 1044 броней августа назначены сразу): бронь канала получает первую
   * свободную ячейку своей категории на весь период; свободной нет — остаётся без ячейки, стойка назначает вручную.
   */
  private async autoAssign(
    repo: ReservationsRepository,
    itemId: string,
    item: { accommodationTypeId: string; arrivalDate: string; departureDate: string },
    uniqueId: string,
    warnings: string[],
  ): Promise<boolean> {
    const unit = await repo.firstFreeUnit(
      item.accommodationTypeId,
      item.arrivalDate,
      item.departureDate,
    );
    if (!unit) {
      warnings.push(
        `Бронь ${uniqueId}: свободной ячейки категории на ${item.arrivalDate} → ${item.departureDate} нет — без ячейки`,
      );
      return false;
    }
    try {
      await repo.createAllocation(itemId, unit.id, item.arrivalDate, item.departureDate);
      return true;
    } catch (e) {
      if (e instanceof AllocationOverlapError) {
        warnings.push(`Бронь ${uniqueId}: ячейка ${unit.code} занята (гонка) — без ячейки`);
        return false;
      }
      throw e;
    }
  }

  /** Лента неподтверждённых ревизий → обработка каждой → ack. Работает и без публичного webhook. */
  async pull(propertyId?: string): Promise<PullResult> {
    const feed = await this.viaChannex(() => this.gateway.bookingRevisionsFeed(propertyId));
    const outcomes: RevisionOutcome[] = [];
    let acknowledged = 0;
    for (const rev of feed) {
      const o = await this.processRevision(rev);
      outcomes.push(o);
      if (o.result !== 'failed') acknowledged += 1;
    }
    return { received: feed.length, outcomes, acknowledged };
  }

  private fetchRevision(id: string) {
    return this.viaChannex(() => this.gateway.getBookingRevision(id));
  }

  private async viaChannex<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof channex.ChannexApiError) {
        if (e.status === 503 && e.message.includes('CHANNEX_API_KEY'))
          throw new ServiceUnavailableException(e.message);
        throw new BadGatewayException(e.message);
      }
      throw e;
    }
  }

  /**
   * Одна ревизия = одна транзакция: журнал (UNIQUE provider+revision, ADR-007) → бронь → PROCESSED; ack после коммита.
   * Повтор той же ревизии — ничего не меняет, но ack повторяется (Channex мог не получить первый).
   */
  async processRevision(
    rev: channex.ChannexResource<channex.ChannexBookingRevisionAttributes>,
  ): Promise<RevisionOutcome> {
    const a = rev.attributes;
    const sanitized = sanitizeRevision(a);
    const base = {
      revisionId: rev.id,
      uniqueId: a.unique_id,
      status: a.status,
      warnings: [] as string[],
    };
    // Транзакция 1: журнал. UNIQUE(provider, revision) делает повтор безопасным (ADR-007).
    const ev = await this.uow.run((repo) =>
      repo.recordExternalEvent({
        provider: PROVIDER,
        externalEventId: rev.id,
        type: `booking_${a.status}`,
        payloadHash: payloadHash(sanitized),
        payload: sanitized,
      }),
    );
    let outcome: RevisionOutcome;
    if (ev.status === 'PROCESSED') {
      const existing = await this.uow.run((repo) => repo.reservationByExternalId(a.unique_id));
      outcome = {
        ...base,
        result: 'skipped_duplicate',
        confirmationNumber: existing?.confirmationNumber ?? null,
      };
    } else {
      try {
        // Транзакция 2: бронь + PROCESSED. Любая ошибка откатывает её целиком.
        const r = await this.uow.run(async (repo) => {
          await repo.updateExternalEvent(ev.id, { status: 'PROCESSING', countAttempt: true });
          const mappings = await repo.channelMappings(PROVIDER);
          const applied = await this.apply(repo, a, mappings, base.warnings);
          await repo.updateExternalEvent(ev.id, {
            status: 'PROCESSED',
            lastError: null,
            processedAt: new Date(),
          });
          return applied;
        });
        outcome = { ...base, ...r };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // Транзакция 3: FAILED пишется отдельно — внутри прерванной транзакции Postgres это невозможно (25P02).
        await this.uow.run((repo) =>
          repo.updateExternalEvent(ev.id, { status: 'FAILED', lastError: message }),
        );
        if (e instanceof UnmappedRoomError)
          return { ...base, result: 'failed', confirmationNumber: null, error: message };
        throw e;
      }
    }
    if (outcome.result !== 'failed')
      await this.viaChannex(() => this.gateway.ackBookingRevision(rev.id));
    if (outcome.affected && outcome.affected.categoryCodes.length) {
      // Дельта доступности: категории и ночи ревизии (плюс прежние даты, если бронь уже была)
      await this.publisher.reservationChanged({
        categoryCodes: [...new Set(outcome.affected.categoryCodes)],
        from: outcome.affected.from,
        toExclusive: outcome.affected.toExclusive,
      });
    }
    return outcome;
  }

  private async apply(
    repo: ReservationsRepository,
    a: channex.ChannexBookingRevisionAttributes,
    mappings: ChannelMappingRef[],
    warnings: string[],
  ): Promise<Pick<RevisionOutcome, 'result' | 'confirmationNumber' | 'affected'>> {
    // Порядок поиска важен для переезда с Exely (CUTOVER §1, Q-034):
    // 1) unique_id — брони, которые PMS уже приняла от Channex;
    // 2) ota_reservation_code — брони, перенесённые из Exely: у них externalId — номер брони НА СТОРОНЕ КАНАЛА,
    //    а unique_id Channex мы никогда не видели. Без этого шага модификация создала бы дубль с второй ячейкой,
    //    а отмена не нашла бы бронь и оставила бы койку занятой;
    // 3) номер подтверждения — брони, созданные до заполнения externalId.
    // Найденной по каналу броне externalId переписывается на unique_id ниже, поэтому шаг 2 нужен один раз.
    const existing =
      (await repo.reservationByExternalId(a.unique_id)) ??
      (a.ota_reservation_code
        ? await repo.reservationByExternalId(a.ota_reservation_code)
        : null) ??
      (await repo.reservationByNumber(a.unique_id));
    const codeById = new Map(
      mappings
        .filter((m) => m.localAccommodationTypeId && m.localAccommodationTypeCode)
        .map((m) => [m.localAccommodationTypeId!, m.localAccommodationTypeCode!]),
    );
    type Span = { accommodationTypeId: string; arrivalDate: string; departureDate: string };
    const affectedOf = (its: Span[]) => ({
      categoryCodes: its.map((i) => codeById.get(i.accommodationTypeId) ?? i.accommodationTypeId),
      from: its.reduce(
        (m, i) => (i.arrivalDate < m ? i.arrivalDate : m),
        its[0]?.arrivalDate ?? a.arrival_date,
      ),
      toExclusive: its.reduce(
        (m, i) => (i.departureDate > m ? i.departureDate : m),
        its[0]?.departureDate ?? a.departure_date,
      ),
    });
    if (a.status === 'cancelled') {
      if (!existing) {
        warnings.push(`Отмена ${a.unique_id}: брони нет в PMS — записана только в журнал`);
        return { result: 'cancelled', confirmationNumber: null };
      }
      for (const item of existing.items) {
        for (const al of item.allocations) await repo.deleteAllocation(al.id);
        if (item.status !== 'CANCELLED') await repo.updateItem(item.id, { status: 'CANCELLED' });
      }
      await repo.updateReservation(existing.id, { status: 'CANCELLED' });
      await repo.audit({
        entityType: 'Reservation',
        entityId: existing.id,
        action: 'channex.booking.cancelled',
        after: { uniqueId: a.unique_id },
      });
      return {
        result: 'cancelled',
        confirmationNumber: existing.confirmationNumber,
        affected: affectedOf(existing.items),
      };
    }

    const items = a.rooms.map((room, i) => {
      const map = room.room_type_id
        ? mappings.find(
            (m) => m.providerRoomTypeId === room.room_type_id && m.localAccommodationTypeId,
          )
        : undefined;
      if (!map)
        throw new UnmappedRoomError(
          `Комната ${i + 1} брони ${a.unique_id}: room_type_id ${room.room_type_id ?? 'null'} не сопоставлен с категорией (booking_unmapped_room)`,
        );
      return {
        accommodationTypeId: map.localAccommodationTypeId!,
        // Тариф и гости на проживании (Q-102): тариф — из маппинга канала, гости — из occupancy комнаты
        ratePlanId: map.localRatePlanId,
        adults: room.occupancy?.adults ?? 1,
        children: room.occupancy?.children ?? 0,
        arrivalDate: room.checkin_date,
        departureDate: room.checkout_date,
        priceMinor: decimalToMinor(room.amount, `бронь ${a.unique_id}, комната ${i + 1}`),
        status: 'CONFIRMED' as ReservationStatus,
      };
    });
    const header = {
      arrivalDate: a.arrival_date,
      departureDate: a.departure_date,
      totalAmountMinor: decimalToMinor(a.amount, `бронь ${a.unique_id}`),
    };

    if (!existing) {
      const guestId = await repo.createGuest({
        firstName: (a.customer?.name ?? '').trim() || 'Гость',
        lastName: (a.customer?.surname ?? '').trim() || a.ota_name,
        phone: a.customer?.phone ?? null,
        email: a.customer?.mail ?? null,
      });
      const created = await repo.createReservation({
        confirmationNumber: a.unique_id,
        source: 'OTA',
        channel: a.ota_name,
        externalId: a.unique_id,
        status: 'CONFIRMED',
        ...header,
        adults: a.occupancy?.adults ?? items.length,
        children: a.occupancy?.children ?? 0,
        currency: a.currency,
        primaryGuestId: guestId,
        notes: a.notes ?? null,
        items,
      } satisfies NewReservation);
      for (const [i, itemId] of created.itemIds.entries()) {
        await repo.addStayGuest(itemId, guestId, true);
        await this.autoAssign(repo, itemId, items[i]!, a.unique_id, warnings);
      }
      await repo.audit({
        entityType: 'Reservation',
        entityId: created.id,
        action: 'channex.booking.new',
        after: await repo.card(a.unique_id),
      });
      return { result: 'created', confirmationNumber: a.unique_id, affected: affectedOf(items) };
    }

    // modified (или повторный new для уже известной брони)
    const before = await repo.card(existing.confirmationNumber);
    const live = existing.items.filter((i) => i.status !== 'CANCELLED');
    if (live.length === items.length) {
      for (const [i, item] of live.entries()) {
        const next = items[i]!;
        const datesChanged =
          item.arrivalDate !== next.arrivalDate || item.departureDate !== next.departureDate;
        await repo.updateItem(item.id, {
          arrivalDate: next.arrivalDate,
          departureDate: next.departureDate,
          priceMinor: next.priceMinor,
          status: 'CONFIRMED',
        });
        if (datesChanged) {
          for (const al of item.allocations) {
            try {
              await repo.replaceAllocationDates(al.id, next.arrivalDate, next.departureDate);
            } catch {
              await repo.deleteAllocation(al.id);
              const moved = await this.autoAssign(repo, item.id, next, a.unique_id, warnings);
              if (!moved)
                warnings.push(
                  `Бронь ${a.unique_id}: ячейка ${al.unitCode} занята на новые даты — назначение снято, свободной ячейки нет`,
                );
            }
          }
        }
      }
    } else {
      for (const item of live) {
        for (const al of item.allocations) await repo.deleteAllocation(al.id);
        await repo.updateItem(item.id, { status: 'CANCELLED' });
      }
      for (const next of items) {
        const itemId = await repo.addReservationItem(existing.id, next);
        await this.autoAssign(repo, itemId, next, a.unique_id, warnings);
      }
      warnings.push(
        `Бронь ${a.unique_id}: состав комнат изменился (${live.length} → ${items.length}) — назначения сняты`,
      );
    }
    await repo.updateReservation(existing.id, {
      ...header,
      status: 'CONFIRMED',
      externalId: a.unique_id,
      channel: a.ota_name,
      notes: a.notes ?? null,
    });
    await repo.audit({
      entityType: 'Reservation',
      entityId: existing.id,
      action: 'channex.booking.modified',
      before,
      after: await repo.card(existing.confirmationNumber),
    });
    return {
      result: 'modified',
      confirmationNumber: existing.confirmationNumber,
      affected: affectedOf([...existing.items, ...items]),
    };
  }
}
