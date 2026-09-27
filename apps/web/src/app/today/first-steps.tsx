import Link from 'next/link';
import { ApiError } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { hotelApi } from '../../lib/hotel-api';
import { mayAccess } from '../../lib/navigation';
import { Badge, Panel } from '../../components/ui';
import { firstStepsFor, type Step } from './first-steps-list';

/** Слово состояния шага — как у шагов ИИ-продавца (DESIGN.md §8) */
const STATE: Record<Step['state'], { label: string; tone: 'ok' | 'info' | 'neutral' }> = {
  done: { label: 'готово', tone: 'ok' },
  next: { label: 'следующий шаг', tone: 'info' },
  optional: { label: 'по желанию', tone: 'neutral' },
};

/**
 * «Первые шаги» (ТЗ `plans/ux-retention-2026-09-26.md` п. 2.1, DESIGN.md §8): пока в объекте нет ни одной брони,
 * Главная ведёт к первой. Панель уходит сама после первой брони; сбой запроса — панели нет, Главная не ломается
 * из-за подсказки.
 */
export async function FirstSteps() {
  const [state, settings, desk] = await Promise.all([
    hotelApi.firstSteps().catch((error: unknown) => {
      if (error instanceof ApiError) return null;
      throw error;
    }),
    // те же настройки, что у шапки и гейта (кэш на рендер) — отдельного рейса нет
    hotelApi.settings().catch((error: unknown) => {
      if (error instanceof ApiError) return null;
      throw error;
    }),
    deskShell(),
  ]);
  if (!state || state.hasReservations) return null;
  // шаг — тому, у кого есть право (ADR-101): администратор отеля не настраивает и сотрудников не зовёт
  const steps = firstStepsFor(settings?.needsOnboarding === true).filter(
    (step) => !step.requires || mayAccess(desk.access, step.requires),
  );
  return (
    <Panel className="first-steps" data-testid="first-steps" aria-labelledby="first-steps-title">
      <h2 id="first-steps-title" className="first-steps__title">
        Первые шаги
      </h2>
      <ol className="first-steps__list">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="first-steps__item"
            aria-current={step.state === 'next' ? 'step' : undefined}
          >
            <span className="first-steps__num" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="first-steps__body">
              <b className="first-steps__name">{step.title}</b>
              <span className="first-steps__hint">{step.hint}</span>
            </div>
            <Badge tone={STATE[step.state].tone}>{STATE[step.state].label}</Badge>
            {step.action && (
              <Link
                href={step.action.href}
                className={step.state === 'next' ? 'btn' : 'btn btn--secondary btn--sm'}
              >
                {step.action.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
