import 'reflect-metadata';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  DASHBOARD_FUNDS,
  MAX_PERIOD_DAYS,
  buildChannelEfficiency,
  buildDashboard,
  buildUnitStats,
  isIsoDate,
  periodNights,
  previousPeriod,
  type ChannelEfficiency,
  type ChannelEfficiencySort,
  type DashboardFund,
  type DashboardPeriod,
  type UnitStats,
} from '@pms/domain';
import { channex } from '@pms/integrations';
import { DASHBOARD_REPOSITORY, type DashboardRepository } from './dashboard.repository';

export interface DashboardView {
  current: DashboardPeriod;
  /** Тот же расчёт за предыдущий отрезок той же длины — сравнение на реальных числах */
  previous: DashboardPeriod;
}

/** Главная собственника: показатели за период из шахматки и счетов (срез 14). Правил здесь нет. */
@Injectable()
export class DashboardService {
  constructor(@Inject(DASHBOARD_REPOSITORY) private readonly repo: DashboardRepository) {}

  /** Общие проверки периода и типа фонда — у сводки и «По номерам» они одинаковые */
  private checked(from?: string, to?: string, fund: string = 'all'): DashboardFund {
    if (!isIsoDate(from) || !isIsoDate(to))
      throw new BadRequestException('from и to — даты YYYY-MM-DD');
    if (!DASHBOARD_FUNDS.includes(fund as DashboardFund))
      throw new BadRequestException('fund — all, rooms или beds');
    if (to < from) throw new BadRequestException('to не может быть раньше from');
    if (periodNights(from, to) > MAX_PERIOD_DAYS)
      throw new BadRequestException(`Период не больше ${MAX_PERIOD_DAYS} дней`);
    return fund as DashboardFund;
  }

  /**
   * «По номерам» (REP3): те же клетки шахматки, что у сводки, до единицы — итог вкладки сходится
   * с «Загрузкой» по построению. Один рейс за доской, денег нет (Q-251).
   */
  async units(from?: string, to?: string, fund: string = 'all'): Promise<UnitStats> {
    const f = this.checked(from, to, fund);
    const board = await this.repo.board(from!, to!);
    const unassignedStays = Object.values(board.unassignedByCategory).reduce((a, b) => a + b, 0);
    return buildUnitStats(
      {
        from: from!,
        to: to!,
        nights: board.days.length,
        units: board.units,
        unassignedStays,
      },
      f,
    );
  }

  /**
   * «Эффективность каналов» (ADR-141): доход, ночи и средняя стоимость по каналу за период заезда, по желанию —
   * то же за период сравнения (любой, по умолчанию его выбирает стойка). `empty` добавляет каналы объекта без броней
   * нулевыми строками. Правило счёта: у «Обзора» (Q-208, Q-209), в домене.
   */
  async channels(q: {
    from?: string;
    to?: string;
    compareFrom?: string;
    compareTo?: string;
    channel?: string;
    sort?: string;
    empty?: boolean;
  }): Promise<{ current: ChannelEfficiency; previous: ChannelEfficiency | null }> {
    this.checked(q.from, q.to);
    if ((q.compareFrom === undefined) !== (q.compareTo === undefined))
      throw new BadRequestException('Период сравнения: обе даты, compareFrom и compareTo');
    if (q.compareFrom !== undefined) this.checked(q.compareFrom, q.compareTo);
    const sort = q.sort ?? 'revenue';
    if (!['revenue', 'nights', 'adr'].includes(sort))
      throw new BadRequestException('sort: revenue, nights или adr');
    if (q.channel !== undefined && q.channel.length > 80)
      throw new BadRequestException('channel: не длиннее 80 знаков');
    const opts = {
      sort: sort as ChannelEfficiencySort,
      ...(q.channel ? { channel: q.channel } : {}),
      ...(q.empty
        ? { knownChannels: [...channex.KNOWN_CHANNEL_KEYS].map((k) => channex.otaChannelLabel(k)) }
        : {}),
    };
    const current = buildChannelEfficiency(
      await this.repo.stays(q.from!, q.to!),
      q.from!,
      q.to!,
      opts,
    );
    const previous =
      q.compareFrom !== undefined
        ? buildChannelEfficiency(
            await this.repo.stays(q.compareFrom, q.compareTo!),
            q.compareFrom,
            q.compareTo!,
            opts,
          )
        : null;
    return { current, previous };
  }

  /** `fund` — тип фонда (Аналитика v2, AN1): номера и койки считаются раздельно, оба отрезка одним типом */
  async dashboard(
    from?: string,
    to?: string,
    fund: string = 'all',
    category?: string,
  ): Promise<DashboardView> {
    this.checked(from, to, fund);
    if (category !== undefined && (category.length === 0 || category.length > 64))
      throw new BadRequestException('category: код категории, не длиннее 64 знаков');
    const prev = previousPeriod(from!, to!);
    // Последовательно: у API пул на 5 соединений, а шахматка сама ходит в базу в несколько запросов
    const current = await this.period(from!, to!, fund as DashboardFund, category);
    const previous = await this.period(prev.from, prev.to, fund as DashboardFund, category);
    return { current, previous };
  }

  private async period(
    from: string,
    to: string,
    fund: DashboardFund,
    category?: string,
  ): Promise<DashboardPeriod> {
    // Шахматка сама ходит в базу в четыре запроса — её держим отдельно; остальные четыре выборки
    // друг от друга не зависят и идут одновременно. Было десять рейсов подряд на один экран, и на
    // задержках сети до Сингапура это стоило секунд (разбор «всё тормозит», 16.09.2026).
    const board = await this.repo.board(from, to);
    if (category !== undefined && !board.categories.some((c) => c.code === category))
      throw new BadRequestException('category: такой категории в объекте нет');
    const [stays, charges, payments, refundsMinor] = await Promise.all([
      this.repo.stays(from, to),
      this.repo.charges(from, to),
      this.repo.payments(from, to),
      this.repo.refundsMinor(from, to),
    ]);
    return buildDashboard(
      {
        from,
        to,
        categories: board.categories,
        days: board.days,
        unassignedByCategory: board.unassignedByCategory,
        stays,
        charges,
        payments,
        refundsMinor,
      },
      fund,
      category !== undefined ? { category } : {},
    );
  }
}
