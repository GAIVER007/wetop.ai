import 'reflect-metadata';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { categoryAvailability } from '@pms/domain';
import type { channex } from '@pms/integrations';
import { compressRuns } from './ari';
import { nightsOf, type AriRange } from './ari-ranges';
import { CHANNELS_REPOSITORY, type ChannelsRepository } from './channels.repository';

export const PROVIDER = 'channex';

/** Изменение остатка: категории и окно ночей [from, toExclusive) */
export interface AvailabilityChange {
  categoryCodes: string[];
  from: string;
  toExclusive: string;
  /**
   * Только эти ночи — у брони: где поменялось число занятых мест (`ari-ranges.ts`; сертификация Channex §13
   * «only send changes»). Без поля — каждая ночь окна каждой категории: блокировка, новые места и ручной запрос
   * меняют остаток на всём окне.
   */
  ranges?: AriRange[];
}

/** Дельта ARI из команд PMS → очередь. Интерфейс для модуля броней; реализация здесь. */
export interface AriPublisher {
  /** Изменился остаток категорий → пересчитать по базе и поставить в очередь доступность этих ночей */
  reservationChanged(change: AvailabilityChange): Promise<void>;
  /**
   * Изменились цены/ограничения (в наших терминах) → перевести по маппингу и поставить в очередь одним сообщением.
   * `tx` — транзакция команды: очередь пишется вместе с ценами, иначе цены сохранятся, а в каналы не уйдут (Б5).
   * Возвращает число значений, вставших в очередь: 0 — ничего не сопоставлено, стойка так и пишет.
   */
  /**
   * Возвращает, сколько изменений встало в очередь каналов. Не всё, что сохранено, туда идёт:
   * категория или тариф без сопоставления с Channex не продаются каналом, а цена «на одного гостя»
   * в двухместной категории не цена номера (Б3). Экран показывает это число, чтобы не обещать
   * отправку, которой не было (§7.3).
   */
  ratesChanged(changes: LocalRateChange[], tx?: unknown): Promise<number>;
  /**
   * След для сторожа: дельта не встала в очередь после записанной команды (Б6). Очередь пуста, поэтому
   * «упавшая отправка» и «застряла очередь» этого не увидят — сторож читает журнал (`channex.deltaLost`).
   */
  deltaLost?(change: AvailabilityChange, error: string): Promise<void>;
}
/** Одно изменение цен/ограничений в терминах PMS (без ID провайдера). */
export interface LocalRateChange {
  accommodationTypeCode: string;
  ratePlanCode: string;
  dateFrom: string;
  dateTo: string;
  days?: Array<'mo' | 'tu' | 'we' | 'th' | 'fr' | 'sa' | 'su'>;
  /** integer minor units; undefined = цена не менялась */
  priceMinor?: bigint;
  /** Цена задана только для этого числа гостей; undefined — для всех */
  occupancy?: number;
  /** Вместимость категории: в канал уходит только её цена, как в ночной выгрузке (ari.ts, occupancyByCategory) */
  primaryOccupancy?: number;
  minStay?: number | null;
  maxStay?: number | null;
  stopSell?: boolean;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
}
export const ARI_PUBLISHER = Symbol('ARI_PUBLISHER');

/**
 * Дельта доступности после коммита команды (бронь, переселение, блокировка). Не роняет команду: запись уже в
 * базе, а ответ 500 заставил бы администратора повторить и создать дубль (Б6). Остаток поправят следующая
 * дельта этой категории и ночная полная выгрузка; сбой пишется в журнал API.
 */
export async function publishAfterCommit(
  publisher: AriPublisher,
  change: AvailabilityChange,
): Promise<void> {
  try {
    await publisher.reservationChanged(change);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    new Logger('AriPublisher').error(
      `Дельта доступности не встала в очередь после записи команды (${change.categoryCodes.join(', ')} ` +
        `${change.from} → ${change.toExclusive}): ${error}`,
    );
    // Журнал в базе, а не только в файле: из него сторож узнаёт, что остаток в канале устарел, и делает
    // полную выгрузку. Сбой самой записи следа команду тоже не роняет — она уже записана.
    try {
      await publisher.deltaLost?.(change, error);
    } catch (e2) {
      new Logger('AriPublisher').error(
        `След потерянной дельты не записан: ${e2 instanceof Error ? e2.message : String(e2)}`,
      );
    }
  }
}

/** Поля адреса значения ARI: значение только из них ничего в Channex не меняет */
const ADDRESS_KEYS = new Set(['property_id', 'rate_plan_id', 'date_from', 'date_to', 'days']);

const plusDays = (iso: string, n: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

@Injectable()
export class OutboxAriPublisher implements AriPublisher {
  constructor(@Inject(CHANNELS_REPOSITORY) private readonly repo: ChannelsRepository) {}

  /** Строка журнала о потерянной дельте: её читает сторож (`OutboxSignal.lostDeltaAt`, ADR-028) */
  async deltaLost(change: AvailabilityChange, error: string): Promise<void> {
    await this.repo.audit('channex.deltaLost', { ...change, error });
  }

  async reservationChanged(change: AvailabilityChange): Promise<void> {
    // Ночи по категориям: у брони — только отрезки, где менялся остаток; без них — всё окно каждой категории
    const ranges =
      change.ranges ??
      change.categoryCodes.map((categoryCode) => ({
        categoryCode,
        from: change.from,
        toExclusive: change.toExclusive,
      }));
    const nightsByCategory = new Map<string, Set<string>>();
    for (const r of ranges)
      for (const d of nightsOf(r.from, r.toExclusive)) {
        let nights = nightsByCategory.get(r.categoryCode);
        if (!nights) nightsByCategory.set(r.categoryCode, (nights = new Set()));
        nights.add(d);
      }
    if (nightsByCategory.size === 0) return;
    const mappings = (await this.repo.mappings(PROVIDER)).filter(
      (m) => m.providerRoomTypeId && m.localAccommodationTypeCode,
    );
    if (mappings.length === 0) return; // Channex не настроен — нечего публиковать
    const all = [...nightsByCategory.values()].flatMap((s) => [...s]).sort();
    const from = all[0]!;
    const to = all[all.length - 1]!;
    const [units, blocks, items] = await Promise.all([
      this.repo.categoryUnits(),
      this.repo.categoryBlocks(from, plusDays(to, 1)),
      this.repo.soldItems(from, plusDays(to, 1)),
    ]);
    const avail = categoryAvailability({ from, to, units, blocks, items });
    const values: channex.ChannexAvailabilityValue[] = [];
    for (const [code, nights] of nightsByCategory) {
      const m = mappings.find((x) => x.localAccommodationTypeCode === code);
      const perDate = avail.get(code);
      if (!m || !perDate) continue;
      // Ночи между отрезками в список не входят: compressRuns склеивает только соседние даты
      for (const run of compressRuns([...nights].sort(), (d) => perDate.get(d) ?? null, String))
        values.push({
          property_id: m.providerPropertyId,
          room_type_id: m.providerRoomTypeId!,
          date_from: run.from,
          date_to: run.to,
          availability: run.value,
        });
    }
    if (values.length) await this.repo.enqueueOutbox(PROVIDER, 'AVAILABILITY', values);
  }

  async ratesChanged(changes: LocalRateChange[], tx?: unknown): Promise<number> {
    if (changes.length === 0) return 0;
    const repo = tx !== undefined && this.repo.withClient ? this.repo.withClient(tx) : this.repo;
    const mappings = await repo.mappings(PROVIDER);
    const plans = await repo.ratePlanIdsByCode();
    const values: channex.ChannexRestrictionValue[] = [];
    for (const c of changes) {
      const localRatePlanId = plans[c.ratePlanCode];
      const m = mappings.find(
        (x) =>
          x.localAccommodationTypeCode === c.accommodationTypeCode &&
          x.localRatePlanId === localRatePlanId &&
          x.providerRatePlanId,
      );
      if (!m) continue; // тариф/категория не продаются через Channex — ничего не шлём
      const v: channex.ChannexRestrictionValue = {
        property_id: m.providerPropertyId,
        rate_plan_id: m.providerRatePlanId!,
        date_from: c.dateFrom,
        date_to: c.dateTo,
      };
      if (c.days?.length) v.days = c.days;
      // Канальный тариф — за номер: цена меньшего числа гостей остаётся в PMS, иначе OTA продают номер по ней (Б3)
      const capacityPrice = c.occupancy === undefined || c.occupancy === c.primaryOccupancy;
      if (c.priceMinor !== undefined && capacityPrice) v.rate = Number(c.priceMinor);
      if (c.minStay !== undefined) {
        // «без ограничения» у Channex — 1: ноль он отклоняет предупреждением в ответе 200 (Б4)
        const min = c.minStay !== null && c.minStay > 0 ? c.minStay : 1;
        v.min_stay_arrival = min;
        v.min_stay_through = min;
      }
      if (c.maxStay !== undefined) v.max_stay = c.maxStay ?? 0;
      if (c.stopSell !== undefined) v.stop_sell = c.stopSell;
      if (c.closedToArrival !== undefined) v.closed_to_arrival = c.closedToArrival;
      if (c.closedToDeparture !== undefined) v.closed_to_departure = c.closedToDeparture;
      const changesSomething = Object.keys(v).some((k) => !ADDRESS_KEYS.has(k));
      if (changesSomething) values.push(v);
    }
    if (values.length) await repo.enqueueOutbox(PROVIDER, 'RESTRICTIONS', values);
    return values.length;
  }
}

/** Заглушка для тестов модулей, которым Channex не нужен. */
export class NoopAriPublisher implements AriPublisher {
  async reservationChanged(): Promise<void> {}
  async ratesChanged(): Promise<number> {
    return 0;
  }
}
