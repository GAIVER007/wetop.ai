import 'reflect-metadata';
import {
  BadRequestException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ARI_PUBLISHER, type AriPublisher, type LocalRateChange } from '../channels/ari-publisher';
import { RATES_REPOSITORY, type RateChange, type RatesRepository } from './rates.repository';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Предел календаря цен: год с запасом. Экран просит месяц, массовая правка — период руками */
const MAX_CALENDAR_DAYS = 366;
/** Строк в одной массовой правке: экран шлёт единицы, скрипты сертификации — десятки */
const MAX_BULK_CHANGES = 200;
const DAYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const;
export interface RateChangeDto {
  accommodationTypeCode?: string;
  ratePlanCode?: string;
  dateFrom?: string;
  dateTo?: string;
  days?: string[];
  /** Цена в основных единицах строкой, например "15400" или "456.23" */
  price?: string | null;
  occupancy?: number | null;
  minStay?: number | null;
  maxStay?: number | null;
  stopSell?: boolean | null;
  closedToArrival?: boolean | null;
  closedToDeparture?: boolean | null;
}

/** "456.23" → 45623n; пустая строка — цена не меняется. */
export function majorToMinor(value: string): bigint {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!m)
    throw new BadRequestException(
      `price «${value}» — число с не более чем двумя знаками после запятой`,
    );
  return BigInt(m[1]!) * 100n + BigInt((m[2] ?? '').padEnd(2, '0'));
}

@Injectable()
export class RatesService {
  constructor(
    @Inject(RATES_REPOSITORY) private readonly repo: RatesRepository,
    @Inject(ARI_PUBLISHER) private readonly publisher: AriPublisher,
  ) {}

  async options() {
    const [categories, ratePlans] = await Promise.all([
      this.repo.categories(),
      this.repo.ratePlans(),
    ]);
    return {
      categories: categories.map((c) => ({
        code: c.code,
        name: c.name,
        capacityAdults: c.capacityAdults,
      })),
      ratePlans: ratePlans.map((p) => ({
        code: p.code,
        name: p.name,
        currency: p.currency,
        active: p.active,
      })),
    };
  }

  async calendar(q: {
    accommodationTypeCode?: string | undefined;
    ratePlanCode?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
  }) {
    if (!q.accommodationTypeCode || !q.ratePlanCode)
      throw new BadRequestException('accommodationTypeCode и ratePlanCode обязательны');
    if (!ISO.test(q.from ?? '') || !ISO.test(q.to ?? '') || q.to! < q.from!)
      throw new BadRequestException('from/to — даты YYYY-MM-DD, from ≤ to');
    // Волна 4: календарь отдаёт строку на день; без предела экран просил хоть десять лет
    if ((Date.parse(q.to!) - Date.parse(q.from!)) / 86_400_000 + 1 > MAX_CALENDAR_DAYS)
      throw new BadRequestException(`Календарь цен — до ${MAX_CALENDAR_DAYS} дней за запрос`);
    const { type, plan } = await this.resolve(q.accommodationTypeCode, q.ratePlanCode);
    const days = await this.repo.calendar(type.id, plan.id, q.from!, q.to!);
    return {
      accommodationTypeCode: type.code,
      ratePlanCode: plan.code,
      currency: plan.currency,
      capacityAdults: type.capacityAdults,
      days,
    };
  }

  /** Массовое изменение: все строки одной транзакцией и одним сообщением в канал (сертификация: «1 API call»). */
  async bulk(dto: { changes?: RateChangeDto[] }) {
    if (!Array.isArray(dto.changes) || dto.changes.length === 0)
      throw new BadRequestException('changes: хотя бы одно изменение');
    // Пределы проверяются до базы: строка до 9999 года разворачивалась в миллионы дат внутри транзакции и
    // останавливала весь API (аудит 26.09, С-32)
    if (dto.changes.length > MAX_BULK_CHANGES)
      throw new BadRequestException(`changes: не больше ${MAX_BULK_CHANGES} изменений за раз`);
    const prepared: Array<
      RateChange & { accommodationTypeId: string; ratePlanId: string; capacityAdults: number }
    > = [];
    for (const [i, c] of dto.changes.entries()) {
      const where = `changes[${i}]`;
      if (!c.accommodationTypeCode || !c.ratePlanCode)
        throw new BadRequestException(`${where}: accommodationTypeCode и ratePlanCode обязательны`);
      if (!ISO.test(c.dateFrom ?? '') || !ISO.test(c.dateTo ?? '') || c.dateTo! < c.dateFrom!)
        throw new BadRequestException(
          `${where}: dateFrom/dateTo — даты YYYY-MM-DD, dateFrom ≤ dateTo`,
        );
      if ((Date.parse(c.dateTo!) - Date.parse(c.dateFrom!)) / 86_400_000 + 1 > MAX_CALENDAR_DAYS)
        throw new BadRequestException(
          `${where}: период — не длиннее ${MAX_CALENDAR_DAYS} дней за одну строку`,
        );
      // Пустой список — это «ни одного дня», а не «все дни»: иначе стоп-продажа уходила на весь период (С-48).
      // Все дни — список не передавать.
      if (Array.isArray(c.days) && c.days.filter((d) => d).length === 0)
        throw new BadRequestException(`${where}: отметьте хотя бы один день недели`);
      const days = (c.days ?? []).filter((d) => d);
      if (days.some((d) => !(DAYS as readonly string[]).includes(d)))
        throw new BadRequestException(`${where}: days — из ${DAYS.join(', ')}`);
      const { type, plan } = await this.resolve(c.accommodationTypeCode, c.ratePlanCode);
      const change: RateChange & {
        accommodationTypeId: string;
        ratePlanId: string;
        capacityAdults: number;
      } = {
        accommodationTypeCode: type.code,
        ratePlanCode: plan.code,
        accommodationTypeId: type.id,
        ratePlanId: plan.id,
        capacityAdults: type.capacityAdults,
        dateFrom: c.dateFrom!,
        dateTo: c.dateTo!,
        ...(days.length ? { days: days as RateChange['days'] } : {}),
      };
      if (c.price !== undefined && c.price !== null && c.price !== '') {
        change.priceMinor = majorToMinor(c.price);
        // Channex отклоняет нулевую цену предупреждением в ответе 200, а в PMS она сделала бы проживание бесплатным
        if (change.priceMinor === 0n)
          throw new BadRequestException(`${where}: цена должна быть больше нуля`);
      }
      if (c.occupancy) {
        if (!Number.isInteger(c.occupancy) || c.occupancy < 1 || c.occupancy > type.capacityAdults)
          throw new BadRequestException(`${where}: occupancy 1…${type.capacityAdults}`);
        change.occupancy = c.occupancy;
      }
      for (const k of ['minStay', 'maxStay'] as const) {
        const v = c[k];
        if (v === undefined) continue;
        if (v !== null && (!Number.isInteger(v) || v < 0))
          throw new BadRequestException(`${where}: ${k} — целое ≥ 0 или null`);
        // 0 — «снять ограничение»: хранится как пусто, иначе в базе остаётся строка-ограничение, а Channex получает 0
        change[k] = v === 0 ? null : v;
      }
      for (const k of ['stopSell', 'closedToArrival', 'closedToDeparture'] as const) {
        const v = c[k];
        if (v === undefined || v === null) continue;
        if (typeof v !== 'boolean') throw new BadRequestException(`${where}: ${k} — true/false`);
        change[k] = v;
      }
      const touches =
        change.priceMinor !== undefined ||
        ['minStay', 'maxStay', 'stopSell', 'closedToArrival', 'closedToDeparture'].some(
          (k) => (change as unknown as Record<string, unknown>)[k] !== undefined,
        );
      if (!touches)
        throw new BadRequestException(`${where}: нечего менять — укажите цену или ограничение`);
      prepared.push(change);
    }
    const local: LocalRateChange[] = prepared.map((p) => ({
      accommodationTypeCode: p.accommodationTypeCode,
      ratePlanCode: p.ratePlanCode,
      dateFrom: p.dateFrom,
      dateTo: p.dateTo,
      ...(p.days ? { days: p.days } : {}),
      ...(p.priceMinor !== undefined
        ? {
            priceMinor: p.priceMinor,
            ...(p.occupancy !== undefined ? { occupancy: p.occupancy } : {}),
            primaryOccupancy: p.capacityAdults,
          }
        : {}),
      ...(p.minStay !== undefined ? { minStay: p.minStay } : {}),
      ...(p.maxStay !== undefined ? { maxStay: p.maxStay } : {}),
      ...(p.stopSell !== undefined ? { stopSell: p.stopSell } : {}),
      ...(p.closedToArrival !== undefined ? { closedToArrival: p.closedToArrival } : {}),
      ...(p.closedToDeparture !== undefined ? { closedToDeparture: p.closedToDeparture } : {}),
    }));
    // Цены, журнал и очередь каналов — одна транзакция: не бывает «цены сохранены, а в каналы не ушли» (Б5)
    let queued = 0;
    const result = await this.repo.applyChanges(prepared, async (tx, counts, before) => {
      // SECURITY.md §6: правка цены и ограничений — с тем, что было до неё (диапазонами, rate-history.ts)
      await this.repo.audit(
        'rates.bulk',
        {
          changes: prepared.map((p) => ({ ...p, priceMinor: p.priceMinor?.toString() })),
          ...counts,
        },
        tx,
        { changes: before },
      );
      queued = await this.publisher.ratesChanged(local, tx);
    });
    return { applied: prepared.length, ...result, queued };
  }

  private async resolve(typeCode: string, planCode: string) {
    const [categories, plans] = await Promise.all([this.repo.categories(), this.repo.ratePlans()]);
    const type = categories.find((c) => c.code === typeCode);
    if (!type) throw new UnprocessableEntityException(`Категория ${typeCode} не найдена`);
    const plan = plans.find((p) => p.code === planCode);
    if (!plan) throw new UnprocessableEntityException(`Тариф ${planCode} не найден`);
    return { type, plan };
  }
}
