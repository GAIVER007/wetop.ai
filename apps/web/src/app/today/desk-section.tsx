import { cache } from 'react';
import { ApiError, chessboardApi, deskApi } from '../../lib/api';
import { Alert, Panel } from '../../components/ui';
import { AttentionSummary, DayAttention } from './day-attention';
import { QuickActions } from './dashboard-widgets';
import { DeskStrip } from './desk-strip';

/**
 * День стойки читается один раз на показ экрана, хотя нужен двум кускам (сводка «Требуют внимания»
 * в шапке и полоса стойки): `cache` React склеивает вызовы внутри одного рендера, и сторож
 * `tests/ui/requests.spec.ts` («путь с данными — один запрос на показ») остаётся в силе.
 */
const deskDay = cache((date: string) =>
  deskApi.today(date).catch((error: unknown) => {
    if (error instanceof ApiError) return error;
    throw error;
  }),
);

/** Сводка «Требуют внимания: N» в шапке главной; при отказе стойки молчит — отказ назовёт полоса ниже. */
export async function AttentionSummarySection({ date }: { date: string }) {
  const day = await deskDay(date);
  if (day instanceof ApiError) return null;
  return <AttentionSummary day={day} date={date} />;
}

/**
 * Полоса стойки и задачи смены — своим куском: показателям за период они не нужны, и ждать их незачем.
 * Отказ API называется словами, а не пустым экраном (замечание владельца 16.09.2026).
 */
export async function DeskSection({ date, today }: { date: string; today: string }) {
  const day = await deskDay(date);
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
