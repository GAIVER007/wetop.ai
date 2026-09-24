import 'reflect-metadata';
import { freeTextForStorage, guestForStorage, realPiiAllowed } from '@pms/shared';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { channex } from '@pms/integrations';
import { gatewayFailure } from './gateway-failure';
import {
  matchImportedReservation,
  penaltyAmount,
  penaltyDue,
  redactText,
  sameStaySet,
  type ReservationStatus,
} from '@pms/domain';
import {
  AllocationOverlapError,
  RESERVATIONS_UOW,
  type ChannelMappingRef,
  type ExternalEventVia,
  type NewReservation,
  type ReservationState,
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
  /** `linked` — ревизия сопоставлена с перенесённой из Exely бронью (ADR-024), новой брони нет */
  result: 'created' | 'linked' | 'modified' | 'cancelled' | 'skipped_duplicate' | 'failed';
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

/** Сколько раз пробуем разобрать одну ревизию, прежде чем позвать человека (у исходящих — столько же) */
export const MAX_INBOUND_ATTEMPTS = 6;

/** Метка броней автотестов в заметке (ставят сами тесты, снимает `cli-e2e-cleanup.ts`) — с ними ревизии не сопоставляются */
const E2E_NOTE = 'E2E-АВТОТЕСТ';

/** Верхние поля ревизии, которые хранит журнал событий, пока база не в РК: номера, даты, суммы, занятость, канал */
const REVISION_KEEP = [
  'id',
  'property_id',
  'booking_id',
  'unique_id',
  'system_id',
  'revision_id',
  'ota_reservation_code',
  'ota_name',
  'status',
  'occupancy',
  'arrival_date',
  'departure_date',
  'arrival_hour',
  'amount',
  'currency',
  'ota_commission',
  'payment_collect',
  'payment_type',
  'inserted_at',
  'services',
  'channel_id',
  'secondary_ota',
  'acknowledge_status',
  'has_unacked_revisions',
  'is_crs_revision',
] as const;
/** Поля номера брони: без `guests` (имена) и `meta` (пожелания и заметки к номеру) */
const ROOM_KEEP = [
  'booking_room_id',
  'checkin_date',
  'checkout_date',
  'rate_plan_id',
  'room_type_id',
  'occupancy',
  'amount',
  'days',
  'ota_unique_id',
  'is_cancelled',
] as const;

const pick = (src: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(keys.filter((k) => k in src).map((k) => [k, src[k]]));

/**
 * Данные карты не хранятся нигде и никогда (SECURITY.md §1) — и в копии брони внутри другого события тоже.
 * `raw_message` — исходное сообщение канала (bookings-collection.md): в нём та же бронь как её прислала площадка,
 * вместе с гостем и, возможно, картой, поэтому оно не хранится и в РК.
 */
const NEVER_STORED = new Set(['guarantee', 'raw_message']);
function withoutCard(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutCard);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([k]) => !NEVER_STORED.has(k))
      .map(([k, v]) => [k, withoutCard(v)]),
  );
}

/**
 * Что из ревизии ложится в `external_events.payload`. Карта (`guarantee`) — никогда. Пока база не в РК
 * (PII_STORAGE ≠ real, ADR-018, SECURITY.md §2) — только номера, даты, суммы, занятость и канал: без заказчика
 * (кроме страны), имён гостей, заметки и `meta` номеров. Экран «Приём брони» и поиск читают только эти поля
 * (`revision-facts.ts`), а повтор забирает ревизию из Channex заново (`retryEvent`). Список разрешённый, а не
 * запретный: новое поле Channex в журнал не попадёт, пока его сюда не впишут.
 */
export function sanitizeRevision(
  attrs: channex.ChannexBookingRevisionAttributes,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  if (realPiiAllowed(env)) return withoutCard({ ...attrs }) as Record<string, unknown>;
  const copy = pick(attrs, REVISION_KEEP);
  if (attrs.customer && typeof attrs.customer === 'object')
    copy['customer'] = pick(attrs.customer as Record<string, unknown>, ['country']);
  copy['rooms'] = (Array.isArray(attrs.rooms) ? attrs.rooms : [])
    .filter((r): r is channex.ChannexBookingRoom => !!r && typeof r === 'object')
    .map((r) => pick(r, ROOM_KEEP));
  return withoutCard(copy) as Record<string, unknown>;
}

/** Поля событий не о брони, в которых нет гостя: канал и тип ошибки у `sync_error`, решённость запроса */
const EVENT_SAFE_KEYS = new Set(['channel', 'channel_name', 'error_type', 'resolved', 'status']);

/**
 * Событие не о брони. У `message` в теле текст гостя, у `review` — отзыв и имя, у `reservation_request` — копия брони
 * вместе с картой. Пока база не в РК — только идентификаторы (`*_id`) и поля из `EVENT_SAFE_KEYS`, остальные ключи
 * перечислены в `omitted`, чтобы было видно, что пришло. Карта не хранится и в РК.
 */
export function sanitizeWebhookPayload(
  payload: unknown,
  env: NodeJS.ProcessEnv = process.env,
): unknown {
  if (realPiiAllowed(env)) return withoutCard(payload ?? null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return payload === undefined || payload === null ? null : { omitted: ['payload'] };
  const kept: Record<string, unknown> = {};
  const omitted: string[] = [];
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    const scalar = v === null || ['string', 'number', 'boolean'].includes(typeof v);
    if (scalar && (k === 'id' || k.endsWith('_id') || EVENT_SAFE_KEYS.has(k))) kept[k] = v;
    else omitted.push(k);
  }
  if (omitted.length) kept['omitted'] = omitted.sort();
  return kept;
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
/**
 * ADR-024: ревизию нельзя ни связать с перенесённой бронью, ни создать без риска дубля — PMS не выбирает сама.
 * Событие остаётся FAILED с объяснением (видно на /channels, кнопка «Обработать заново»), ревизия не
 * подтверждается, бронь не создаётся и ячейку не занимает; перенесённая копия брони в PMS уже есть.
 */
class ImportLinkAmbiguousError extends Error {
  override readonly name = 'ImportLinkAmbiguousError';
}

function payloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** Периодический опрос ленты ревизий — страховка, если webhook не дошёл (туннель, сеть, простой PMS). */
export const DEFAULT_PULL_INTERVAL_MS = 5 * 60_000;

/** Секрет webhook: длина сравнивается отдельно, содержимое — timingSafeEqual */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

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
      this.log.warn(`опрос ленты Channex не удался: ${redactText((e as Error).message, 1000)}`);
    } finally {
      this.pulling = false;
    }
  }

  constructor(
    @Inject(CHANNEX_GATEWAY) private readonly gateway: ChannexGateway,
    @Inject(RESERVATIONS_UOW) private readonly uow: UnitOfWork,
    @Inject(ARI_PUBLISHER) private readonly publisher: AriPublisher,
  ) {}

  /**
   * Webhook Channex (webhook-collection.md): общий секрет в заголовке, затем чтение ленты неподтверждённых ревизий
   * своего объекта (bookings-collection.md, «Booking Revisions Feed» — «primary way to get bookings»). Ревизию по ID
   * и список ревизий PMS не читает: 24.09.2026 Channex не принял сценарий 11 сертификации — «bookings must be received
   * via webhook/feed, not list-polling or by-id fetching» (reports/channex-cert-review-2026-09-24.md).
   */
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
    // Адрес webhook публичный (api.wetop.ai): сравнение за постоянное время не выдаёт секрет по времени ответа
    if (!secretHeader || !sameSecret(secretHeader, expected))
      throw new UnauthorizedException('Неверный секрет webhook');
    if (!body || typeof body.event !== 'string') throw new BadRequestException('Нет поля event');
    if (body.event.startsWith('booking')) {
      const p = body.payload as { revision_id?: string } | undefined;
      if (!p?.revision_id) throw new BadRequestException('Нет payload.revision_id');
    }
    const event = body.event;
    const run = () =>
      this.processWebhookEvent(body).catch((e) =>
        this.log.error(`webhook ${event}: ${redactText((e as Error).message, 1000)}`),
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
      // Событие — сигнал забрать ревизию: читаем ленту своего объекта целиком (в ней и эта ревизия, и всё, что
      // не подтвердилось раньше), разбираем по порядку inserted_at и подтверждаем каждую разобранную
      const p = body.payload as { property_id?: string } | undefined;
      await this.pull(body.property_id ?? p?.property_id, 'WEBHOOK');
      return;
    }
    // Остальные события журналируем и считаем обработанными (sync_error и т.п. — для человека)
    const stored = sanitizeWebhookPayload(body.payload);
    await this.uow.run(async (repo) => {
      const ev = await repo.recordExternalEvent({
        provider: PROVIDER,
        externalEventId: `${body.event}:${body.timestamp ?? Date.now()}:${payloadHash(body.payload).slice(0, 12)}`,
        type: body.event!,
        payloadHash: payloadHash(stored),
        payload: stored,
        receivedVia: 'WEBHOOK',
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
   * Предоплата канала (Q-086). Channex сообщает, кто собрал деньги: `payment_collect = 'ota'` значит,
   * что гость уже заплатил площадке, а отель получит их перечислением. Тогда на стойке гость ничего
   * не должен, и счёт закрывается платежом EXTERNAL. Иначе счёт остаётся к оплате при заселении.
   *
   * Основание: за август 4,97 млн ₸ «неоплаченных» — это почти целиком Trip.com, Agoda, Expedia
   * и Островок, где предоплата есть, а Exely её к проживанию не привязывал. Booking, где предоплаты
   * нет, оплачен на 99% — деньги берут на месте. То есть это не долг гостей.
   */
  private async recordPrepayment(
    repo: ReservationsRepository,
    itemId: string,
    index: number,
    a: channex.ChannexBookingRevisionAttributes,
    amountMinor: bigint,
  ): Promise<void> {
    const reference = `channex:${a.unique_id}:${index}`;
    // Ревизия может отменить предоплату: канал сменил payment_collect на property либо обнулил сумму.
    // Тогда прежний платёж снимается, иначе гость останется «оплатившим» на стойке.
    if (a.payment_collect !== 'ota' || amountMinor <= 0n) {
      await repo.voidChannelPrepayment(reference);
      return;
    }
    await repo.recordChannelPrepayment(
      itemId,
      amountMinor,
      reference,
      `Предоплата канала ${a.ota_name}: деньги собраны площадкой`,
    );
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

  /**
   * Связать ревизию с бронью, которая уже лежит в PMS (ADR-024 — перенесённая; ADR-071 — заведённая стойкой с
   * номером брони в канале). Проживания и ячейки не трогаются, статус выводится из них; шапка — даты, сумма
   * (при той же валюте), внешний ID и имя канала из ревизии; заметка — только если канал её прислал.
   */
  private async linkExisting(
    repo: ReservationsRepository,
    linked: ReservationState,
    a: channex.ChannexBookingRevisionAttributes,
    items: Array<{
      accommodationTypeId: string;
      arrivalDate: string;
      departureDate: string;
      priceMinor: bigint;
    }>,
    header: { arrivalDate: string; departureDate: string; totalAmountMinor: bigint },
    warnings: string[],
    affectedOf: (
      its: Array<{ accommodationTypeId: string; arrivalDate: string; departureDate: string }>,
    ) => NonNullable<RevisionOutcome['affected']>,
  ): Promise<Pick<RevisionOutcome, 'result' | 'confirmationNumber' | 'affected'>> {
    const before = await repo.card(linked.confirmationNumber);
    const live = linked.items.filter((i) => i.status !== 'CANCELLED');
    // Сумма ревизии — в валюте канала (Expedia, Trip.com могут слать не KZT), перенесённая бронь — в тиынах.
    // Курс PMS не считает: при несовпадении сумма шапки и предоплата не переносятся, человек проверяет счёт.
    const sameCurrency = a.currency === linked.currency;
    if (!sameCurrency)
      warnings.push(
        `Бронь ${a.unique_id}: валюта ревизии ${a.currency} ≠ ${linked.currency} брони в PMS — сумма и предоплата канала не перенесены, проверьте счёт вручную`,
      );
    // Проживания и ячейки не трогаем — ячейку назначила стойка (или перенос из Exely, ADR-024).
    // Предоплата канала — на счёт каждого проживания, как на модификации (Q-086); комната ревизии
    // подбирается к проживанию по (категория, заезд, выезд), а не по порядку в ревизии.
    const pool = [...items];
    for (const [i, item] of live.entries()) {
      const k = pool.findIndex((room) => sameStaySet([room], [item]));
      const room = k >= 0 ? pool.splice(k, 1)[0]! : items[i]!;
      if (!sameCurrency) continue;
      // Счёт мог быть уже оплачен — на стойке или при переносе (платёж EXTERNAL exely:…): вторая оплата
      // от канала сделала бы счёт отрицательным. Что-то уже оплачено → платёж не пишем, зовём человека.
      if (a.payment_collect === 'ota' && room.priceMinor > 0n) {
        const balance = await repo.stayBalanceMinor(item.id);
        if (balance < room.priceMinor) {
          warnings.push(
            `Бронь ${a.unique_id}: счёт проживания ${item.arrivalDate} → ${item.departureDate} уже оплачен в PMS — предоплата канала не записана, проверьте счёт вручную`,
          );
          continue;
        }
      }
      await this.recordPrepayment(repo, item.id, i, a, room.priceMinor);
    }
    // Шапка как на модификации, кроме статуса: он выводится из проживаний, а их мы не трогали
    // (гость мог быть уже заселён — сбрасывать его в CONFIRMED нельзя).
    // Прежняя заметка остаётся, если канал заметки не прислал (обычно так и есть).
    await repo.updateReservation(linked.id, {
      arrivalDate: header.arrivalDate,
      departureDate: header.departureDate,
      ...(sameCurrency ? { totalAmountMinor: header.totalAmountMinor } : {}),
      externalId: a.unique_id,
      channel: a.ota_name,
      ...(a.notes != null ? { notes: freeTextForStorage(a.notes) } : {}),
    });
    await repo.audit({
      entityType: 'Reservation',
      entityId: linked.id,
      action: 'channex.booking.linked',
      before,
      after: await repo.card(linked.confirmationNumber),
    });
    return {
      result: 'linked',
      confirmationNumber: linked.confirmationNumber,
      affected: affectedOf(live),
    };
  }

  /**
   * ADR-024 (Q-034). При подключении канала Channex подтягивает уже существующие будущие брони
   * Booking.com, Expedia и Trip.com и присылает каждую как booking_new (`CHANNEX_PULLS_EXISTING_BOOKINGS`;
   * для Agoda, Hostelworld и Ostrovok подтяжки нет). Те же брони уже перенесены из Exely — без номера на
   * стороне канала, поэтому поиски по ID пусты, и без этого шага каждая заняла бы вторую койку.
   * Кандидат: бронь OTA без внешнего ID, не отменена, не автотест, живые проживания совпадают с комнатами
   * ревизии 1:1 по (категория, заезд, выезд); суммы и валюта не участвуют.
   * - ключ канала ревизии — по коду из `unique_id` (BDC, EXP, CTP…; channel-codes.md велит сопоставлять по коду,
   *   имена у Channex плавают: «Booking.com»/«BookingCom», «Expedia»/«A-Expedia»), имя `ota_name` — запасной путь;
   *   у перенесённой из Exely брони ключ — по её имени канала (`otaChannelKey`);
   * - канал с подтяжкой, ровно один кандидат того же канала → связать;
   * - канал с подтяжкой, кандидатов того же канала несколько → PMS не выбирает сама: ревизия отклоняется
   *   с номерами кандидатов (FAILED, без ack, ничего не создано) — решение владельца (QUESTIONS.md);
   * - имя канала PMS не знает, а перенесённая бронь с тем же составом есть → тоже отклонить: скорее всего
   *   это Trip.com/Expedia под другим написанием `ota_name`, и создать её значило бы занять вторую койку молча;
   * - известный канал без подтяжки (Agoda, Hostelworld, Ostrovok) или кандидатов нет → null, создать как обычно.
   */
  private async linkImported(
    repo: ReservationsRepository,
    a: channex.ChannexBookingRevisionAttributes,
    items: Array<{ accommodationTypeId: string; arrivalDate: string; departureDate: string }>,
  ): Promise<ReservationState | null> {
    if (items.length === 0) return null;
    const key = channex.channelKey(a.unique_id, a.ota_name);
    const pulled = channex.CHANNEX_PULLS_EXISTING_BOOKINGS.has(key);
    if (!pulled && channex.KNOWN_CHANNEL_KEYS.has(key)) return null;
    const from = items.reduce(
      (m, i) => (i.arrivalDate < m ? i.arrivalDate : m),
      items[0]!.arrivalDate,
    );
    const toExclusive = items.reduce(
      (m, i) => (i.departureDate > m ? i.departureDate : m),
      items[0]!.departureDate,
    );
    const sameStays = (await repo.importedOtaCandidates({ from, toExclusive }))
      .filter((c) => !(c.notes ?? '').includes(E2E_NOTE))
      .map((c) => ({
        id: c.id,
        confirmationNumber: c.confirmationNumber,
        channel: c.channel,
        items: c.items.filter((i) => i.status !== 'CANCELLED'),
      }))
      .filter((c) => sameStaySet(items, c.items));
    if (!pulled) {
      if (sameStays.length === 0) return null;
      const listed = sameStays
        .map((c) => `${c.confirmationNumber} (${c.channel ?? 'канал не указан'})`)
        .join(', ');
      throw new ImportLinkAmbiguousError(
        `Бронь ${a.unique_id}: канал «${a.ota_name}» PMS не знает, а перенесённая из Exely бронь с тем же составом проживаний есть — ${listed}. Если это тот же канал под другим именем — добавьте имя в соответствия каналов (ADR-024) и нажмите «Обработать заново»; если другой — разберите вручную`,
      );
    }
    const match = matchImportedReservation(
      items,
      sameStays.filter((c) => !!c.channel && channex.otaChannelKey(c.channel) === key),
    );
    if (match.kind === 'none') return null;
    if (match.kind === 'many')
      throw new ImportLinkAmbiguousError(
        `Бронь ${a.unique_id} (${a.ota_name}): перенесённых из Exely броней с таким же составом проживаний несколько — ${match.confirmationNumbers.join(', ')}; PMS не выбирает сама (ADR-024). Разберите вручную по CUTOVER.md и нажмите «Обработать заново»`,
      );
    return repo.reservationByNumber(match.confirmationNumber);
  }

  /** Когда процесс поднялся и когда лента последний раз прочиталась — для сторожа системы (feed.stale, ADR-028) */
  private readonly startedAt = new Date();
  private pullState: { okAt: Date | null; failedAt: Date | null; error: string | null } = {
    okAt: null,
    failedAt: null,
    error: null,
  };
  pullHealth(): {
    startedAt: Date;
    okAt: Date | null;
    failedAt: Date | null;
    error: string | null;
  } {
    return { startedAt: this.startedAt, ...this.pullState };
  }

  /** Чтения ленты идут по одному: webhook, опрос раз в 5 минут и кнопки не разбирают одну ревизию дважды разом */
  private pullChain: Promise<unknown> = Promise.resolve();

  /**
   * Лента неподтверждённых ревизий → обработка каждой → ack. Работает и без публичного webhook.
   * `via` — как ревизия дошла, для журнала событий: по webhook, опросом или по кнопке.
   */
  pull(propertyId?: string, via: ExternalEventVia = 'PULL'): Promise<PullResult> {
    const run = this.pullChain.then(
      () => this.pullOnce(propertyId, via),
      () => this.pullOnce(propertyId, via),
    );
    this.pullChain = run.catch(() => undefined);
    return run;
  }

  private async pullOnce(
    propertyId: string | undefined,
    via: ExternalEventVia,
  ): Promise<PullResult> {
    let feed: Awaited<ReturnType<ChannexGateway['bookingRevisionsFeed']>>;
    try {
      feed = await this.viaChannex(() => this.gateway.bookingRevisionsFeed(propertyId));
    } catch (e) {
      this.pullState = { ...this.pullState, failedAt: new Date(), error: redactText((e as Error).message, 1000) };
      throw e;
    }
    this.pullState = { okAt: new Date(), failedAt: null, error: null };
    const outcomes: RevisionOutcome[] = [];
    let acknowledged = 0;
    for (const rev of feed) {
      // Одна плохая ревизия не должна обрывать ленту: без этого следующие брони не будут ни обработаны,
      // ни подтверждены, а неподтверждённая ревизия останется во главе ленты и заблокирует каждый опрос.
      // Событие уже помечено FAILED внутри processRevision, ack не отправляется — Channex вернёт её снова.
      let o: RevisionOutcome;
      try {
        o = await this.processRevision(rev, via);
      } catch (e) {
        // SECURITY.md §7: текст ошибки уходит в ответ и в журнал API — без почты и телефонов гостя
        const message = redactText(e instanceof Error ? e.message : String(e), 1000);
        this.log.error(`Ревизия ${rev.id}: ${message}`);
        o = {
          revisionId: rev.id,
          uniqueId: rev.attributes.unique_id,
          status: rev.attributes.status,
          result: 'failed',
          confirmationNumber: null,
          error: message,
          warnings: [],
        };
      }
      outcomes.push(o);
      if (o.result !== 'failed') acknowledged += 1;
    }
    return { received: feed.length, outcomes, acknowledged };
  }

  /**
   * Снять потолок попыток и разобрать ревизию заново — по кнопке администратора. Ревизию берём из ленты:
   * неразобранная не подтверждена и в ленте остаётся (bookings-collection.md, «Booking Revisions Feed»).
   */
  async retryEvent(revisionId: string): Promise<RevisionOutcome> {
    await this.uow.run((repo) => repo.resetExternalEventAttempts(PROVIDER, revisionId));
    const r = await this.pull(undefined, 'MANUAL');
    const outcome = r.outcomes.find((o) => o.revisionId === revisionId);
    if (!outcome)
      throw new NotFoundException(
        `Ревизии ${revisionId} нет в ленте неподтверждённых: Channex её больше не отдаёт — скорее всего, она уже подтверждена. Сверьте бронь вручную`,
      );
    return outcome;
  }

  private async viaChannex<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof channex.ChannexApiError) throw gatewayFailure(e);
      throw e;
    }
  }

  /**
   * Одна ревизия = одна транзакция: журнал (UNIQUE provider+revision, ADR-007) → бронь → PROCESSED; ack после коммита.
   * Повтор той же ревизии — ничего не меняет, но ack повторяется (Channex мог не получить первый).
   */
  async processRevision(
    rev: channex.ChannexResource<channex.ChannexBookingRevisionAttributes>,
    via: ExternalEventVia = 'PULL',
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
        receivedVia: via,
      }),
    );
    let outcome: RevisionOutcome;
    if (ev.status === 'FAILED' && ev.attemptCount >= MAX_INBOUND_ATTEMPTS) {
      // Потолок попыток. Без него ревизия, которую мы не умеем разобрать, возвращается в ленте
      // на каждом опросе и молча падает снова и снова: в журнале растёт счётчик, а человек ничего
      // не замечает. Событие ждёт кнопки «Обработать заново» на /channels.
      return {
        ...base,
        result: 'failed',
        confirmationNumber: null,
        error: `${ev.attemptCount} неудачных попыток — разберите событие вручную и нажмите «Обработать заново». Последняя ошибка: ${ev.lastError ?? 'не записана'}`,
      };
    }
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
            // Предупреждения разбора («без ячейки», «предоплата не записана») сохраняются вместе с событием:
            // webhook и фоновый опрос результат никому не показывают, а на /channels колонка видна.
            // Отдельного поля у события нет — заявка на `warnings` в DATA_MODEL.md (ADR-024).
            lastError: base.warnings.length
              ? redactText(`Предупреждение: ${base.warnings.join('; ')}`, 1000)
              : null,
            processedAt: new Date(),
          });
          return applied;
        });
        outcome = { ...base, ...r };
      } catch (e) {
        // SECURITY.md §7: last_error без почты и телефонов — ошибка записи может напечатать заметку гостя
        const message = redactText(e instanceof Error ? e.message : String(e), 1000);
        // Транзакция 3: FAILED пишется отдельно — внутри прерванной транзакции Postgres это невозможно (25P02).
        await this.uow.run((repo) =>
          repo.updateExternalEvent(ev.id, {
            status: 'FAILED',
            lastError: message,
            // транзакция с пометкой PROCESSING откатилась вместе с ошибкой — попытку считаем здесь
            countAttempt: true,
          }),
        );
        if (e instanceof UnmappedRoomError || e instanceof ImportLinkAmbiguousError) {
          this.log.warn(`ревизия ${rev.id} (${a.unique_id}) отклонена: ${message}`);
          return { ...base, result: 'failed', confirmationNumber: null, error: message };
        }
        throw e;
      }
    }
    // Результат ревизии на webhook и фоновом опросе никто не читает — предупреждения хотя бы в журнал процесса
    for (const w of outcome.warnings) this.log.warn(`ревизия ${rev.id} (${a.unique_id}): ${w}`);
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
    // 2) ota_reservation_code — брони, у которых externalId — номер брони НА СТОРОНЕ КАНАЛА, а unique_id
    //    Channex мы никогда не видели. Без этого шага модификация создала бы дубль с второй ячейкой,
    //    а отмена не нашла бы бронь и оставила бы койку занятой;
    // 3) номер подтверждения — брони, созданные до заполнения externalId;
    // 4) ADR-024, только для ревизии, которую иначе пришлось бы создать (и не отмены): перенесённые из Exely
    //    брони канала — у них НЕТ ни того, ни другого (Универсальный API Exely номер брони канала не отдаёт),
    //    пара ищется по каналу и составу проживаний — см. linkImported(). Неоднозначность (несколько
    //    кандидатов, незнакомое имя канала) ревизию отклоняет: дубль с занятой второй койкой хуже, чем событие
    //    FAILED с объяснением и кнопкой «Обработать заново».
    // Найденной броне externalId переписывается на unique_id ниже, поэтому шаги 2 и 4 нужны один раз.
    const byUniqueId = await repo.reservationByExternalId(a.unique_id);
    const byOtaCode =
      !byUniqueId && a.ota_reservation_code
        ? await repo.reservationByExternalId(a.ota_reservation_code)
        : null;
    const existing = byUniqueId ?? byOtaCode ?? (await repo.reservationByNumber(a.unique_id));
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
      // SECURITY.md §6: отмена каналом — в журнале карточка до и после, как у отмены со стойки
      const before = await repo.card(existing.confirmationNumber);
      const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
      for (const item of existing.items) {
        for (const al of item.allocations) await repo.deleteAllocation(al.id);
        if (item.status !== 'CANCELLED') await repo.updateItem(item.id, { status: 'CANCELLED' });
        // Правило штрафа одно на всё: отмена в день заезда и позже (Q-103). Канал отменяет так же, как стойка
        if (
          item.cancellationPenalty !== 'NONE' &&
          item.priceMinor > 0n &&
          penaltyDue({ arrivalDate: item.arrivalDate, on: today, reason: 'cancel' })
        ) {
          const nights = Math.round(
            (Date.parse(`${item.departureDate}T00:00:00Z`) -
              Date.parse(`${item.arrivalDate}T00:00:00Z`)) /
              86_400_000,
          );
          const amount = penaltyAmount(item.cancellationPenalty, {
            totalMinor: item.priceMinor,
            nights,
            firstNightMinor: null,
          });
          if (amount > 0n)
            await repo.addPenaltyCharge(
              item.id,
              amount,
              `Штраф за отмену из канала (${item.arrivalDate} → ${item.departureDate})`,
            );
        }
        // ADR-022 (Q-108): от предоплаты канала остаётся только штраф, остальное площадка возвращает гостю
        await repo.settleChannelPrepaymentAfterCancel(item.id);
      }
      // ADR-021: блоки соседних ночей этой брони снимаются вместе с ней
      for (const b of await repo.releaseStayExtraBlocks(existing.confirmationNumber))
        await this.publisher.reservationChanged({
          categoryCodes: [b.categoryCode],
          from: b.from,
          toExclusive: b.toExclusive,
        });
      await repo.updateReservation(existing.id, { status: 'CANCELLED' });
      const after = await repo.card(existing.confirmationNumber);
      await repo.audit({
        entityType: 'Reservation',
        entityId: existing.id,
        action: 'channex.booking.cancelled',
        ...(before ? { before } : {}),
        after: { ...(after ?? {}), uniqueId: a.unique_id },
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
      // Шаг 4 (ADR-024): подтянутая каналом бронь, которая уже лежит в PMS после переноса из Exely.
      const linked = await this.linkImported(repo, a, items);
      if (linked) return this.linkExisting(repo, linked, a, items, header, warnings, affectedOf);
      // ADR-009/ADR-018: настоящие ФИО и контакты допустимы только в production-БД в Казахстане.
      // Пока Q-070 открыт и база в Сингапуре, гость канала записывается псевдонимом.
      const guestId = await repo.createGuest(
        guestForStorage(
          {
            firstName: (a.customer?.name ?? '').trim() || 'Гость',
            lastName: (a.customer?.surname ?? '').trim() || a.ota_name,
            phone: a.customer?.phone ?? null,
            email: a.customer?.mail ?? null,
          },
          a.unique_id,
        ),
      );
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
        notes: freeTextForStorage(a.notes),
        items,
      } satisfies NewReservation);
      for (const [i, itemId] of created.itemIds.entries()) {
        await repo.addStayGuest(itemId, guestId, true);
        await this.autoAssign(repo, itemId, items[i]!, a.unique_id, warnings);
        await this.recordPrepayment(repo, itemId, i, a, items[i]!.priceMinor);
      }
      await repo.audit({
        entityType: 'Reservation',
        entityId: created.id,
        action: 'channex.booking.new',
        after: await repo.card(a.unique_id),
      });
      return { result: 'created', confirmationNumber: a.unique_id, affected: affectedOf(items) };
    }

    // ADR-071: первая ревизия подключённого канала по брони, которую стойка завела с номером брони в канале
    // (найдена по ota_reservation_code). Это подтяжка той же брони, а не правка: связываем, как перенесённую
    // (ADR-024) — гость, статус проживаний, ячейки и заметка стойки остаются, дальше бронь идёт по unique_id.
    if (byOtaCode && a.status === 'new')
      return this.linkExisting(repo, byOtaCode, a, items, header, warnings, affectedOf);

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
          // Канал мог сменить тип комнаты и тариф — иначе ячейка окажется чужой категории
          accommodationTypeId: next.accommodationTypeId,
          ...(next.ratePlanId ? { ratePlanId: next.ratePlanId } : {}),
        });
        // Цена в ревизии могла измениться — предоплата канала пересчитывается вместе с ней (Q-086)
        await this.recordPrepayment(repo, item.id, i, a, next.priceMinor);
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
      for (const [i, next] of items.entries()) {
        const itemId = await repo.addReservationItem(existing.id, next);
        await this.autoAssign(repo, itemId, next, a.unique_id, warnings);
        await this.recordPrepayment(repo, itemId, i, a, next.priceMinor);
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
      notes: freeTextForStorage(a.notes),
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
