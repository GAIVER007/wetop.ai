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
    start: string;
    blog: string;
    login: string;
    register: string;
  };
  hero: {
    /** Слово-знак металлом на первом экране. */
    word: string;
    badge: string;
    /** Плашка «регистрация открыта» у макета. */
    available: string;
    title: string;
    lead: string;
    points: string[];
    /** Надпись по кругу на знаке первого экрана. */
    seal: string;
    /** Строка под кнопками первого экрана: срок пробного периода (ADR-098). */
    note: string;
  };
  stats: {
    items: Array<{ icon: IconName; value: string; label: string; note: string }>;
    quote: string;
    quoteSource: string;
  };
  showcase: {
    eyebrow: string;
    title: string;
    all: string;
    items: Array<{
      no: string;
      /** Какой мини-экран рисуется в карточке. */
      screen: 'board' | 'channels' | 'folio';
      title: string;
      text: string;
      tags: string[];
    }>;
  };
  toolkit: {
    eyebrow: string;
    title: string;
    lead: string;
    modules: { title: string; state: string; items: string[] };
    channels: { title: string; items: Array<{ mark: string; name: string }> };
    principles: { title: string; center: string; items: [string, string, string, string] };
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
  /** Общий операционный экран «Сегодня» на первом экране: без номеров, коек и каналов OTA (29.09.2026). */
  operations: {
    label: string;
    title: string;
    /** Переключатель филиалов в шапке макета; выбран второй. */
    branches: string[];
    kpis: Array<{ label: string; value: string; note: string; tone?: 'up' | 'warn' }>;
    clientsTitle: string;
    clients: Array<{
      time: string;
      name: string;
      what: string;
      state: string;
      tone: 'done' | 'now' | 'new';
    }>;
    tasksTitle: string;
    tasks: Array<{ text: string; who: string; done?: boolean }>;
    financeTitle: string;
    /** Высоты столбиков выручки за неделю, в процентах; последний — сегодня. */
    financeBars: number[];
    financeValue: string;
    financeNote: string;
    toastTitle: string;
    toastText: string;
  };
  /** Раздел «Направления»: Hospitality работает, следующее направление — отдельной карточкой. */
  audience: {
    eyebrow: string;
    title: string;
    lead: string;
    /** Плашка у работающего направления. */
    status: string;
    items: Array<{ icon: IconName; title: string; text: string; segment: SegmentSlug }>;
    /** Подпись ссылки карточки направления на страницу по типу объекта. */
    more: string;
    next: { status: string; title: string; text: string };
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
  features: {
    eyebrow: string;
    title: string;
    lead: string;
    items: Array<{ icon: IconName; title: string; text: string; tags?: string[] }>;
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
