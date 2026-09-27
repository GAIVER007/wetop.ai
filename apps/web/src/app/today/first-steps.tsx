import Link from 'next/link';
import type { Permission } from '@pms/domain';
import { ApiError } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { hotelApi } from '../../lib/hotel-api';
import { mayAccess } from '../../lib/navigation';
import { Badge, Panel } from '../../components/ui';

type Step = {
  title: string;
  state: 'done' | 'next' | 'optional';
  hint: string;
  action?: { href: string; label: string };
  /** Шаг — тому, у кого есть право (ADR-100): администратору приглашать сотрудников нельзя */
  requires?: Permission;
};

/** Слово состояния шага — как у шагов ИИ-продавца (DESIGN.md §8) */
const STATE: Record<Step['state'], { label: string; tone: 'ok' | 'info' | 'neutral' }> = {
  done: { label: 'готово', tone: 'ok' },
  next: { label: 'следующий шаг', tone: 'info' },
  optional: { label: 'по желанию', tone: 'neutral' },
};

const STEPS: Step[] = [
  { title: 'Отель запущен', state: 'done', hint: 'Номера, цены и шахматка готовы.' },
  {
    title: 'Создайте первую бронь',
    state: 'next',
    hint: 'Даты, категория и имя гостя — остальное можно дописать потом.',
    action: { href: '/reservations/new', label: 'Создать первую бронь' },
  },
  {
    title: 'Заселите гостя и примите оплату',
    state: 'optional',
    hint: 'Кнопки «Заселить» и «Принять оплату» — в карточке брони.',
  },
  {
    title: 'Пригласите сотрудников',
    state: 'optional',
    hint: 'Каждый получит свою почту для входа и задаст пароль сам.',
    action: { href: '/login', label: 'Пригласить' },
    requires: 'staff',
  },
];

/**
 * «Первые шаги» (ТЗ `plans/ux-retention-2026-09-26.md` п. 2.1, DESIGN.md §8): пока в объекте нет ни одной брони,
 * Главная ведёт к первой. Панель уходит сама после первой брони; сбой запроса — панели нет, Главная не ломается
 * из-за подсказки.
 */
export async function FirstSteps() {
  const [state, desk] = await Promise.all([
    hotelApi.firstSteps().catch((error: unknown) => {
      if (error instanceof ApiError) return null;
      throw error;
    }),
    deskShell(),
  ]);
  if (!state || state.hasReservations) return null;
  const steps = STEPS.filter((step) => !step.requires || mayAccess(desk.access, step.requires));
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
