import 'reflect-metadata';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  DASHBOARD_FUNDS,
  MAX_PERIOD_DAYS,
  buildDashboard,
  buildUnitStats,
  isIsoDate,
  periodNights,
  previousPeriod,
  type DashboardFund,
  type DashboardPeriod,
  type UnitStats,
} from '@pms/domain';
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

  /** `fund` — тип фонда (Аналитика v2, AN1): номера и койки считаются раздельно, оба отрезка одним типом */
  async dashboard(from?: string, to?: string, fund: string = 'all'): Promise<DashboardView> {
    this.checked(from, to, fund);
    const prev = previousPeriod(from!, to!);
    // Последовательно: у API пул на 5 соединений, а шахматка сама ходит в базу в несколько запросов
    const current = await this.period(from!, to!, fund as DashboardFund);
    const previous = await this.period(prev.from, prev.to, fund as DashboardFund);
    return { current, previous };
  }

  private async period(from: string, to: string, fund: DashboardFund): Promise<DashboardPeriod> {
    // Шахматка сама ходит в базу в четыре запроса — её держим отдельно; остальные четыре выборки
    // друг от друга не зависят и идут одновременно. Было десять рейсов подряд на один экран, и на
    // задержках сети до Сингапура это стоило секунд (разбор «всё тормозит», 16.09.2026).
    const board = await this.repo.board(from, to);
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
    );
  }
}
