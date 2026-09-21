import { cache } from 'react';
import { ApiError, chessboardApi, deskApi } from '../../lib/api';
import { Alert, Panel } from '../../components/ui';
import { AttentionSummary, DayAttention } from './day-attention';
import { QuickActions } from './dashboard-widgets';
import { DeskStrip } from './desk-strip';

/**
 * Полоса стойки и задачи смены — своим куском: показателям за период они не нужны, и ждать их незачем.
 * Отказ API называется словами, а не пустым экраном (замечание владельца 16.09.2026).
 */
const loadDeskDay = cache((date: string) =>
  deskApi.today(date).catch((error: unknown) => {
    if (error instanceof ApiError) return error;
    throw error;
  }),
);

/** Сводка сверху и полоса стойки используют один запрос в рамках серверного рендера. */
export async function AttentionSection({ date }: { date: string }) {
  const day = await loadDeskDay(date);
  if (day instanceof ApiError) return <span className="muted">Задачи дня не загрузились</span>;
  return <AttentionSummary day={day} date={date} />;
}

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
  const [day, board] = result;
  return (
    <>
      <DeskStrip day={day} board={board} today={today} />
      <div className="dash-grid dash-grid--desk">
        <QuickActions day={day} />
        <aside aria-label="Задачи и размещение">
          <DayAttention day={day} />
        </aside>
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
