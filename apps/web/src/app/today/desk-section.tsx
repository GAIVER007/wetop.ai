import { cache } from 'react';
import { ApiError, chessboardApi, deskApi } from '../../lib/api';
import { Alert, Panel } from '../../components/ui';
import { DayAttention } from './day-attention';
import { QuickActions } from './dashboard-widgets';
import { DeskStrip } from './desk-strip';
import { DayEvents } from './day-events';
import { CarePanel, FundPanel } from './fund-care';
import { loadGuardStatus } from './guard-status';

/**
 * Операционная часть Главной (A1, ADR-103): полоса «На стойке» — верхний ряд показателей дня,
 * под ней «Требуют внимания» (шире, слева) рядом с «Быстрыми действиями». A2 (ADR-105): ниже —
 * заезды и выезды дня, номерной фонд, уборка и ремонт — на тех же дне и шахматке.
 * Отказ API называется словами, а не пустым экраном (замечание владельца 16.09.2026).
 */
export const loadDeskDay = cache((date: string) =>
  deskApi.today(date).catch((error: unknown) => {
    if (error instanceof ApiError) return error;
    throw error;
  }),
);

export async function DeskSection({ date, today }: { date: string; today: string }) {
  // Оба чтения зависят только от даты; дополнительное ожидание дня здесь не нужно.
  const result = await Promise.all([
    loadDeskDay(date).then((day) => {
      if (day instanceof ApiError) throw day;
      return day;
    }),
    chessboardApi.board(date, date).catch((error: unknown) => {
      if (error instanceof ApiError) return null;
      throw error;
    }),
    // инциденты сторожа — в очередь «Требуют внимания» (A3); тот же закэшированный запрос, что у «Систем»
    loadGuardStatus(),
  ]).catch((error: unknown) => {
    if (error instanceof ApiError) return error;
    throw error;
  });
  // Отказ дня показываем сразу, не дожидаясь медленной шахматки.
  if (result instanceof ApiError)
    return (
      <Alert tone="warning" boxed data-testid="desk-error">
        Стойка на {date} не загрузилась: {result.message} Обновите страницу.
      </Alert>
    );
  const [day, board, guard] = result;
  const isToday = date === today;
  return (
    <>
      <DeskStrip day={day} board={board} today={today} />
      <div className="dash-grid dash-grid--desk">
        <DayAttention day={day} board={board} guard={guard} isToday={isToday} />
        <QuickActions day={day} />
      </div>
      {/* A2 (план `plans/today-a2-2026-09-28.md`): день уже загружен — новых вызовов у этих блоков нет */}
      <DayEvents day={day} />
      <div className="dash-grid dash-grid--events">
        <FundPanel day={day} board={board} isToday={isToday} />
        <CarePanel date={date} board={board} isToday={isToday} />
      </div>
    </>
  );
}

/** Пока грузится стойка: без `data-testid` готового экрана — их читают сверки. */
export function DeskSkeleton() {
  return (
    <Panel title="На стойке">
      <p className="muted" data-testid="desk-loading">
        Смотрим, что на стойке…
      </p>
    </Panel>
  );
}
