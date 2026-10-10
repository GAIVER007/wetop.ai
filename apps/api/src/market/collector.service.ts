import 'reflect-metadata';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  MarketInputError,
  isIsoDate,
  parseOccupancyPercent,
  todayAt,
  type AvailabilityLevel,
} from '@pms/domain';
import {
  MARKET_REPOSITORY,
  type CollectedEntry,
  type CollectorTarget,
  type MarketRepository,
} from './market.repository';

/** Окно ночей и размер записи: те же, что у ручного ввода (MarketService) */
const PAST_DAYS = 30;
const FUTURE_DAYS = 365;
const MAX_ENTRIES = 62;
const LEVELS: readonly AvailabilityLevel[] = ['SOLD_OUT', 'FEW_LEFT', 'AVAILABLE'];

const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Служебный вход ИИ-сборщика (M2a, ADR-142, Q-260). Объект, организация и «сегодня» берутся из строки конкурента,
 * тело запроса несёт только ночи, проценты и уровни наличия (DATA_MODEL §23.1). Сборщик пишет числа и ничего не стирает; ночь, которую человек заполнил
 * в тот же день, остаётся за человеком. Откуда сборщик берёт данные, здесь не решается (Q-257).
 */
@Injectable()
export class MarketCollectorService {
  constructor(@Inject(MARKET_REPOSITORY) private readonly repo: MarketRepository) {}

  async competitors(): Promise<{ competitors: CollectorTarget[] }> {
    return { competitors: await this.repo.collectorTargets() };
  }

  async collect(
    id: string,
    dto: { entries?: unknown },
    now = new Date(),
  ): Promise<{ saved: number; kept: number; observedOn: string }> {
    if (!Array.isArray(dto?.entries) || dto.entries.length === 0)
      throw new BadRequestException('entries: список { date, percent?, level? }');
    if (dto.entries.length > MAX_ENTRIES)
      throw new BadRequestException(`Не больше ${MAX_ENTRIES} ночей за раз`);
    const target = await this.repo.collectorTarget(id);
    if (!target) throw new NotFoundException('Конкурент не найден или убран из списка');
    const today = todayAt(target.timezone, now);
    const earliest = plusDays(today, -PAST_DAYS);
    const latest = plusDays(today, FUTURE_DAYS);
    const seen = new Set<string>();
    const entries: CollectedEntry[] = dto.entries.map((raw) => {
      const e = (raw ?? {}) as { date?: unknown; percent?: unknown; level?: unknown };
      if (!isIsoDate(e.date)) throw new BadRequestException('date: дата ночи YYYY-MM-DD');
      if (e.date < earliest || e.date > latest)
        throw new BadRequestException(`Ночь ${e.date}: можно от ${earliest} до ${latest}`);
      if (seen.has(e.date)) throw new BadRequestException(`Ночь ${e.date} указана дважды`);
      seen.add(e.date);
      let bp: number | null;
      try {
        bp = parseOccupancyPercent(e.percent);
      } catch (err) {
        if (err instanceof MarketInputError) throw new BadRequestException(err.message);
        throw err;
      }
      if (e.level !== undefined && e.level !== null && !LEVELS.includes(e.level as AvailabilityLevel))
        throw new BadRequestException(`Ночь ${e.date}: уровень один из ${LEVELS.join(', ')}`);
      const level = (e.level ?? null) as AvailabilityLevel | null;
      if (bp === null && level === null)
        throw new BadRequestException(`Ночь ${e.date}: сборщик не стирает значения, нужен процент или уровень`);
      return { date: e.date, bp, level };
    });
    const result = await this.repo.writeCollected(target, today, entries, {
      entityType: 'Competitor',
      entityId: target.id,
      action: 'market.occupancy.collected',
      after: { observedOn: today, source: 'AI_AGENT', entries },
    });
    return { ...result, observedOn: today };
  }
}
