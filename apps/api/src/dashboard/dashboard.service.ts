import 'reflect-metadata';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  DASHBOARD_FUNDS,
  MAX_PERIOD_DAYS,
  buildDashboard,
  isIsoDate,
  periodNights,
  previousPeriod,
  type DashboardFund,
  type DashboardPeriod,
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

  /** `fund` — тип фонда (Аналитика v2, AN1): номера и койки считаются раздельно, оба отрезка одним типом */
  async dashboard(from?: string, to?: string, fund: string = 'all'): Promise<DashboardView> {
    const period = this.checkPeriod(from, to, fund);
    const prev = previousPeriod(period.from, period.to);
    // Последовательно: у API пул на 5 соединений, а шахматка сама ходит в базу в несколько запросов
    const current = await this.period(period.from, period.to, period.fund);
    const previous = await this.period(prev.from, prev.to, period.fund);
    return { current, previous };
  }

  /** Проверка запроса периода, одна для «Обзора» и для сводки по филиалам (Platform P3) */
  checkPeriod(from?: string, to?: string, fund: string = 'all'): { from: string; to: string; fund: DashboardFund } {
    if (!isIsoDate(from) || !isIsoDate(to))
      throw new BadRequestException('from и to — даты YYYY-MM-DD');
    if (!DASHBOARD_FUNDS.includes(fund as DashboardFund))
      throw new BadRequestException('fund — all, rooms или beds');
    if (to < from) throw new BadRequestException('to не может быть раньше from');
    if (periodNights(from, to) > MAX_PERIOD_DAYS)
      throw new BadRequestException(`Период не больше ${MAX_PERIOD_DAYS} дней`);
    return { from, to, fund: fund as DashboardFund };
  }

  /** Показатели одного отрезка по объекту текущего scope, сводка по филиалам зовёт его в scope каждого филиала */
  async period(from: string, to: string, fund: DashboardFund): Promise<DashboardPeriod> {
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
