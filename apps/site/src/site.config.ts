/**
 * Настройки главной wetop.ai — единственное место, куда владелец вписывает данные о себе.
 *
 * Пустая строка = данных нет: блок на странице скрывается или показывается нейтральный текст, пометок «TODO»
 * на сайте не бывает. Название, контакты и ссылку на заявку даёт только владелец — ничего не придумывать
 * (plans/wetop-domain-2026-09-14.md §4, §5, §8). Неверный формат ссылки, почты или телефона останавливает сборку
 * с понятной ошибкой, чтобы на сайт не попала битая ссылка (src/lib/site.ts).
 */
export type SiteConfig = {
  /** Адрес сайта: canonical, sitemap.xml, robots.txt, OpenGraph. */
  siteUrl: string;
  /** Куда ведёт «Войти» — стойка WETOP. */
  appUrl: string;
  /**
   * Куда ведёт «Попробовать бесплатно»: https://… (регистрация в стойке, WhatsApp, Telegram, форма),
   * mailto:… или tel:…. Пусто — кнопки в шапке и на первом экране ведут к разделу «Как начать».
   */
  trialHref: string;
  company: {
    /** Название компании. Пусто — раздела «О компании» нет, в подвале только © год и WETOP. */
    name: string;
    city: string;
    email: string;
    phone: string;
    /** Одно-три предложения о компании для раздела «О компании». */
    about: string;
  };
};

export const siteConfig: SiteConfig = {
  siteUrl: 'https://wetop.ai',
  appUrl: 'https://app.wetop.ai',
  // Регистрация с пробным периодом на 7 дней (срез 13, ADR-046): своя страница стойки, не чужая форма.
  trialHref: 'https://app.wetop.ai/register',
  company: {
    name: 'ТОО «MARKVISION AI»',
    city: 'Астана',
    email: 'zapoinov@bk.ru',
    phone: '',
    about:
      'MARKVISION AI разрабатывает WETOP, систему управления хостелом и мини-отелем. ' +
      'Компания зарегистрирована в Астане и является резидентом Astana Hub.',
  },
};
