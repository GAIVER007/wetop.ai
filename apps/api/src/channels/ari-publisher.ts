import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
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
  /** Изменились цены/ограничения (в наших терминах) → перевести по маппингу и поставить в очередь одним сообщением */
  ratesChanged(changes: LocalRateChange[]): Promise<void>;
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
  minStay?: number | null;
  maxStay?: number | null;
  stopSell?: boolean;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
}
export const ARI_PUBLISHER = Symbol('ARI_PUBLISHER');

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

  async ratesChanged(changes: LocalRateChange[]): Promise<void> {
    if (changes.length === 0) return;
    const mappings = await this.repo.mappings(PROVIDER);
    const plans = await this.repo.ratePlanIdsByCode();
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
      if (c.priceMinor !== undefined) v.rate = Number(c.priceMinor);
      if (c.minStay !== undefined) {
        v.min_stay_arrival = c.minStay ?? 1;
        v.min_stay_through = c.minStay ?? 1;
      }
      if (c.maxStay !== undefined) v.max_stay = c.maxStay ?? 0;
      if (c.stopSell !== undefined) v.stop_sell = c.stopSell;
      if (c.closedToArrival !== undefined) v.closed_to_arrival = c.closedToArrival;
      if (c.closedToDeparture !== undefined) v.closed_to_departure = c.closedToDeparture;
      values.push(v);
    }
    if (values.length) await this.repo.enqueueOutbox(PROVIDER, 'RESTRICTIONS', values);
  }
}

/** Заглушка для тестов модулей, которым Channex не нужен. */
export class NoopAriPublisher implements AriPublisher {
  async reservationChanged(): Promise<void> {}
  async ratesChanged(): Promise<void> {}
}
