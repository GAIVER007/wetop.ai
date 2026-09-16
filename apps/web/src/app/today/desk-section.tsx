import { ApiError, chessboardApi, deskApi } from '../../lib/api';
import { Alert, Panel } from '../../components/ui';
import { DayAttention } from './day-attention';
import { QuickActions } from './dashboard-widgets';
import { DeskStrip } from './desk-strip';

/**
 * Полоса стойки и задачи смены — своим куском: показателям за период они не нужны, и ждать их незачем.
 * Отказ API называется словами, а не пустым экраном (замечание владельца 16.09.2026).
 */
export async function DeskSection({ date, today }: { date: string; today: string }) {
  const day = await deskApi.today(date).catch((error: unknown) => {
    if (error instanceof ApiError) return error;
    throw error;
  });
  if (day instanceof ApiError)
    return (
      <Alert tone="warning" boxed data-testid="desk-error">
        Стойка на {date} не загрузилась: {day.message} Обновите страницу.
      </Alert>
    );
  const board = await chessboardApi.board(date, date).catch(() => null);
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
