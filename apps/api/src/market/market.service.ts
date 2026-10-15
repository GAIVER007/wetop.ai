import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MARKET_MAX_COMPETITORS,
  MARKET_MAX_DAYS,
  MarketInputError,
  buildMarketBoard,
  buildNightHistory,
  buildPriceBoard,
  isIsoDate,
  marketDates,
  parseCompetitorInput,
  parseOccupancyPercent,
  parsePriceInput,
  type MarketBoard,
  type NightHistory,
  type OwnDay,
  type PriceBoard,
} from '@pms/domain';
import { MARKET_REPOSITORY, type CompetitorRecord, type MarketRepository } from './market.repository';

/** Ценовая доска для JSON: деньги целыми строкой (BigInt в JSON не уходит), доля изменения десятыми процента */
export interface RatesView {
  today: string;
  from: string;
  days: number;
  currency: string | null;
  board: {
    competitors: Array<{
      id: string;
      cells: Array<{ date: string; priceMinor: string | null; source: string | null }>;
      avgMinor: string | null;
      changePermille: number | null;
      lastObservedOn: string | null;
    }>;
    market: Array<{ date: string; avgMinor: string | null; minMinor: string | null; maxMinor: string | null; count: number }>;
    summary: { marketAvgMinor: string | null; minMinor: string | null; maxMinor: string | null; competitorsWithData: number };
  };
}

const str = (v: bigint | null) => (v === null ? null : v.toString());
const serializeBoard = (b: PriceBoard): RatesView['board'] => ({
  competitors: b.competitors.map((c) => ({
    id: c.id,
    cells: c.cells.map((x) => ({ date: x.date, priceMinor: str(x.priceMinor), source: x.source })),
    avgMinor: str(c.avgMinor),
    changePermille: c.changePermille,
    lastObservedOn: c.lastObservedOn,
  })),
  market: b.market.map((m) => ({
    date: m.date,
    avgMinor: str(m.avgMinor),
    minMinor: str(m.minMinor),
    maxMinor: str(m.maxMinor),
    count: m.count,
  })),
  summary: {
    marketAvgMinor: str(b.summary.marketAvgMinor),
    minMinor: str(b.summary.minMinor),
    maxMinor: str(b.summary.maxMinor),
    competitorsWithData: b.summary.competitorsWithData,
  },
});

/** Своя загрузка по ночам: клетки календаря (занято, свободно, блок), как «Аналитика → Загрузка» */
export interface OwnOccupancySource {
  ownDays(from: string, to: string): Promise<Record<string, OwnDay>>;
}
export const OWN_OCCUPANCY = Symbol('OWN_OCCUPANCY');

export interface MarketView {
  today: string;
  from: string;
  days: number;
  board: MarketBoard;
  /** Действующие конкуренты: поля для формы правки */
  competitors: CompetitorRecord[];
}

/** Сколько назад можно вписать снимок ночи и как далеко вперёд (ночь прошлая: для сверки, будущая: спрос) */
const PAST_DAYS = 30;
const FUTURE_DAYS = 365;
const MAX_ENTRIES = 62;

const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function rule<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof MarketInputError) throw new BadRequestException(e.message);
    throw e;
  }
}

/** Раздел «Загрузка конкурентов» (ADR-142, DATA_MODEL §23). Правила расчёта: в домене. */
@Injectable()
export class MarketService {
  constructor(
    @Inject(MARKET_REPOSITORY) private readonly repo: MarketRepository,
    @Inject(OWN_OCCUPANCY) private readonly own: OwnOccupancySource,
  ) {}

  /** Окно запроса: с даты, число дней, «на дату» снимка и сравнение. Общее у загрузки и цен */
  private async window(q: {
    from?: string | undefined;
    days?: string | undefined;
    asOf?: string | undefined;
    compare?: string | undefined;
  }) {
    const today = await this.repo.today();
    const from = q.from ?? today;
    if (!isIsoDate(from)) throw new BadRequestException('from: дата YYYY-MM-DD');
    const days = q.days === undefined ? 14 : Number(q.days);
    if (!Number.isInteger(days) || days < 1 || days > MARKET_MAX_DAYS)
      throw new BadRequestException(`days: от 1 до ${MARKET_MAX_DAYS}`);
    const asOf = q.asOf ?? today;
    if (!isIsoDate(asOf)) throw new BadRequestException('asOf: дата YYYY-MM-DD');
    if (asOf > today) throw new BadRequestException('Дата снимка не может быть позже сегодня');
    const compareDays = q.compare === undefined ? 1 : Number(q.compare);
    if (![0, 1, 7].includes(compareDays))
      throw new BadRequestException('compare: 0 (без сравнения), 1 (вчера) или 7 (неделю назад)');
    return { today, from, days, asOf, compareDays };
  }

  async occupancy(q: {
    from?: string | undefined;
    days?: string | undefined;
    asOf?: string | undefined;
    compare?: string | undefined;
  }): Promise<MarketView> {
    const { today, from, days, asOf, compareDays } = await this.window(q);

    const dates = marketDates(from, days);
    const to = dates.at(-1)!;
    const all = await this.repo.competitors();
    const competitors = all.filter((c) => c.active);
    const readings = await this.repo.readings(from, to, asOf);
    const ownDays = await this.own.ownDays(from, to);
    const board = buildMarketBoard({
      dates,
      asOf,
      compareDays,
      own: ownDays,
      competitors: competitors.map((c) => ({
        id: c.id,
        name: c.name,
        distanceM: c.distanceM,
        unitsTotal: c.unitsTotal,
        url: c.url,
      })),
      readings,
    });
    return { today, from, days, board, competitors };
  }

  /** Цены конкурентов по ночам (DATA_MODEL §23.1): те же окно и правило «на дату», что у загрузки */
  async rates(q: {
    from?: string | undefined;
    days?: string | undefined;
    asOf?: string | undefined;
    compare?: string | undefined;
  }): Promise<RatesView> {
    const { today, from, days, asOf, compareDays } = await this.window(q);
    const dates = marketDates(from, days);
    const competitors = (await this.repo.competitors()).filter((c) => c.active);
    const readings = await this.repo.rateReadings(from, dates.at(-1)!, asOf);
    const board = buildPriceBoard({ dates, asOf, compareDays, competitors, readings });
    return { today, from, days, currency: board.currency ?? (await this.repo.currency()), board: serializeBoard(board) };
  }

  /** История одной ночи по дням снимков (M1.2): как заполнялись соседи */
  async night(date?: string): Promise<NightHistory> {
    if (!isIsoDate(date)) throw new BadRequestException('date: ночь YYYY-MM-DD');
    const competitors = (await this.repo.competitors()).filter((c) => c.active);
    const readings = await this.repo.nightReadings(date);
    return buildNightHistory({
      stayDate: date,
      competitors: competitors.map((c) => ({
        id: c.id,
        name: c.name,
        distanceM: c.distanceM,
        unitsTotal: c.unitsTotal,
        url: c.url,
      })),
      readings,
    });
  }

  private async assertRoom(): Promise<void> {
    const active = (await this.repo.competitors()).filter((c) => c.active).length;
    if (active >= MARKET_MAX_COMPETITORS)
      throw new ConflictException(
        `В списке уже ${MARKET_MAX_COMPETITORS} конкурентов: уберите одного, чтобы добавить нового`,
      );
  }

  async createCompetitor(dto: Record<string, unknown>): Promise<CompetitorRecord> {
    const input = rule(() => parseCompetitorInput(dto ?? {}, 'create'));
    await this.assertRoom();
    const id = await rule(() =>
      this.repo.createCompetitor({ ...input, name: input.name! }, {
        entityType: 'Competitor',
        action: 'market.competitor.created',
        after: { ...input },
      }),
    );
    return (await this.repo.competitors()).find((c) => c.id === id)!;
  }

  async updateCompetitor(id: string, dto: Record<string, unknown>): Promise<CompetitorRecord> {
    const patch: ReturnType<typeof parseCompetitorInput> & { active?: boolean } = rule(() =>
      parseCompetitorInput(dto ?? {}, 'update'),
    );
    if (dto?.active !== undefined) {
      if (typeof dto.active !== 'boolean')
        throw new BadRequestException('active: true или false');
      patch.active = dto.active;
    }
    if (Object.keys(patch).length === 0)
      throw new BadRequestException('Нечего менять: название, расстояние, номера, ссылка, заметка или active');
    const current = (await this.repo.competitors()).find((c) => c.id === id);
    if (!current) throw new NotFoundException('Конкурент не найден');
    if (patch.active === true && !current.active) await this.assertRoom();
    const found = await rule(() =>
      this.repo.updateCompetitor(id, patch, {
        entityType: 'Competitor',
        entityId: id,
        action: patch.active === false ? 'market.competitor.archived' : 'market.competitor.updated',
        after: { ...patch },
      }),
    );
    if (!found) throw new NotFoundException('Конкурент не найден');
    return (await this.repo.competitors()).find((c) => c.id === id)!;
  }

  /** Снимки сегодняшнего дня объекта: значение на ночь заменяет прежнее за сегодня, пустое снимает его */
  async writeOccupancy(id: string, dto: { entries?: unknown }): Promise<{ saved: number; cleared: number }> {
    if (!Array.isArray(dto?.entries) || dto.entries.length === 0)
      throw new BadRequestException('entries: список { date, percent }');
    if (dto.entries.length > MAX_ENTRIES)
      throw new BadRequestException(`Не больше ${MAX_ENTRIES} ночей за раз`);
    const today = await this.repo.today();
    const earliest = plusDays(today, -PAST_DAYS);
    const latest = plusDays(today, FUTURE_DAYS);
    const seen = new Set<string>();
    const entries = dto.entries.map((raw) => {
      const e = (raw ?? {}) as { date?: unknown; percent?: unknown };
      if (!isIsoDate(e.date)) throw new BadRequestException('date: дата ночи YYYY-MM-DD');
      if (e.date < earliest || e.date > latest)
        throw new BadRequestException(
          `Ночь ${e.date}: можно от ${earliest} до ${latest} (30 дней назад, год вперёд)`,
        );
      if (seen.has(e.date)) throw new BadRequestException(`Ночь ${e.date} указана дважды`);
      seen.add(e.date);
      const bp = rule(() => parseOccupancyPercent(e.percent));
      return { date: e.date, bp };
    });
    const ok = await this.repo.writeReadings(id, today, entries, 'MANUAL', {
      entityType: 'Competitor',
      entityId: id,
      action: 'market.occupancy.recorded',
      after: { observedOn: today, entries },
    });
    if (!ok) throw new NotFoundException('Конкурент не найден или убран из списка');
    return {
      saved: entries.filter((e) => e.bp !== null).length,
      cleared: entries.filter((e) => e.bp === null).length,
    };
  }

  /** Цены сегодняшнего дня объекта в его валюте: значение заменяет прежнее за сегодня, пустое снимает его */
  async writeRates(id: string, dto: { entries?: unknown }): Promise<{ saved: number; cleared: number }> {
    if (!Array.isArray(dto?.entries) || dto.entries.length === 0)
      throw new BadRequestException('entries: список { date, price }');
    if (dto.entries.length > MAX_ENTRIES) throw new BadRequestException(`Не больше ${MAX_ENTRIES} ночей за раз`);
    const today = await this.repo.today();
    const earliest = plusDays(today, -PAST_DAYS);
    const latest = plusDays(today, FUTURE_DAYS);
    const seen = new Set<string>();
    const entries = dto.entries.map((raw) => {
      const e = (raw ?? {}) as { date?: unknown; price?: unknown };
      if (!isIsoDate(e.date)) throw new BadRequestException('date: дата ночи YYYY-MM-DD');
      if (e.date < earliest || e.date > latest)
        throw new BadRequestException(
          `Ночь ${e.date}: можно от ${earliest} до ${latest} (30 дней назад, год вперёд)`,
        );
      if (seen.has(e.date)) throw new BadRequestException(`Ночь ${e.date} указана дважды`);
      seen.add(e.date);
      return { date: e.date, priceMinor: rule(() => parsePriceInput(e.price)) };
    });
    const currency = await this.repo.currency();
    const ok = await this.repo.writeRates(id, today, currency, entries, 'MANUAL', {
      entityType: 'Competitor',
      entityId: id,
      action: 'market.rates.recorded',
      after: {
        observedOn: today,
        currency,
        entries: entries.map((e) => ({ date: e.date, priceMinor: str(e.priceMinor) })),
      },
    });
    if (!ok) throw new NotFoundException('Конкурент не найден или убран из списка');
    return {
      saved: entries.filter((e) => e.priceMinor !== null).length,
      cleared: entries.filter((e) => e.priceMinor === null).length,
    };
  }
}
