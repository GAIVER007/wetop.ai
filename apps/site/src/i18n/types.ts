import type { IconName } from '../components/icon';

/**
 * Все тексты сайта. Новый язык (казахский, английский) = новый файл рядом с ru.ts того же типа и строка
 * в src/i18n/index.ts; компоненты тексты не хранят.
 */
export type SegmentSlug = 'hostels' | 'mini-hotels' | 'apart-hotels';

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
    audience: string;
    features: string;
    sales: string;
    start: string;
    blog: string;
    login: string;
    register: string;
  };
  hero: {
    /** Плашка над заголовком: регистрация открыта (ADR-098). */
    status: string;
    /** Заголовок первого экрана; `titleAccent` идёт второй строкой фирменным цветом. */
    title: string;
    titleAccent: string;
    lead: string;
    /** Вторая кнопка первого экрана: к блоку «Возможности». */
    secondary: string;
    /** Строка под кнопками первого экрана: срок пробного периода (ADR-098). */
    note: string;
    /** Карта разделов (01.10.2026): шесть областей платформы ссылками на блоки страницы; имён и сумм нет. */
    map: {
      label: string;
      title: string;
      hint: string;
      items: Array<{ icon: IconName; title: string; text: string; href: string }>;
      caption: string;
    };
  };
  /**
   * Полоса фактов под первым экраном (02.10.2026): четыре коротких ответа на вопрос «что это даёт».
   * Три факта, которые раньше висели под чертой на первом экране, живут здесь. Обещаний и цифр нет (§19.9).
   */
  facts: {
    label: string;
    items: Array<{ icon: IconName; title: string; text: string }>;
  };
  mockup: {
    label: string;
    title: string;
    views: string[];
    weekdays: string[];
    rooms: string;
    beds: string;
    room: string;
    bed: string;
    fromDesk: string;
    checkedIn: string;
    unassigned: string;
    toastTitle: string;
    toastText: string;
  };
  /**
   * Раздел «Для кого»: типы объектов, с которыми система работает, и приглашение салонам (03.10.2026).
   * Дорожной карты направлений на странице нет: `invite` зовёт написать, функций салона не обещает.
   */
  audience: {
    eyebrow: string;
    title: string;
    lead: string;
    items: Array<{ icon: IconName; title: string; text: string; segment: SegmentSlug }>;
    /** Подпись ссылки карточки на страницу по типу объекта. */
    more: string;
    /** Подпись под макетом шахматки. */
    caption: string;
    /** Приглашение салонам и студиям: заголовок, текст и подпись ссылки на почту. */
    invite: { title: string; text: string; action: string };
  };
  features: {
    eyebrow: string;
    title: string;
    lead: string;
    items: Array<{ icon: IconName; title: string; text: string; tags?: string[] }>;
  };
  /** «Откуда приходят брони»: четыре входа и карточка со ссылкой на калькулятор. */
  sales: {
    eyebrow: string;
    title: string;
    lead: string;
    items: Array<{ icon: IconName; title: string; text: string; tags?: string[]; link?: string }>;
    calculator: { title: string; text: string; link: string };
  };
  /** «ИИ-продавцы»: шаги настройки и пример знаний. */
  ai: {
    eyebrow: string;
    title: string;
    lead: string;
    steps: Array<{ title: string; text: string }>;
    preview: {
      label: string;
      hint: string;
      title: string;
      items: Array<{ term: string; text: string }>;
      note: string;
      open: string;
      signIn: string;
    };
  };
  /** «Команда и доступ»: три карточки. */
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
    ctaTitle: string;
    ctaText: string;
    contactsLabel: string;
    cityLabel: string;
    siteLabel: string;
    connectLabel: string;
    connectText: string;
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
  /** Страницы по типам объектов (`/for/<slug>/`, срез D2 плана прямых продаж). */
  segments: {
    eyebrow: string;
    featuresTitle: string;
    limitsLabel: string;
    ctaTitle: string;
    ctaText: string;
    home: string;
    items: Record<
      SegmentSlug,
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
