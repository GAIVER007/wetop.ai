import type { IconName } from '../components/icon';

export type MarketingCopy = {
  title: string;
  lead: string;
  items: Array<{ icon: IconName; title: string; text: string; soon?: boolean }>;
  note?: string;
};

/**
 * Все тексты сайта. Новый язык (казахский, английский) = новый файл рядом с ru.ts того же типа и строка
 * в src/i18n/index.ts; компоненты тексты не хранят.
 */
export type SegmentSlug =
  | 'hostels'
  | 'mini-hotels'
  | 'apart-hotels'
  | 'guest-houses'
  | 'resorts'
  | 'daily-rentals'
  | 'glamping'
  | 'sanatoriums'
  | 'capsule-hotels'
  | 'beauty-salons'
  | 'barbershops'
  | 'spa'
  | 'nail-studios'
  | 'hair-salons'
  | 'massage'
  | 'cosmetology'
  | 'brows-lashes'
  | 'epilation'
  | 'tattoo'
  | 'cafes'
  | 'bars'
  | 'coffee-shops'
  | 'hookah-lounges'
  | 'karaoke'
  | 'pizzerias'
  | 'canteens'
  | 'banquet-halls'
  | 'hotels'
  | 'salons'
  | 'restaurants';

export type Dictionary = {
  meta: {
    title: string;
    description: string;
    siteName: string;
  };
  a11y: {
    skipToContent: string;
    home: string;
    mainNav: string;
    footerNav: string;
    menu: string;
    breadcrumbs: string;
    crumbHome: string;
    /** Переключатель языка страницы: подпись ссылки на казахскую и русскую версии. */
    switchToKk: string;
    switchToRu: string;
    /** Правовые ссылки в подвале и переключатель темы в шапке (каркас казахских страниц, P1-12). */
    legalNav: string;
    theme: string;
    themeLight: string;
    themeDark: string;
  };
  nav: {
    product: string;
    audience: string;
    features: string;
    sales: string;
    start: string;
    blog: string;
    login: string;
    register: string;
  };
  hero: {
    /** Плашка над заголовком. */
    status: string;
    /** Заголовок первого экрана; `titleAccent` идёт последней строкой фирменным цветом. */
    title: string;
    titleAccent: string;
    lead: string;
    /** Кнопки первого экрана: регистрация и переход к «Возможностям». */
    primary: string;
    secondary: string;
    /** Строка под кнопками. */
    note: string;
    /** Дашборд-мокап: только вымышленные данные, подпись примера обязательна. */
    dash: {
      label: string;
      nav: string[];
      title: string;
      date: string;
      scope: string;
      /** Подпись переключателя направлений над мокапом (для читалки). */
      switchLabel: string;
      chartDays: string[];
      /** Один и тот же экран «Сегодня» глазами гостиницы, салона и ресторана. */
      views: Array<{
        id: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
        tab: string;
        metrics: Array<{ name: string; value: string; delta: string }>;
        listTitle: string;
        rows: Array<{ time: string; name: string; detail: string; extra: string }>;
        chartTitle: string;
        chartValues: number[];
        /** Всплывающие уведомления у мокапа на компьютере: пример жизни системы, не данные. */
        toasts: Array<{ icon: IconName; title: string; text: string }>;
      }>;
      showAll: string;
    };
  };
  intro: {
    availability: string;
    verticalTitle: string;
    verticalLead: string;
    contactAction: string;
    cards: Array<{
      id: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
      icon: IconName;
      title: string;
      name: string;
      text: string;
      capabilities: string[];
      /** Подпись ссылки-стрелки карточки: «Для гостиниц». */
      action: string;
    }>;
  };
  /** Ссылки под карточкой гостиниц: страницы по типу объекта (`/for/*`). */
  audience: {
    items: Array<{ icon: IconName; title: string; text: string; segment: SegmentSlug }>;
  };
  features: {
    eyebrow: string;
    title: string;
    lead: string;
    /** Пометка у возможности, которой в продукте ещё нет (§19.9: сайт не выдаёт план за готовое). */
    soon: string;
    groups: Array<{
      title: string;
      items: Array<{ icon: IconName; title: string; text: string; soon?: boolean }>;
    }>;
  };
  /** «Продажи, маркетинг и ИИ»: три витрины, у каждой текст и пример экрана. */
  growth: {
    eyebrow: string;
    title: string;
    lead: string;
    sales: {
      kicker: string;
      icon: IconName;
      title: string;
      text: string;
      points: string[];
      action: string;
      /** Что подключается отдельно, рядом с кнопкой: обещание без условий не печатаем. */
      note: string;
      feed: {
        label: string;
        title: string;
        rows: Array<{
          icon: IconName;
          source: string;
          guest: string;
          detail: string;
          value: string;
        }>;
      };
    };
    market: {
      kicker: string;
      icon: IconName;
      title: string;
      text: string;
      points: string[];
      action: string;
      preview: {
        label: string;
        title: string;
        delta: string;
        rows: Array<{ name: string; value: string; own?: boolean }>;
        marker: string;
        days: string[];
      };
    };
    ai: {
      kicker: string;
      icon: IconName;
      title: string;
      text: string;
      points: string[];
      action: string;
      note: string;
      chat: {
        label: string;
        title: string;
        online: string;
        inbound: string;
        outbound: string;
        confirmation: string;
        booked: string;
        placeholder: string;
      };
    };
  };
  /** «Команда и контроль доступа»: три карточки. */
  team: {
    eyebrow: string;
    title: string;
    lead: string;
    items: Array<{ icon: IconName; title: string; text: string }>;
  };
  start: {
    eyebrow: string;
    title: string;
    lead: string;
    steps: Array<{ title: string; text: string }>;
  };
  /** Единый финал страниц: плита призыва с условиями словами. */
  final: {
    title: string;
    text: string;
    contact: string;
    contactsLabel: string;
    note: string;
  };
  /** «Вопросы и ответы»: нативные details. */
  faq: {
    eyebrow: string;
    title: string;
    items: Array<{ q: string; a: string }>;
  };
  /** Калькулятор «прямая бронь против OTA» (`/calculator/`, срез D3). */
  /** Блок «Маркетинг и ИИ» на лендингах направлений (11.10.2026): `soon` — функции ещё нет, карточка с пометкой. */
  marketing: {
    eyebrow: string;
    soon: string;
    hotel: MarketingCopy;
    salon: MarketingCopy;
    restaurant: MarketingCopy;
  };
  calculator: {
    metaTitle: string;
    description: string;
    title: string;
    lead: string;
    fields: {
      nights: { label: string; hint: string };
      adr: { label: string; hint: string };
      commission: { label: string; hint: string };
      shift: { label: string; hint: string };
    };
    errors: { whole: string; nights: string; adr: string; percent: string };
    result: {
      title: string;
      commission: string;
      savedMonth: string;
      savedYear: string;
      note: string;
    };
    empty: string;
    ctaText: string;
    badge: string;
    faqTitle: string;
    faq: Array<{ q: string; a: string }>;
    link: string;
  };
  /**
   * Лендинг «Для салонов красоты» (`/for/salons/`, ТЗ владельца 10.10.2026,
   * план `plans/salon-landing-2026-10-10.md`). Текст только из продукта (§19.9).
   */
  salon: {
    metaTitle: string;
    description: string;
    badge: string;
    title: string;
    lead: string;
    primary: string;
    secondary: string;
    /** Чипы под кнопками героя: факты о работе, без условий trial (ADR-147). */
    chips: string[];
    /** Снимок настоящего дня салона с демо-данными (светлая и тёмная темы). */
    shot: { eyebrow: string; title: string; lead: string; alt: string; note: string };
    /** Мокап-календарь записей по мастерам: только вымышленные данные, подпись примера обязательна. */
    mock: {
      label: string;
      title: string;
      date: string;
      summary: Array<{ name: string; value: string }>;
      /** Строки времени календаря; у мастера запись ищется по точному совпадению времени. */
      times: string[];
      masters: Array<{
        name: string;
        appointments: Array<{ time: string; service: string; client: string; tone: 1 | 2 | 3 | 4 }>;
        /** Времена со «Свободно»: показываются пунктирной ячейкой. */
        free: string[];
      }>;
      freeLabel: string;
    };
    /** Полоса фактов: только числа продукта (§19.9), чисел клиентов не бывает. */
    facts: Array<{ value: string; text: string }>;
    featuresTitle: string;
    featuresLead: string;
    features: Array<{ icon: IconName; title: string; text: string }>;
    growth: {
      badge: string;
      title: string;
      text: string;
      points: string[];
      action: string;
      /** Плавающая карточка на иллюстрации: вымышленное число с пометкой примера (§19.9). */
      float: { value: string; text: string };
    };
    faqTitle: string;
    faq: Array<{ q: string; a: string }>;
    ctaTitle: string;
    ctaText: string;
  };
  /** Лендинг «Для гостиниц» (/for/hotels/): тот же каркас, что у салона; мокап общий `hero.dash`. */
  hotel: {
    metaTitle: string;
    description: string;
    badge: string;
    title: string;
    lead: string;
    primary: string;
    secondary: string;
    chips: string[];
    facts: Array<{ value: string; text: string }>;
    /** Снимок настоящего календаря стойки с демо-данными (светлая и тёмная темы). */
    calendar: { eyebrow: string; title: string; lead: string; alt: string; note: string };
    featuresTitle: string;
    featuresLead: string;
    features: Array<{ icon: IconName; title: string; text: string }>;
    growth: {
      badge: string;
      title: string;
      text: string;
      points: string[];
      action: string;
      float: { value: string; text: string };
    };
    faqTitle: string;
    faq: Array<{ q: string; a: string }>;
    ctaTitle: string;
    ctaText: string;
  };
  /** Лендинг «Для ресторанов»: тот же каркас, что у гостиниц; в герое фото вместо мокапа. */
  restaurant: {
    metaTitle: string;
    description: string;
    badge: string;
    title: string;
    lead: string;
    primary: string;
    secondary: string;
    chips: string[];
    photoAlt: string;
    /** Снимок настоящего плана зала с демо-данными (светлая и тёмная темы). */
    shot: { eyebrow: string; title: string; lead: string; alt: string; note: string };
    facts: Array<{ value: string; text: string }>;
    featuresTitle: string;
    featuresLead: string;
    soon: string;
    /** Модули для владельца: пункты внутри и пометка «Скоро» у того, чего у ресторана ещё нет. */
    features: Array<{
      icon: IconName;
      title: string;
      text: string;
      points: string[];
      soon?: boolean;
    }>;
    growth: {
      badge: string;
      title: string;
      text: string;
      points: string[];
      action: string;
      float: { value: string; text: string };
    };
    faqTitle: string;
    faq: Array<{ q: string; a: string }>;
    ctaTitle: string;
    ctaText: string;
  };
  segments: {
    eyebrow: string;
    /**
     * Подписи на рисунке первого экрана для типов, где общий рисунок вертикали показал бы чужие услуги:
     * подпись дня и ровно шесть услуг по порядку блоков рисунка (`app/previews/[file]/route.ts`).
     */
    previews: Partial<Record<SegmentSlug, { day: string; services: string[] }>>;
    featuresTitle: string;
    ctaTitle: string;
    ctaText: string;
    home: string;
    more: string;
    dayTitle: string;
    day: Record<'hotels' | 'salons' | 'restaurants', Array<{ title: string; text: string }>>;
    typesTitle: Record<'hotels' | 'salons' | 'restaurants', string>;
    /** Блок «Смотрите также» на странице типа: заголовок и текст карточки родительского направления. */
    alsoTitle: string;
    directionCards: Record<'hotels' | 'salons' | 'restaurants', string>;
    items: Record<
      /** У салонов своя страница со своим словарём (`salon`), общего шаблона у них нет. */
      Exclude<SegmentSlug, 'salons'>,
      {
        title: string;
        metaTitle: string;
        description: string;
        lead: string;
        cards: Array<{ icon: IconName; title: string; text: string; tags?: string[] }>;
        /** Текст «о формате»: заголовок с запросом и два абзаца для людей и поисковиков */
        about?: { title: string; text: string[] };
        /** Фото героя (свой файл из KIE, не сток) и вопросы: есть у страниц типов объектов. */
        photoAlt?: string;
        /** <title> страницы: запрос словами человека, до 49 знаков (с « | WETOP.AI» до 60) */
        seoTitle?: string;
        faq?: Array<{ q: string; a: string }>;
      }
    >;
  };
  company: {
    eyebrow: string;
    city: string;
    email: string;
    phone: string;
  };
  blog: {
    title: string;
    lead: string;
    latestEyebrow: string;
    latestTitle: string;
    all: string;
    empty: string;
    back: string;
  };
  footer: {
    tagline: string;
    /** Девиз в нижней строке подвала. */
    motto: string;
    product: string;
    features: string;
    contacts: string;
    privacy: string;
    terms: string;
    directions: string;
  };
  notFound: {
    title: string;
    text: string;
    home: string;
    blog: string;
  };
  /** Окно входа и регистрации поверх главной (ADR-100). */
  auth: {
    dialogLabel: string;
    close: string;
    tabs: { login: string; register: string };
    login: {
      title: string;
      lead: string;
      submit: string;
      pending: string;
      forgot: string;
      noAccount: string;
    };
    register: {
      title: string;
      lead: string;
      submit: string;
      pending: string;
      terms: string;
      consentBefore: string;
      consentLink: string;
      consentAfter: string;
      haveAccount: string;
    };
    closed: { title: string; text: string; action: string };
    sent: {
      title: string;
      /** `{email}` заменяется адресом. */
      text: string;
      next: string;
      notSent: string;
      resend: string;
      resendPending: string;
      resent: string;
      /** `{seconds}` — сколько ждать до следующей отправки. */
      wait: string;
      change: string;
      /** Поле кода из письма (22.10.2026) */
      codeLabel: string;
      codeHint: string;
      codeChecking: string;
      codeAccepted: string;
      linkFallback: string;
    };
    fields: {
      email: string;
      emailPlaceholder: string;
      password: string;
      passwordPlaceholder: string;
      newPasswordPlaceholder: string;
      name: string;
      namePlaceholder: string;
      hotel: string;
      hotelPlaceholder: string;
      phone: string;
      phoneCountry: string;
      country: string;
      language: string;
      languageSoon: string;
      languageNote: string;
      vertical: string;
      phonePlaceholder: string;
      show: string;
      hide: string;
      showLabel: string;
      hideLabel: string;
    };
    errors: {
      required: string;
      /** Ошибка под полем: формы окна с noValidate, браузер своего сообщения не показывает (P1-1a) */
      fields: {
        email: string;
        emailFormat: string;
        password: string;
        passwordShort: string;
        name: string;
        businessName: string;
        phone: string;
      };
      privacy: string;
      network: string;
      /** Ссылка на ту же форму на отдельной странице стойки — на случай сбоя окна. */
      fallback: string;
    };
    signedIn: string;
  };
};
