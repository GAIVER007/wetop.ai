import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { dateRange } from '@pms/domain';
import { DashboardService } from './dashboard.service';
import type { DashboardRepository } from './dashboard.repository';

/**
 * Главная собирала пять выборок периода одну за другой, и так дважды (текущий отрезок и предыдущий):
 * десять рейсов в базу подряд. База в Сингапуре, стойка в Алматы — на одних задержках сети набегали
 * секунды на пустом месте (разбор «всё тормозит», 16.09.2026). Выборки друг от друга не зависят:
 * внутри периода они идут одновременно, периоды по-прежнему один за другим (пул API — 5 соединений).
 *
 * Проверка честная: поддельный репозиторий не отвечает, пока не соберутся все четыре запроса периода.
 * На прежнем, последовательном коде тест виснет и падает по таймауту.
 */
function barrier(n: number) {
  let arrived = 0;
  let release = () => {};
  const open = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    async wait(): Promise<void> {
      arrived += 1;
      if (arrived >= n) release();
      await open;
    },
    arrived: () => arrived,
  };
}

/** Четыре выборки, кроме шахматки, обязаны идти одновременно */
function repoWithBarrier(gate: ReturnType<typeof barrier>): DashboardRepository {
  return {
    async board(from, to) {
      return {
        categories: [{ code: 'ROOM', name: 'Двухместная', units: 1, kind: 'ROOM' }],
        days: dateRange(from, to).map((date) => ({
          date,
          occupied: 0,
          free: 1,
          blocked: 0,
          byCategory: {},
        })),
        unassignedByCategory: {},
      };
    },
    async stays() {
      await gate.wait();
      return [];
    },
    async charges() {
      await gate.wait();
      return [];
    },
    async payments() {
      await gate.wait();
      return [];
    },
    async refundsMinor() {
      await gate.wait();
      return 0n;
    },
  };
}

describe('главная: выборки периода', () => {
  it('деньги, проживания и возвраты запрашиваются одновременно, а не по очереди', async () => {
    const gate = barrier(4);
    const service = new DashboardService(repoWithBarrier(gate));
    const view = await service.dashboard('2026-09-01', '2026-09-07');
    expect(view.current.from).toBe('2026-09-01');
    // барьер открылся дважды по четыре: текущий период и предыдущий
    expect(gate.arrived()).toBe(8);
  }, 5_000);
});
