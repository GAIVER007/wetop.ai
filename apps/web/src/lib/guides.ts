import { msg } from '../i18n';

/**
 * «Обучение» (владелец 30.10.2026, вариант B): все инструкции WETOP одним списком у каждого клиента, при любой роли
 * и должности. Инструкция: название, краткое описание, для кого; по нажатию вся инструкция страницами. Файлы лежат
 * в `apps/web/public/guides/<lang>/` (PDF для «Скачать» и страницы картинками для чтения на сайте). RU и EN отдельно,
 * каждая снята со своего языка интерфейса; у казахского интерфейса русская версия.
 * Правило владельца 30.10.2026: каждая новая инструкция сразу попадает сюда; сторож `guides.test.ts` не даёт
 * положить PDF в `public/guides` без строки в списке.
 */
export type GuideLang = 'ru' | 'en';
export interface Guide {
  slug: string;
  title: string;
  description: string;
  /** для кого инструкция: подпись чипа */
  audience: string;
  updated: string;
  files: Record<GuideLang, { pdf: string; pages: number }>;
}

const files = (slug: string, ru: number, en: number): Guide['files'] => ({
  ru: { pdf: `/guides/ru/${slug}.pdf`, pages: ru },
  en: { pdf: `/guides/en/${slug}.pdf`, pages: en },
});

export const GUIDES: readonly Guide[] = [
  {
    slug: 'admin',
    title: msg('Администратор салона'),
    description: msg(
      'Работа на каждый день: открыть смену, журнал, новая запись, оплата и завершение визита, отмена и перенос, клиенты, расходы и закрытие смены.',
    ),
    audience: msg('Администратор'),
    updated: '2026-10-30',
    files: files('admin', 11, 11),
  },
  {
    slug: 'cash-payroll',
    title: msg('Касса и зарплата'),
    description: msg(
      'Смена и пересчёт наличных, расходы с комментарием, условия оплаты мастеров, выплаты по дням и «Не забрал» в окне закрытия смены.',
    ),
    audience: msg('Касса'),
    updated: '2026-10-30',
    files: files('cash-payroll', 9, 9),
  },
  {
    slug: 'master-cabinet',
    title: msg('Кабинет мастера'),
    description: msg(
      'Что видит мастер: записи на сегодня и за месяц, деньги к выплате, график и отсутствия, отзывы, вход с телефона.',
    ),
    audience: msg('Мастер'),
    updated: '2026-10-30',
    files: files('master-cabinet', 7, 7),
  },
  {
    slug: 'staff-access',
    title: msg('Доступ сотрудникам'),
    description: msg(
      'Как пригласить сотрудника, выбрать должность и права, отправить ссылку «Личный кабинет» и как закрыть доступ.',
    ),
    audience: msg('Владелец'),
    updated: '2026-10-30',
    files: files('staff-access', 7, 7),
  },
  // guides:end — новые инструкции добавляет сюда скрипт публикации (каждая новая инструкция сразу в «Обучении»)
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Язык инструкции по языку интерфейса: английской у казахского нет, ему русская */
export function guideLang(locale: string): GuideLang {
  return locale === 'en' ? 'en' : 'ru';
}

/** Страницы инструкции картинками по порядку: `/guides/<lang>/<slug>/p01.jpg` … */
export function guidePages(guide: Guide, lang: GuideLang): string[] {
  return Array.from({ length: guide.files[lang].pages }, (_, i) => `/guides/${lang}/${guide.slug}/p${String(i + 1).padStart(2, '0')}.jpg`);
}
