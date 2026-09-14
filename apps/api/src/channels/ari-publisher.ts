import 'reflect-metadata';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { categoryAvailability } from '@pms/domain';
import type { channex } from '@pms/integrations';
import { compressRuns } from './ari';
import { CHANNELS_REPOSITORY, type ChannelsRepository } from './channels.repository';

export const PROVIDER = 'channex';

/** Дельта ARI из команд PMS → очередь. Интерфейс для модуля броней; реализация здесь. */
export interface AriPublisher {
  /** Изменились проживания категорий на ночах [from, toExclusive) → пересчитать и поставить в очередь доступность */
  reservationChanged(change: {
    categoryCodes: string[];
    from: string;
    toExclusive: string;
  }): Promise<void>;
  /**
   * Изменились цены/ограничения (в наших терминах) → перевести по маппингу и поставить в очередь одним сообщением.
   * `tx` — транзакция команды: очередь пишется вместе с ценами, иначе цены сохранятся, а в каналы не уйдут (Б5).
   */
  ratesChanged(changes: LocalRateChange[], tx?: unknown): Promise<void>;
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
  change: { categoryCodes: string[]; from: string; toExclusive: string },
): Promise<void> {
  try {
    await publisher.reservationChanged(change);
  } catch (e) {
    new Logger('AriPublisher').error(
      `Дельта доступности не встала в очередь после записи команды (${change.categoryCodes.join(', ')} ` +
        `${change.from} → ${change.toExclusive}): ${e instanceof Error ? e.message : String(e)}`,
    );
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

  async reservationChanged(change: {
    categoryCodes: string[];
    from: string;
    toExclusive: string;
  }): Promise<void> {
    if (change.categoryCodes.length === 0 || change.toExclusive <= change.from) return;
    const mappings = (await this.repo.mappings(PROVIDER)).filter(
      (m) => m.providerRoomTypeId && m.localAccommodationTypeCode,
    );
    if (mappings.length === 0) return; // Channex не настроен — нечего публиковать
    const to = plusDays(change.toExclusive, -1);
    const [units, blocks, items] = await Promise.all([
      this.repo.categoryUnits(),
      this.repo.categoryBlocks(change.from, change.toExclusive),
      this.repo.soldItems(change.from, change.toExclusive),
    ]);
    const avail = categoryAvailability({ from: change.from, to, units, blocks, items });
    const values: channex.ChannexAvailabilityValue[] = [];
    const dates = Array.from(
      { length: (Date.parse(to) - Date.parse(change.from)) / 86_400_000 + 1 },
      (_, i) => plusDays(change.from, i),
    );
    for (const code of new Set(change.categoryCodes)) {
      const m = mappings.find((x) => x.localAccommodationTypeCode === code);
      const perDate = avail.get(code);
      if (!m || !perDate) continue;
      for (const run of compressRuns(dates, (d) => perDate.get(d) ?? null, String))
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

  async ratesChanged(changes: LocalRateChange[], tx?: unknown): Promise<void> {
    if (changes.length === 0) return;
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
  }
}

/** Заглушка для тестов модулей, которым Channex не нужен. */
export class NoopAriPublisher implements AriPublisher {
  async reservationChanged(): Promise<void> {}
  async ratesChanged(): Promise<void> {}
}
