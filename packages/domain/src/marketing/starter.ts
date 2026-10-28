import { applyDesignDirection, type DesignDirection } from './builder';
import type { SiteBriefInput } from './brief';
import { plainTextProblem, type SiteSpecVertical } from './site-spec';
import type { SiteFacts, SiteFactsCatalogItem, SiteFactsVertical } from './site-facts';
import { AUTO_FAQ_ID, autoFaqItems, autoSeoDescription, autoSeoTitle, type AutoSeoInput } from './seo-auto';

/**
 * Детерминированная заготовка сайта для заявок (SITE-2, план §1 шаг 4) из фактов филиала, без ИИ. Нужна дважды:
 * мгновенное превью трёх дизайнов в стойке (тот же рендер, что у сайта, бесплатно) и скелет, от которого отталкивается
 * генерация. Тексты только из данных филиала и нейтральные подписи («Услуги», «Записаться»): ни описаний, ни обещаний,
 * ни цен от себя. Результат проходит `validateSiteSpec` для каждого направления (тест `starter.test.ts`).
 *
 * Структура главной по направлению: первый экран с кнопкой заявки; «почему мы» только из чисел данных (оценка, число
 * мастеров, услуг, блюд); каталог (номера и цены «от» / услуги и мастера / меню); форма заявки; часы; контакты; повтор
 * кнопки. На телефоне закреплённая кнопка заявки и WhatsApp, если номер есть.
 */
type Rec = Record<string, unknown>;

export interface StarterOptions {
  locale?: 'ru' | 'kk' | 'en';
}

const PHONE_RE = /^\+[1-9][0-9]{9,14}$/;

/** Текст данных как обычный текст SiteSpec: управляющие знаки в пробел, разметка и шаблоны разбиты, обрезка по пределу */
export function starterText(raw: string | null | undefined, max: number): string | null {
  if (typeof raw !== 'string') return null;
  let t = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/<(?=[A-Za-z/!?])/g, '‹')
    .replace(/\{\{/g, '{ {')
    .replace(/\$\{/g, '$ {')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return null;
  const chars = [...t];
  if (chars.length > max) t = `${chars.slice(0, max - 1).join('').trimEnd()}…`;
  return plainTextProblem(t) ? null : t;
}

/** Телефон в E.164, если запись филиала однозначно им является после снятия пробелов, скобок и дефисов; иначе нет */
export function starterPhone(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/[\s()-]/g, '');
  return PHONE_RE.test(t) ? t : null;
}

const CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MINOR_RE = /^(?:0|[1-9][0-9]{0,14})$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WORDS = {
  ru: {
    phoneCall: 'Позвонить', rooms: 'Номера', services: 'Услуги', staff: 'Мастера', menu: 'Меню', hours: 'Часы работы', contacts: 'Контакты',
    book: 'Забронировать', appoint: 'Записаться', table: 'Забронировать стол', call: 'Перезвоните мне',
    formHotel: 'Бронирование', formBeauty: 'Запись онлайн', formTable: 'Бронь стола', formCall: 'Оставьте заявку',
    why: 'Почему выбирают нас', faq: 'Вопросы и ответы', prices: 'Цены', home: 'Главная', again: 'Ждём вас',
    capacity: (n: number) => `Вместимость: до ${n} ${n === 1 ? 'гостя' : 'гостей'}.`,
    rating: (avg: number) => `Оценка ${String(avg).replace('.', ',')} из 5`,
    ratingText: (n: number) => `По оценкам гостей: ${n}.`,
    masters: (n: number) => `Мастеров: ${n}`,
    mastersText: 'Выберите мастера при записи.',
    servicesN: (n: number) => `Услуг: ${n}`,
    servicesText: 'Цены и длительность указаны на сайте.',
    dishes: (n: number) => `Блюд в меню: ${n}`,
    dishesText: 'Цены указаны в меню.',
    days: (n: number) => `Работаем ${n} ${n === 1 ? 'день' : n < 5 ? 'дня' : 'дней'} в неделю`,
    daysText: 'Часы работы указаны ниже.',
    priceNote: 'Цена зависит от дат. Выберите даты в форме бронирования.',
    hotelSub: 'Онлайн-бронирование без посредников.',
    beautySub: 'Запись онлайн в удобное время.',
    foodSub: 'Меню с ценами и бронь стола онлайн.',
  },
  kk: {
    phoneCall: 'Қоңырау шалу', rooms: 'Нөмірлер', services: 'Қызметтер', staff: 'Шеберлер', menu: 'Мәзір', hours: 'Жұмыс уақыты', contacts: 'Байланыс',
    book: 'Брондау', appoint: 'Жазылу', table: 'Үстел брондау', call: 'Маған қоңырау шалыңыз',
    formHotel: 'Брондау', formBeauty: 'Онлайн жазылу', formTable: 'Үстел брондау', formCall: 'Өтінім қалдырыңыз',
    why: 'Неге бізді таңдайды', faq: 'Сұрақтар мен жауаптар', prices: 'Бағалар', home: 'Басты бет', again: 'Сізді күтеміз',
    capacity: (n: number) => `Сыйымдылығы: ${n} қонаққа дейін.`,
    rating: (avg: number) => `Бағасы 5-тен ${String(avg).replace('.', ',')}`,
    ratingText: (n: number) => `Қонақтар бағасы бойынша: ${n}.`,
    masters: (n: number) => `Шеберлер: ${n}`,
    mastersText: 'Жазылғанда шеберді таңдаңыз.',
    servicesN: (n: number) => `Қызметтер: ${n}`,
    servicesText: 'Бағасы мен ұзақтығы сайтта көрсетілген.',
    dishes: (n: number) => `Мәзірдегі тағамдар: ${n}`,
    dishesText: 'Бағалар мәзірде көрсетілген.',
    days: (n: number) => `Аптасына ${n} күн жұмыс істейміз`,
    daysText: 'Жұмыс уақыты төменде.',
    priceNote: 'Баға күндерге байланысты. Брондау формасында күндерді таңдаңыз.',
    hotelSub: 'Делдалсыз онлайн брондау.',
    beautySub: 'Ыңғайлы уақытқа онлайн жазылу.',
    foodSub: 'Бағасы бар мәзір және онлайн үстел брондау.',
  },
  en: {
    phoneCall: 'Call us', rooms: 'Rooms', services: 'Services', staff: 'Our team', menu: 'Menu', hours: 'Opening hours', contacts: 'Contacts',
    book: 'Book now', appoint: 'Book a visit', table: 'Book a table', call: 'Call me back',
    formHotel: 'Booking', formBeauty: 'Book online', formTable: 'Table booking', formCall: 'Leave a request',
    why: 'Why guests choose us', faq: 'Questions and answers', prices: 'Prices', home: 'Home', again: 'We look forward to seeing you',
    capacity: (n: number) => `Sleeps up to ${n} ${n === 1 ? 'guest' : 'guests'}.`,
    rating: (avg: number) => `Rated ${avg} out of 5`,
    ratingText: (n: number) => `Based on ${n} guest ratings.`,
    masters: (n: number) => `Specialists: ${n}`,
    mastersText: 'Choose a specialist when booking.',
    servicesN: (n: number) => `Services: ${n}`,
    servicesText: 'Prices and duration are listed on the site.',
    dishes: (n: number) => `Dishes on the menu: ${n}`,
    dishesText: 'Prices are listed in the menu.',
    days: (n: number) => `Open ${n} ${n === 1 ? 'day' : 'days'} a week`,
    daysText: 'Opening hours are listed below.',
    priceNote: 'The price depends on dates. Choose dates in the booking form.',
    hotelSub: 'Book online directly.',
    beautySub: 'Book online at a convenient time.',
    foodSub: 'Menu with prices and online table booking.',
  },
} as const;

/**
 * Три заметно разных направления оформления для первого выбора (план §1 шаг 3). Только значения словарей темы
 * SiteSpec; порядок блоков по умолчанию (`sectionOrder` пуст: остаётся порядок заготовки по направлению)
 */
export const STARTER_DESIGNS: readonly DesignDirection[] = Object.freeze([
  {
    id: 'light-minimal',
    name: 'Светлый минимал',
    shortDescription: 'Белый фон, строгий шрифт, много воздуха',
    theme: { preset: 'CALM', accent: 'GRAPHITE', typography: 'MODERN', radius: 'SHARP', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    heroVariant: 'TEXT_ONLY',
    sectionOrder: [],
  },
  {
    id: 'deep-premium',
    name: 'Глубокий премиум',
    shortDescription: 'Холодный фон, классический шрифт, золотой акцент',
    theme: { preset: 'NIGHT', accent: 'GOLD', typography: 'CLASSIC', radius: 'SOFT', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    heroVariant: 'TEXT_ONLY',
    sectionOrder: [],
  },
  {
    id: 'bright-warm',
    name: 'Яркий тёплый',
    shortDescription: 'Тёплый фон, терракотовый акцент, мягкие углы',
    theme: { preset: 'WARM', accent: 'TERRACOTTA', typography: 'ROUNDED', radius: 'ROUND', density: 'COMPACT', colorScheme: 'LIGHT' },
    heroVariant: 'TEXT_ONLY',
    sectionOrder: [],
  },
]);

const STRUCTURED: Record<SiteFactsVertical, string> = { HOSPITALITY: 'HOTEL', BEAUTY: 'BEAUTY_SALON', FOOD_SERVICE: 'RESTAURANT' };
const LEAD_MODE: Record<SiteFactsVertical, string> = {
  HOSPITALITY: 'HOTEL_BOOKING',
  BEAUTY: 'BEAUTY_APPOINTMENT',
  FOOD_SERVICE: 'TABLE_RESERVATION',
};

const money = (item: SiteFactsCatalogItem) =>
  item.price && MINOR_RE.test(item.price.minor) && /^[A-Z]{3}$/.test(item.price.currency)
    ? { minor: item.price.minor, currency: item.price.currency }
    : undefined;

/**
 * Заготовка SiteSpec из фактов филиала (`GET /marketing/site/facts`) и, по желанию, выбранного направления
 * оформления. Без ИИ, без сети, без времени: те же факты и то же оформление дают тот же документ.
 */
export function starterSpecFromFacts(facts: SiteFacts, design?: DesignDirection | null, options: StarterOptions = {}): Rec {
  const l = options.locale ?? 'ru';
  const w = WORDS[l];
  const t = (value: string) => ({ [l]: value });
  const v = facts.vertical;
  const name = starterText(facts.location.name, 80) ?? w.home;
  const address = starterText(facts.location.address, 200);
  const city = starterText(facts.location.city, 60);
  const phone = starterPhone(facts.location.phone);
  const whatsapp = starterPhone(facts.location.whatsapp);
  const items = facts.catalog.items.filter((i) => CODE_RE.test(i.code) && starterText(i.name, 80));

  const sections: Rec[] = [];
  const nav: Rec[] = [];
  const section = (s: Rec, navLabel?: string) => {
    sections.push(s);
    if (navLabel && nav.length < 5) nav.push({ label: t(navLabel), target: { kind: 'SECTION', pageId: 'page-home', sectionId: s['id'] } });
  };
  const bookLabel = v === 'HOSPITALITY' ? w.book : v === 'BEAUTY' ? (items.length ? w.appoint : w.call) : w.table;
  const book = { label: t(bookLabel), action: { kind: 'BOOK' } };

  section({
    id: 'sec-hero',
    type: 'hero',
    variant: 'TEXT_ONLY',
    heading: t(name),
    subheading: t(v === 'HOSPITALITY' ? w.hotelSub : v === 'BEAUTY' ? w.beautySub : w.foodSub),
    primaryAction: book,
    ...(phone ? { secondaryAction: { label: t(w.phoneCall), action: { kind: 'PHONE' } } } : {}),
  });

  // «почему мы» только из чисел данных; меньше двух фактов: секции нет (features требует от двух пунктов)
  const why: Rec[] = [];
  if (facts.reviews && facts.reviews.count > 0)
    why.push({ icon: 'STAR', title: t(w.rating(facts.reviews.avg)), text: t(w.ratingText(facts.reviews.count)) });
  if (v === 'BEAUTY' && facts.staff.length) why.push({ icon: 'FAMILY', title: t(w.masters(facts.staff.length)), text: t(w.mastersText) });
  if (v === 'BEAUTY' && items.length) why.push({ icon: 'CLOCK', title: t(w.servicesN(items.length)), text: t(w.servicesText) });
  if (v === 'FOOD_SERVICE' && items.length) why.push({ icon: 'KITCHEN', title: t(w.dishes(items.length)), text: t(w.dishesText) });
  const openDays = new Set(facts.hours.days.map((d) => d.weekday)).size;
  if (v !== 'HOSPITALITY' && openDays) why.push({ icon: 'CLOCK', title: t(w.days(openDays)), text: t(w.daysText) });
  if (why.length >= 2) section({ id: 'sec-why', type: 'features', variant: 'GRID', heading: t(w.why), items: why.slice(0, 4) });

  if (v === 'HOSPITALITY' && items.length) {
    const cards = items.slice(0, 20).map((i) => ({
      categoryCode: i.code,
      title: t(starterText(i.name, 60)!),
      description: t(typeof i.capacityAdults === 'number' && i.capacityAdults > 0 ? w.capacity(i.capacityAdults) : starterText(i.name, 400)!),
    }));
    section({ id: 'sec-rooms', type: 'accommodations', variant: 'CARDS', heading: t(w.rooms), items: cards, showLiveCapacity: true, showFromPrice: true }, w.rooms);
    section({ id: 'sec-prices', type: 'pricing', variant: 'FROM_PRICES', heading: t(w.prices), categoryCodes: cards.map((c) => c.categoryCode), note: t(w.priceNote) });
  }
  if (v === 'BEAUTY' && items.length) {
    const list = items.slice(0, 60).map((i) => {
      const price = money(i);
      const category = starterText(i.category, 60);
      return {
        serviceCode: i.code,
        title: t(starterText(i.name, 80)!),
        ...(category ? { category: t(category) } : {}),
        ...(typeof i.durationMin === 'number' && Number.isInteger(i.durationMin) && i.durationMin > 0 && i.durationMin <= 1440 ? { durationMin: i.durationMin } : {}),
        ...(price ? { price } : {}),
      };
    });
    const grouped = list.some((i) => 'category' in i);
    section({ id: 'sec-services', type: 'services', variant: 'LIST', heading: t(w.services), items: list, showPrices: true, showDuration: true, groupByCategory: grouped }, w.services);
  }
  if (v === 'BEAUTY') {
    const staff = facts.staff
      .filter((s) => UUID_RE.test(s.id) && starterText(s.name, 80))
      .slice(0, 30)
      .map((s) => {
        const spec = starterText(s.specialization, 120);
        return { employeeId: s.id.toLowerCase(), name: t(starterText(s.name, 80)!), ...(spec ? { specialization: t(spec) } : {}) };
      });
    if (staff.length) section({ id: 'sec-staff', type: 'staff', variant: 'CARDS', heading: t(w.staff), items: staff }, w.staff);
  }
  if (v === 'FOOD_SERVICE' && items.length) {
    const categories: Array<{ title: Rec; items: Rec[] }> = [];
    const byTitle = new Map<string, { title: Rec; items: Rec[] }>();
    let total = 0;
    for (const i of items) {
      if (total >= 300) break;
      const title = starterText(i.category, 80) ?? w.menu;
      let cat = byTitle.get(title);
      if (!cat) {
        if (categories.length >= 30) continue;
        cat = { title: t(title), items: [] };
        byTitle.set(title, cat);
        categories.push(cat);
      }
      if (cat.items.length >= 80) continue;
      const price = money(i);
      cat.items.push({
        itemCode: i.code,
        title: t(starterText(i.name, 120)!),
        ...(typeof i.weightGrams === 'number' && Number.isInteger(i.weightGrams) && i.weightGrams > 0 && i.weightGrams <= 100_000 ? { weightGrams: i.weightGrams } : {}),
        ...(price ? { price } : {}),
      });
      total += 1;
    }
    section({ id: 'sec-menu', type: 'menu', variant: 'LIST', heading: t(w.menu), categories, showPhotos: true }, w.menu);
  }

  if (v === 'HOSPITALITY') section({ id: 'sec-booking', type: 'booking', variant: 'INLINE', heading: t(w.formHotel), showCheckInOut: true });
  else {
    const appointment = v === 'BEAUTY' && items.length > 0;
    const mode = v === 'BEAUTY' ? (appointment ? LEAD_MODE.BEAUTY : 'CALLBACK') : LEAD_MODE.FOOD_SERVICE;
    const heading = v === 'BEAUTY' ? (appointment ? w.formBeauty : w.formCall) : w.formTable;
    section({ id: 'sec-form', type: 'leadForm', variant: 'INLINE', heading: t(heading), mode, showComment: true });
  }

  const days = facts.hours.days.filter((d) => Number.isInteger(d.weekday) && d.weekday >= 0 && d.weekday <= 6 && d.open !== d.close);
  const seen = new Set<number>();
  const hours = days.filter((d) => (seen.has(d.weekday) ? false : (seen.add(d.weekday), true)));
  if (v !== 'HOSPITALITY' && hours.length)
    section({ id: 'sec-hours', type: 'hours', variant: 'TABLE', heading: t(w.hours), days: hours.map((d) => ({ weekday: d.weekday, open: d.open, close: d.close })) });

  // SEO и GEO сразу при создании (S7, 28.10.2026): вопросы и ответы из фактов с разметкой FAQ, перед контактами
  const seoInput: AutoSeoInput = { facts, locale: l, name, address, city, phone, items, itemName: (i) => starterText(i.name, 80)! };
  const faq = autoFaqItems(seoInput);
  section({
    id: AUTO_FAQ_ID,
    type: 'faq',
    variant: 'ACCORDION',
    heading: t(w.faq),
    items: faq.map((i) => ({ question: t(i.question), answer: t(i.answer) })),
    emitStructuredData: true,
  });

  const hasContacts = !!(phone || whatsapp || address);
  if (hasContacts)
    section(
      {
        id: 'sec-contacts',
        type: 'contacts',
        variant: 'PLAIN',
        heading: t(w.contacts),
        showPhone: !!phone,
        showWhatsapp: !!whatsapp,
        showEmail: false,
        showAddress: !!address,
      },
      w.contacts,
    );
  section({ id: 'sec-cta', type: 'cta', variant: 'BANNER', heading: t(w.again), action: book });

  const description = autoSeoDescription(seoInput);
  const spec: Rec = {
    schemaVersion: 'site-spec/0',
    site: {
      vertical: v satisfies SiteSpecVertical,
      displayName: t(name),
      defaultLocale: l,
      locales: [l],
      contacts: {
        ...(phone ? { phone } : {}),
        ...(whatsapp ? { whatsapp } : {}),
        ...(address ? { address: t(address) } : {}),
      },
      seo: { robots: 'INDEX', structuredData: { type: STRUCTURED[v], includeAddress: !!address, includeGeo: false } },
    },
    theme: { ...STARTER_DESIGNS[0]!.theme },
    navigation: { header: nav, headerCta: book, mobileBar: { book: true, whatsapp: !!whatsapp }, footer: [] },
    pages: [
      {
        id: 'page-home',
        slug: '',
        isHome: true,
        title: t(name),
        seo: { title: t(autoSeoTitle(seoInput)), description: t(description), index: true, includeInSitemap: true, canonical: 'SELF' },
        sections,
      },
    ],
    integrations: {
      booking: { mode: v === 'HOSPITALITY' ? 'WETOP_WIDGET' : 'NONE' },
      analytics: { mode: 'WETOP_TRACKER', consent: 'NOT_REQUIRED' },
    },
  };
  return design ? applyDesignDirection(spec, design) : spec;
}

/**
 * Те же факты из брифа генерации (`SiteBriefInput`): заготовка для воркера и подсказка модели. Бриф не знает id
 * филиала, адрес берётся из личности брифа
 */
export function siteFactsFromBrief(input: SiteBriefInput): SiteFacts {
  const vertical: SiteFactsVertical = input.vertical ?? 'HOSPITALITY';
  const items: SiteFactsCatalogItem[] =
    vertical === 'HOSPITALITY'
      ? input.accommodations.map((a) => ({ code: a.categoryCode, name: a.name, capacityAdults: a.capacityAdults }))
      : vertical === 'BEAUTY'
        ? (input.services ?? []).map((sv) => ({
            code: sv.code,
            name: sv.name,
            price: { minor: sv.priceMinor, currency: sv.currency },
            durationMin: sv.durationMin,
            ...(sv.category ? { category: sv.category } : {}),
          }))
        : (input.menu ?? []).flatMap((cat) =>
            cat.items.map((it) => ({
              code: it.code,
              name: it.name,
              price: { minor: it.priceMinor, currency: it.currency },
              category: cat.title,
              ...(it.weightGrams ? { weightGrams: it.weightGrams } : {}),
              hasPhoto: it.hasPhoto,
            })),
          );
  return {
    vertical,
    location: {
      id: '',
      name: input.identity.displayNameCandidate || input.identity.locationName,
      address: input.identity.address,
      phone: input.identity.phone,
      whatsapp: null,
      city: input.identity.city,
    },
    catalog: { kind: vertical === 'HOSPITALITY' ? 'rooms' : vertical === 'BEAUTY' ? 'services' : 'menu', items },
    staff: (input.staff ?? []).map((s) => ({ id: s.id, name: s.name, specialization: s.specialization })),
    hours: { days: input.hours ?? [], checkInTime: input.stay.checkInTime, checkOutTime: input.stay.checkOutTime },
    photosCount: 0,
    reviews: null,
    gaps: [],
  };
}
