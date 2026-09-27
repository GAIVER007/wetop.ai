/**
 * Шаги панели «Первые шаги» на Главной (ТЗ `plans/ux-retention-2026-09-26.md` п. 2.1; «Заполнить позже» — ADR-100).
 * Отдельно от разметки, чтобы список проверялся тестом без сервера.
 */
export type Step = {
  title: string;
  state: 'done' | 'next' | 'optional';
  hint: string;
  action?: { href: string; label: string };
};

const READY_STEPS: Step[] = [
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
  },
];

/** Онбординг отложен («Заполнить позже», ADR-100): сначала номера и цены, без них брони не на что ставить. */
const SETUP_STEP: Step = {
  title: 'Настройте номера и цены',
  state: 'next',
  hint: 'Категории, сколько в них мест и цена за ночь — шахматка и тариф заведутся сами.',
  action: { href: '/onboarding', label: 'Настроить отель' },
};

/** Шаги панели: пока номеров нет, первая бронь ждёт настройки — её шаг становится «по желанию» без кнопки. */
export function firstStepsFor(needsOnboarding: boolean): Step[] {
  if (!needsOnboarding) return READY_STEPS;
  return [
    SETUP_STEP,
    ...READY_STEPS.slice(1).map((step, index) =>
      index === 0 ? { title: step.title, state: 'optional' as const, hint: step.hint } : step,
    ),
  ];
}
