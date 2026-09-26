import {
  PLATFORM_TIMEZONE,
  SELLER_ADDRESS_FORMS,
  SELLER_EMOJI,
  SELLER_LANGUAGES,
  SELLER_REPLY_LENGTHS,
} from '@pms/domain';
import type { BadgeTone } from '../components/ui';
import type {
  ExtensionAccessView,
  SellerCategoryPrice,
  SellerProfileBody,
  SellerStatus,
} from './api';
import { propertyClock } from './property-time';
import { displayDay } from './display-date';
import { formatMoney } from './money';
import { pluralRu } from './plural';

/**
 * Раздел «ИИ-продавец» стойки (ТЗ ред. 1 П6, ADR-079): то, что экраны считают сами. Без зависимостей от сервера —
 * этим файлом пользуются и серверная страница, и серверные действия.
 */

/** Вкладки раздела — экраны ТЗ §4.1 в том же порядке */
export const SELLER_TABS = [
  { view: '', href: '/ai-seller', label: 'Настройки' },
  { view: 'data', href: '/ai-seller/data', label: 'Данные объекта' },
  { view: 'knowledge', href: '/ai-seller/knowledge', label: 'Знания' },
  { view: 'dialogs', href: '/ai-seller/dialogs', label: 'Диалоги' },
  { view: 'embed', href: '/ai-seller/embed', label: 'Код для сайта' },
  { view: 'model', href: '/ai-seller/model', label: 'Модель' },
  { view: 'whatsapp', href: '/ai-seller/whatsapp', label: 'WhatsApp' },
  { view: 'check', href: '/ai-seller/check', label: 'Проверка' },
] as const;

export type SellerView = (typeof SELLER_TABS)[number]['view'];

/** Предел строк частых вопросов — как в домене и у бота (`SELLER_PROFILE_LIMITS.faqItems`) */
export const FAQ_MAX = 50;
/** Строк в «Запретах» и «Когда звать человека» — как у бота (`SELLER_PROFILE_LIMITS.listItems`) */
export const LIST_MAX = 30;

export interface SellerBanner {
  tone: 'alarm' | 'warn' | 'calm';
  /** Одно-два слова для крупной строки полосы состояния */
  value: string;
  title: string;
  text: string;
}

/** Кто и почему не может менять настройки — одной строкой для шагов и форм; `null` — может */
export function sellerReadOnlyReason(status: SellerStatus): string | null {
  if (status.state === 'extension-expired')
    return 'Срок расширения вышел: настройки только для просмотра. Продлевает администратор WETOP.';
  // старый API ролей не знает — тогда настраивать может каждый, как было до ADR-083
  if (status.canConfigure === false) return 'Настройки продавца меняет владелец организации.';
  return null;
}

/** Подключена ли копия продавца — для экранов, которые читают у продавца и после срока расширения */
export function sellerConnected(status: SellerStatus): boolean {
  return (status.connection ?? status.state) === 'ready';
}

/** Отвечать гостям, говорить с продавцом в «Проверке» и брать код для сайта — только при действующем расширении */
export function sellerCanAct(status: SellerStatus): boolean {
  return status.state === 'ready';
}

/**
 * Последний день расширения — по поясу платформы: срок хранится моментом начала следующего дня в том же
 * поясе, в каком его пишет домен (`PLATFORM_TIMEZONE`, DATA_MODEL §16.3)
 */
export function extensionLastDay(activeUntil: string): string {
  const t = Date.parse(activeUntil);
  return Number.isNaN(t)
    ? ''
    : propertyClock(PLATFORM_TIMEZONE).date(new Date(t - 1).toISOString());
}

/** Напоминание владельцу организации за 7 дней и в последний день (Q-183); бессрочно или дальше — `null` */
export function extensionReminder(
  extension: ExtensionAccessView | null | undefined,
): string | null {
  if (!extension || extension.access !== 'active' || !extension.activeUntil) return null;
  const days = extension.daysLeft;
  if (days === null || days > 7) return null;
  const day = displayDay(extensionLastDay(extension.activeUntil));
  const what =
    extension.status === 'TRIAL' ? 'Пробный доступ к ИИ-продавцу' : 'Расширение «ИИ-продавец»';
  const left =
    days <= 1
      ? `действует последний день — по ${day}`
      : `действует ещё ${pluralRu(days, ['день', 'дня', 'дней'])} — по ${day}`;
  return `${what} ${left}. Потом раздел останется только для чтения. Продлевает администратор WETOP после оплаты.`;
}

/** Полоса состояния над экранами раздела: подключён ли продавец и дошли ли до него правки */
export function sellerBanner(status: SellerStatus): SellerBanner {
  if (status.state === 'extension-off')
    return {
      tone: 'warn',
      value: 'не подключён',
      title: 'Расширение «ИИ-продавец» не подключено',
      text: 'Раздел открывается организациям с подключённым расширением. Подключает администратор WETOP после оплаты по счёту.',
    };
  if (status.state === 'extension-expired')
    return {
      tone: 'alarm',
      value: 'срок вышел',
      title: 'Срок расширения «ИИ-продавец» вышел',
      text: 'Раздел только для чтения: настройки, знания и диалоги видны, но отвечать гостям и менять настройки нельзя. Ничего не удалено. Продлевает администратор WETOP.',
    };
  if (status.state === 'not-configured')
    return {
      tone: 'warn',
      value: 'не подключён',
      title: 'ИИ-продавец не подключён',
      text: 'Настройки можно сохранить заранее: продавец получит их, как только его подключат. Адрес и ключ продавца задаёт владелец в настройках сервера.',
    };
  if (status.lastError && status.retrying)
    return {
      tone: 'alarm',
      value: 'не принял правки',
      title: 'Продавец не принял правки',
      text: `${status.lastError}. Повторяем отправку автоматически раз в минуту.`,
    };
  // отказ по содержанию: та же версия будет отклонена снова, и сверка её сама не шлёт (ADR-079)
  if (status.lastError)
    return {
      tone: 'alarm',
      value: 'отклонил правки',
      title: 'Продавец отклонил правки',
      text: `${status.lastError}. Сами не повторяем: исправьте, что назвал продавец, и нажмите «Применить» на шаге «Запуск».`,
    };
  if (!status.profile.saved)
    return {
      tone: 'warn',
      value: 'не настроен',
      title: 'Продавец ещё не настроен',
      text: 'Пройдите шаги во вкладке «Настройки» и нажмите «Применить» на последнем — «Запуск».',
    };
  if (status.profile.applied && status.facts.applied)
    return {
      tone: 'calm',
      value: 'работает',
      title: 'Продавец работает с текущими настройками',
      text: 'Правки настроек, карточки объекта и цен уходят продавцу сами.',
    };
  return {
    tone: 'warn',
    value: 'правки в пути',
    title: 'Правки ещё в пути',
    text: 'Настройки или данные объекта изменились — отправим продавцу в течение минуты.',
  };
}

/**
 * Шаги настройки продавца (поручение владельца 25.09.2026, `plans/ai-seller-setup-wizard-2026-09-25.md`): «Настройки» —
 * не одна длинная форма, а онбординг. Поля — те же, что в профиле (DATA_MODEL §15): шаг только раскладывает их по
 * порядку, в котором владелец о них думает.
 */
export const SELLER_SETUP_STEPS = [
  {
    step: 1,
    key: 'intro',
    title: 'Знакомство',
    hint: 'Как продавец представится гостю и на каких языках ответит.',
  },
  { step: 2, key: 'manner', title: 'Манера', hint: 'На «вы» или на «ты», эмодзи и длина ответов.' },
  {
    step: 3,
    key: 'prices',
    title: 'Цены',
    hint: 'Какие цены продавец назовёт гостю и что в них входит.',
  },
  {
    step: 4,
    key: 'rules',
    title: 'Правила',
    hint: 'Правила проживания, запреты и когда звать человека.',
  },
  {
    step: 5,
    key: 'faq',
    title: 'Частые вопросы',
    hint: 'Готовые ответы на то, о чём гости спрашивают чаще всего.',
  },
  {
    step: 6,
    key: 'docs',
    title: 'Документы',
    hint: 'Прайс, описание, правила файлом — продавец ответит и по ним.',
  },
  {
    step: 7,
    key: 'launch',
    title: 'Запуск',
    hint: 'Проверьте, что знает продавец, и отправьте ему настройки.',
  },
] as const;

export type SellerSetupKey = (typeof SELLER_SETUP_STEPS)[number]['key'];
/** Шаги с полями профиля — их сохраняют «Назад» и «Сохранить и дальше» */
export type SellerProfileStep = Exclude<SellerSetupKey, 'docs' | 'launch'>;

/** `later` — шаг заработает, когда продавец будет подключён; `optional` — можно пропустить */
export type SellerStepState = 'done' | 'todo' | 'optional' | 'later';

export interface SellerStepProgress {
  step: number;
  key: SellerSetupKey;
  title: string;
  hint: string;
  state: SellerStepState;
  /** Состояние словом: цвет в списке шагов — только в дополнение к нему (DESIGN.md §1, п. 4) */
  word: string;
}

const filled = (value: string) => value.trim() !== '';

/**
 * Состояние шагов по сохранённому профилю. Какие шаги человек открывал, платформа не хранит, поэтому «готово» — по
 * содержанию: у манеры есть умолчание у каждого поля, и она готова, как только профиль сохранён.
 */
export function sellerSetupProgress(input: {
  saved: boolean;
  profile: SellerProfileBody;
  /** Документов, загруженных людьми; `null` — продавец не подключён, и списка нет */
  documents: number | null;
  /** Продавец принял текущие настройки и данные объекта */
  applied: boolean;
}): SellerStepProgress[] {
  const { saved, profile: p, documents, applied } = input;
  const done: Record<SellerProfileStep, boolean> = {
    intro: saved && filled(p.greeting),
    manner: saved,
    prices: saved && (filled(p.includedInPrice) || filled(p.extraCharges)),
    rules:
      saved && (filled(p.houseRules) || p.prohibitions.length > 0 || p.callHumanWhen.length > 0),
    faq: saved && p.faq.length > 0,
  };
  return SELLER_SETUP_STEPS.map((s) => {
    let state: SellerStepState;
    let word: string;
    if (s.key === 'docs') {
      state = documents === null ? 'later' : documents > 0 ? 'done' : 'optional';
      word = state === 'later' ? 'после подключения' : state === 'done' ? 'готово' : 'по желанию';
    } else if (s.key === 'launch') {
      state = applied ? 'done' : 'todo';
      word = applied ? 'отправлено' : 'не отправлено';
    } else {
      state = done[s.key] ? 'done' : 'todo';
      word = state === 'done' ? 'готово' : 'не заполнено';
    }
    return { step: s.step, key: s.key, title: s.title, hint: s.hint, state, word };
  });
}

/** Какой шаг открыть, если в адресе шага нет: первый незаполненный из шагов с полями, иначе «Запуск» */
export function defaultSellerStep(progress: SellerStepProgress[]): number {
  const next = progress.find((p) => p.key !== 'docs' && p.key !== 'launch' && p.state === 'todo');
  return next ? next.step : SELLER_SETUP_STEPS.length;
}

/** Номер шага из адреса (`?step=3`): только 1…7 цифрой, остальное — не шаг */
export function sellerStepNumber(raw: string): number | null {
  if (!/^[1-9]$/.test(raw)) return null;
  const n = Number(raw);
  return n <= SELLER_SETUP_STEPS.length ? n : null;
}

/** Документы, которые загрузили люди: документ фактов собирает сам продавец из «Данных объекта» */
export function userDocuments(items: ReadonlyArray<{ source: string }>): number {
  return items.filter((d) => d.source !== 'platform:facts.md').length;
}

/**
 * Как звучит каждый вариант «Манеры» — пример фразы продавца рядом с вариантом: выбирают по звучанию, а не по слову.
 * Ключи — значения домена (`SELLER_ADDRESS_FORMS`, `SELLER_EMOJI`, `SELLER_REPLY_LENGTHS`).
 */
export const SELLER_MANNER_EXAMPLES = {
  addressForm: {
    FORMAL: '«Здравствуйте! Чем могу вам помочь?»',
    INFORMAL: '«Привет! Чем могу тебе помочь?»',
  },
  emoji: {
    NEVER: '«Номер свободен на эти даты.»',
    MODERATE: '«Номер свободен на эти даты 👍»',
    GREETING_ONLY: '«Здравствуйте! 👋» — дальше без эмодзи',
  },
  replyLength: {
    SHORT: 'одно-два предложения, по делу',
    DETAILED: 'подробнее: с пояснениями и вариантами',
  },
} as const satisfies {
  addressForm: Record<SellerProfileBody['addressForm'], string>;
  emoji: Record<SellerProfileBody['emoji'], string>;
  replyLength: Record<SellerProfileBody['replyLength'], string>;
};

/**
 * Подписи полей для итога рассказа (С1 «под ключ»): теми же словами, что поля мастера.
 * Ключи — имена полей из ответа `POST /ai-seller/extract` (`filled`, `skipped`, `rejected`).
 */
export const SELLER_STORY_FIELD_LABELS: Readonly<Record<string, string>> = {
  botName: 'Имя бота',
  greeting: 'Приветствие',
  includedInPrice: 'Что входит в цену',
  extraCharges: 'Что за доплату',
  houseRules: 'Правила проживания',
  prohibitions: 'Запреты',
  callHumanWhen: 'Когда звать человека',
  faq: 'Частые вопросы',
  objectName: 'Название объекта',
};

/** Имена полей словами: «botName, faq» → «Имя бота, Частые вопросы»; незнакомое имя — как пришло */
export function sellerStoryFieldWords(names: string[]): string {
  return names.map((name) => SELLER_STORY_FIELD_LABELS[name] ?? name).join(', ');
}

/** Вопросы, которые гости задают чаще всего, — подсказки шага «Частые вопросы»: щелчок добавляет строку */
export const SELLER_FAQ_SUGGESTIONS: readonly string[] = [
  'Можно заселиться раньше?',
  'Есть ли парковка?',
  'Как добраться из аэропорта?',
  'Можно с животными?',
  'Есть ли завтрак?',
  'Где оставить вещи после выезда?',
];

const text = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};

/** Поле «по одному в строке» → список: края строк обрезаются, пустые строки — не правила */
const lines = (form: FormData, name: string): string[] =>
  text(form, name)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

/**
 * Поля шага → профиль целиком для `PUT /ai-seller/profile`: шаг меняет только свои поля, остальные берутся из
 * сохранённого профиля. Чужие поля в форме шага не читаются — даже если их подложили. Проверяет API (домен
 * `parseSellerProfile`): здесь только сборка, края пробелов не трогаются. Строки частых вопросов —
 * `faq-question-N` / `faq-answer-N`, их число — `faqCount`.
 */
export function sellerStepFromForm(
  key: SellerProfileStep,
  form: FormData,
  current: SellerProfileBody,
): SellerProfileBody {
  switch (key) {
    case 'intro':
      return {
        ...current,
        botName: text(form, 'botName'),
        greeting: text(form, 'greeting'),
        languages: form.getAll('languages').filter((v): v is string => typeof v === 'string'),
      };
    case 'manner':
      return {
        ...current,
        addressForm: text(form, 'addressForm') as SellerProfileBody['addressForm'],
        emoji: text(form, 'emoji') as SellerProfileBody['emoji'],
        replyLength: text(form, 'replyLength') as SellerProfileBody['replyLength'],
      };
    case 'prices':
      return {
        ...current,
        includedInPrice: text(form, 'includedInPrice'),
        extraCharges: text(form, 'extraCharges'),
      };
    case 'rules':
      return {
        ...current,
        houseRules: text(form, 'houseRules'),
        prohibitions: lines(form, 'prohibitions'),
        callHumanWhen: lines(form, 'callHumanWhen'),
      };
    case 'faq': {
      const count = Math.min(Math.max(Number(text(form, 'faqCount')) || 0, 0), FAQ_MAX);
      return {
        ...current,
        faq: Array.from({ length: count }, (_, i) => ({
          question: text(form, `faq-question-${i}`),
          answer: text(form, `faq-answer-${i}`),
        })),
      };
    }
  }
}

/** Случаи, когда продавец зовёт человека всегда, без списка владельца (правила ядра бота) */
const ALWAYS_HUMAN = 'всегда — жалоба, возврат денег, изменение или отмена брони';

/**
 * «Что получит продавец» на шаге «Запуск»: инструкция словами, а не текстом промпта. Промпт собирает бот из
 * неизменяемого ядра и этих полей (ТЗ §2 п. 2) — владелец видит, что из его ответов попадёт в разговор с гостем.
 */
export function sellerBriefing(p: SellerProfileBody): Array<{ label: string; value: string }> {
  const dash = (value: string) => (filled(value) ? value.trim() : '—');
  const languages = p.languages
    .map((code, i) => `${SELLER_LANGUAGES[code] ?? code}${i === 0 ? ' (основной)' : ''}`)
    .join(', ');
  return [
    {
      label: 'Представляется',
      value:
        p.botName && filled(p.botName) ? `«${p.botName.trim()}»` : 'без имени — от лица гостиницы',
    },
    { label: 'Обращается к гостю', value: SELLER_ADDRESS_FORMS[p.addressForm] ?? p.addressForm },
    { label: 'Эмодзи', value: SELLER_EMOJI[p.emoji] ?? p.emoji },
    { label: 'Ответы', value: SELLER_REPLY_LENGTHS[p.replyLength] ?? p.replyLength },
    { label: 'Языки', value: languages || '—' },
    { label: 'Приветствие', value: dash(p.greeting) },
    { label: 'Что входит в цену', value: dash(p.includedInPrice) },
    { label: 'За доплату', value: dash(p.extraCharges) },
    { label: 'Правила проживания', value: dash(p.houseRules) },
    { label: 'Запреты', value: p.prohibitions.length > 0 ? p.prohibitions.join('; ') : '—' },
    { label: 'Зовёт человека', value: [...p.callHumanWhen, ALWAYS_HUMAN].join('; ') },
    {
      label: 'Частые вопросы',
      value:
        p.faq.length > 0
          ? pluralRu(p.faq.length, ['готовый ответ', 'готовых ответа', 'готовых ответов'])
          : '—',
    },
  ];
}

/**
 * Цена категории в «Данных объекта»: ровно то, что продавец скажет гостю (ADR-081, Q-179). Одна цена весь срок — она;
 * иначе продавец говорит «уточнит администратор», а стойка объясняет почему.
 */
export function categoryPriceLine(
  price: SellerCategoryPrice,
  currency: string,
): { value: string; note: string | null; known: boolean } {
  if (price.reason === 'same' && price.priceMinor !== null) {
    const guests = price.occupancy && price.occupancy > 1 ? ` за ${price.occupancy} гостей` : '';
    return {
      value: `${formatMoney(price.priceMinor, currency)} за ночь${guests}`,
      note: null,
      known: true,
    };
  }
  if (price.reason === 'varies' && price.min !== null && price.max !== null)
    return {
      value: 'уточнит администратор',
      note: `цена меняется по датам: от ${formatMoney(price.min, currency)} до ${formatMoney(price.max, currency)}`,
      known: false,
    };
  return { value: 'уточнит администратор', note: 'в тарифе сайта цены нет', known: false };
}

/** Документ фактов, который бот собирает из «Данных объекта» (`platform:facts.md`), — словами, а не именем файла */
export function knowledgeSourceLabel(source: string): string {
  return source === 'platform:facts.md' ? 'Данные объекта (от платформы)' : source;
}

/** Режим диалога словами стойки; «нужен человек» — пометка, которую ищут глазами (ТЗ §4.1) */
export function conversationModeLabel(mode: string): { label: string; tone: BadgeTone } {
  if (mode === 'needs_human') return { label: 'нужен человек', tone: 'warn' };
  if (mode === 'owner_takeover') return { label: 'ведёт человек', tone: 'info' };
  if (mode === 'bot_active') return { label: 'ведёт бот', tone: 'neutral' };
  return { label: mode, tone: 'neutral' };
}

/**
 * Что продавец узнал о госте: поля ядра бота (`LeadFields`) и ключи свободной сумки `extra`, которые бот отдаёт в бронь
 * (`create_lead`, `src/integrations/wetop.py`), — словами стойки; остальные ключи `extra` задаёт промпт — как есть
 */
const LEAD_LABELS: Readonly<Record<string, string>> = {
  interest: 'Что ищет',
  budget: 'Бюджет',
  timeframe: 'Когда',
  notes: 'Заметки',
  arrival: 'Заезд',
  departure: 'Выезд',
  category: 'Категория',
  guests: 'Гостей',
};
/** Контакт стоит в карточке отдельно — в сведениях о госте он не повторяется */
const LEAD_CONTACT = new Set(['name', 'phone', 'email']);

const leadValue = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
};

export function leadFacts(data: Record<string, unknown>): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [];
  const push = (key: string, raw: unknown) => {
    const value = leadValue(raw);
    if (value !== null) out.push({ label: LEAD_LABELS[key] ?? key, value });
  };
  for (const [key, raw] of Object.entries(data)) {
    if (LEAD_CONTACT.has(key)) continue;
    if (key === 'extra') {
      if (raw && typeof raw === 'object' && !Array.isArray(raw))
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) push(k, v);
      continue;
    }
    push(key, raw);
  }
  return out;
}

/** Этап воронки продавца (FunnelStage бота) словами стойки */
const STAGES: Readonly<Record<string, string>> = {
  new: 'новый',
  qualifying: 'уточняет',
  presenting: 'выбирает',
  objection: 'сомневается',
  closing: 'готов бронировать',
  won: 'договорились',
  lost: 'ушёл',
};

export function conversationStageLabel(stage: string): string {
  if (!stage) return '—';
  return STAGES[stage] ?? stage;
}

/** Канал диалога словами стойки */
export function conversationChannelLabel(channel: string | null): string {
  if (!channel) return '—';
  if (channel === 'widget') return 'чат на сайте';
  if (channel === 'sandbox') return 'проверка';
  return channel;
}
