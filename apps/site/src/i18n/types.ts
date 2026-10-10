import type { IconName } from '../components/icon';

/**
 * Все тексты сайта. Новый язык (казахский, английский) = новый файл рядом с ru.ts того же типа и строка
 * в src/i18n/index.ts; компоненты тексты не хранят.
 */
export type SegmentSlug =
  | 'hostels'
  | 'mini-hotels'
  | 'apart-hotels'
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
      metrics: Array<{ name: string; value: string; delta: string }>;
      arrivalsTitle: string;
      arrivals: Array<{ time: string; name: string; detail: string; guests: string }>;
      chartTitle: string;
      chartDays: string[];
      chartValues: number[];
      chartPeak: string;
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
    items: Array<{ icon: IconName; title: string; text: string }>;
  };
  /** «Продажи и ИИ»: две большие карточки с примерами и полоса источников броней. */
  growth: {
    eyebrow: string;
    title: string;
    lead: string;
    market: {
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
        placeholder: string;
      };
    };
    sources: {
      title: string;
      lead: string;
      items: Array<{ icon: IconName; title: string; text: string }>;
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
  /** Карточка призыва рядом с FAQ. */
  final: {
    eyebrow: string;
    title: string;
    text: string;
    contact: string;
    contactsLabel: string;
    badgeTop: string;
    badgeBottom: string;
  };
  /** «Вопросы и ответы»: нативные details. */
  faq: {
    eyebrow: string;
    title: string;
    items: Array<{ q: string; a: string }>;
  };
  /** Калькулятор «прямая бронь против OTA» (`/calculator/`, срез D3). */
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
    /** Чипы под кнопками героя: «7 дней бесплатно» и т.п. (ADR-098). */
    chips: string[];
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
  /** Страницы по типам объектов (`/for/<slug>/`, срез D2 плана прямых продаж). */
  segments: {
    eyebrow: string;
    featuresTitle: string;
    limitsLabel: string;
    ctaTitle: string;
    ctaText: string;
    home: string;
    items: Record<
      /** У салонов своя страница со своим словарём (`salon`), общего шаблона у них нет. */
      Exclude<SegmentSlug, 'salons'>,
      {
        title: string;
        metaTitle: string;
        description: string;
        lead: string;
        cards: Array<{ icon: IconName; title: string; text: string; tags?: string[] }>;
        /** Чего в системе пока нет: честная строка, а не скрытое ограничение. */
        limits?: string;
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
      pilotLead: string;
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
      phonePlaceholder: string;
      show: string;
      hide: string;
      showLabel: string;
      hideLabel: string;
    };
    errors: {
      required: string;
      privacy: string;
      network: string;
      /** Ссылка на ту же форму на отдельной странице стойки — на случай сбоя окна. */
      fallback: string;
    };
    signedIn: string;
  };
};
