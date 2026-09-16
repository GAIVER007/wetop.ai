import 'reflect-metadata';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  MAX_PERIOD_DAYS,
  buildDashboard,
  isIsoDate,
  periodNights,
  previousPeriod,
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

  async dashboard(from?: string, to?: string): Promise<DashboardView> {
    if (!isIsoDate(from) || !isIsoDate(to))
      throw new BadRequestException('from и to — даты YYYY-MM-DD');
    if (to < from) throw new BadRequestException('to не может быть раньше from');
    if (periodNights(from, to) > MAX_PERIOD_DAYS)
      throw new BadRequestException(`Период не больше ${MAX_PERIOD_DAYS} дней`);
    const prev = previousPeriod(from, to);
    // Последовательно: у API пул на 5 соединений, а шахматка сама ходит в базу в несколько запросов
    const current = await this.period(from, to);
    const previous = await this.period(prev.from, prev.to);
    return { current, previous };
  }

  private async period(from: string, to: string): Promise<DashboardPeriod> {
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
    return buildDashboard({
      from,
      to,
      categories: board.categories,
      days: board.days,
      unassigned: board.unassigned,
      stays,
      charges,
      payments,
      refundsMinor,
    });
  }
}
