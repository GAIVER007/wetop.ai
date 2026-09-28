/**
 * Шаги обучения в стойке (plans/site-auth-dialog-tour-2026-09-27.md, Д4, ADR-100). Отдельно от разметки, чтобы
 * список и правила выбора проверялись тестом без браузера.
 *
 * Шаг привязан к элементу через `data-tour="<target>"`. `required` — шаг показывается всегда: если элемента нет на
 * экране (телефон, меню свёрнуто), окно встаёт по центру без подсветки. Необязательный шаг без элемента пропускается:
 * так закрытый по доступу раздел (ADR-083) не описывается тому, кто его не видит.
 */
export interface TourStep {
  target: string | null;
  title: string;
  text: string;
  required?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: 'Добро пожаловать в WETOP',
    text: 'Минута на знакомство: покажем, где что лежит. Пропустить можно в любой момент — вернуться к обучению потом можно из меню профиля.',
    required: true,
  },
  {
    target: 'search',
    title: 'Поиск по всей стойке',
    text: 'Гость, номер брони, номер или койка — начните печатать. Открывается и с клавиатуры: ⌘ K на Mac, Ctrl K на Windows.',
    required: true,
  },
  {
    target: 'section-guests',
    title: 'Работа с гостями',
    text: 'Главная — день смены: заезды, выезды и что требует внимания. Шахматка — все номера и койки по дням. Брони и Гости — списки с поиском и отбором.',
    required: true,
  },
  {
    target: 'quick-actions',
    title: 'Быстрые действия',
    text: 'Новая бронь, заселение и оплата — в один щелчок с Главной.',
  },
  {
    target: 'section-inventory',
    title: 'Номерной фонд',
    text: 'Номера и койки, категории и доступность: здесь меняется то, что вы завели при настройке.',
  },
  {
    target: 'section-sales',
    title: 'Продажи',
    text: 'Тарифы и цены по дням, каналы продаж, сайт с онлайн-бронированием и ИИ-продавец.',
  },
  {
    target: 'section-finance',
    title: 'Финансы и отчёты',
    text: 'Оплаты за период и статистика загрузки.',
  },
  {
    target: 'section-settings',
    title: 'Настройки',
    text: 'Сведения о гостинице, правила отмены, услуги и интеграции.',
  },
  {
    target: 'trial',
    title: 'Пробный период',
    text: 'Здесь видно, сколько дней пробного периода осталось.',
  },
  {
    target: 'profile',
    title: 'Профиль и выход',
    text: 'Профиль, тема и выход — здесь же. «Обучение: как устроена стойка» в этом меню снова покажет эти подсказки. Вопросы — в чат помощника справа внизу.',
    required: true,
  },
];

export interface ShownStep extends TourStep {
  /** Элемент на экране — подсвечиваем его; нет — окно по центру */
  highlight: boolean;
}

/** Шаги, которые покажем сейчас: `has` отвечает, виден ли элемент `data-tour` на экране. */
export function tourStepsFor(has: (target: string) => boolean, steps: TourStep[] = TOUR_STEPS): ShownStep[] {
  return steps.flatMap((step) => {
    if (step.target === null) return [{ ...step, highlight: false }];
    const visible = has(step.target);
    if (!visible && !step.required) return [];
    return [{ ...step, highlight: visible }];
  });
}

/**
 * Ключ отметки «пройдено» в `localStorage` — свой у каждого вошедшего на этом браузере. Почту в хранилище браузера
 * не кладём: ключ — короткий отпечаток (FNV-1a) нормализованного адреса. Совпадение отпечатков у двух людей на одном
 * компьютере значит лишь, что второму тур не предложится сам — он есть в меню профиля.
 */
export function tourKeyOf(email: string): string {
  const text = email.trim().toLowerCase();
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `wetop.tour.v1:${hash.toString(36)}`;
}

/** Сам тур стартует один раз: на Главной, у вошедшего, пока отметки нет. Повтор — из меню профиля. */
export function shouldAutoStartTour(input: { path: string; key: string | null; done: boolean }): boolean {
  return input.path === '/today' && input.key !== null && !input.done;
}

/** Событие «показать обучение ещё раз» — его шлёт пункт меню профиля */
export const TOUR_RESTART_EVENT = 'wetop:tour-restart';
