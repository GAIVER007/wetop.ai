/**
 * Профиль ИИ-продавца (DATA_MODEL §15, ТЗ ред. 1 П5, Б6; ADR-078, ADR-079): поля экрана «Настройки».
 *
 * Платформа передаёт продавцу профиль полями, а не текстом промпта: промпт собирает бот из неизменяемого ядра правил
 * и этих полей (ТЗ §2 п. 2). Поэтому здесь нет и не может быть поля «текст промпта» — из свободного текста можно
 * стереть «не считай деньги» и «не обещай действий, которых не делаешь». Лишние ключи на входе отбрасываются.
 *
 * Перечисления и пределы — ровно модели бота `SellerProfile` (`src/ai/seller_prompt.py` на ветке `ai-seller`): она
 * принимает профиль с `extra='forbid'`, и лишнее поле или значение вне списка у неё — отказ 422.
 */

export type SellerAddressForm = 'FORMAL' | 'INFORMAL';
export type SellerEmoji = 'NEVER' | 'MODERATE' | 'GREETING_ONLY';
export type SellerReplyLength = 'SHORT' | 'DETAILED';

export interface SellerFaqItem {
  question: string;
  answer: string;
}

export interface SellerProfileInput {
  /** `null` — бот без имени */
  botName: string | null;
  addressForm: SellerAddressForm;
  emoji: SellerEmoji;
  replyLength: SellerReplyLength;
  /** ISO 639-1 из `SELLER_LANGUAGES`, первый — основной */
  languages: string[];
  greeting: string;
  includedInPrice: string;
  extraCharges: string;
  houseRules: string;
  /** Запреты заказчика, по одному в строке */
  prohibitions: string[];
  /** Когда звать человека, по одному в строке */
  callHumanWhen: string[];
  faq: SellerFaqItem[];
}

/** Языки, которые можно выбрать; названия — для экрана, строчными они уходят продавцу (бот вставляет их в промпт) */
export const SELLER_LANGUAGES: Readonly<Record<string, string>> = {
  ru: 'Русский',
  kk: 'Казахский',
  en: 'Английский',
  zh: 'Китайский',
  uz: 'Узбекский',
  ky: 'Киргизский',
  tr: 'Турецкий',
  ko: 'Корейский',
  de: 'Немецкий',
  fr: 'Французский',
  es: 'Испанский',
  ar: 'Арабский',
};

export const SELLER_ADDRESS_FORMS: Readonly<Record<SellerAddressForm, string>> = {
  FORMAL: 'на «вы»',
  INFORMAL: 'на «ты»',
};

export const SELLER_EMOJI: Readonly<Record<SellerEmoji, string>> = {
  NEVER: 'без эмодзи',
  MODERATE: 'изредка',
  GREETING_ONLY: 'только в приветствии',
};

export const SELLER_REPLY_LENGTHS: Readonly<Record<SellerReplyLength, string>> = {
  SHORT: 'коротко',
  DETAILED: 'развёрнуто',
};

/** Пределы длины — пределы модели бота; те же у колонок `seller_profiles` (DATA_MODEL §15) */
export const SELLER_PROFILE_LIMITS = {
  botName: 40,
  greeting: 300,
  includedInPrice: 1000,
  extraCharges: 1000,
  houseRules: 2000,
  /** Строк в списках «Запреты» и «Когда звать человека» */
  listItems: 30,
  listItem: 300,
  faqItems: 50,
  faqQuestion: 300,
  faqAnswer: 1000,
  languagesMax: 6,
  /** Название объекта у бота обязательно и не длиннее 120 знаков */
  objectName: 120,
} as const;

export const DEFAULT_SELLER_PROFILE: SellerProfileInput = {
  botName: null,
  addressForm: 'FORMAL',
  emoji: 'NEVER',
  replyLength: 'SHORT',
  languages: ['ru'],
  greeting: '',
  includedInPrice: '',
  extraCharges: '',
  houseRules: '',
  prohibitions: [],
  callHumanWhen: [],
  faq: [],
};

type TextField = 'greeting' | 'includedInPrice' | 'extraCharges' | 'houseRules';
type ListField = 'prohibitions' | 'callHumanWhen';

const TEXT_FIELDS: ReadonlyArray<readonly [TextField, string]> = [
  ['greeting', 'Приветствие'],
  ['includedInPrice', 'Что входит в цену'],
  ['extraCharges', 'Что за доплату'],
  ['houseRules', 'Правила проживания'],
];

const LIST_FIELDS: ReadonlyArray<readonly [ListField, string]> = [
  ['prohibitions', 'Запреты'],
  ['callHumanWhen', 'Когда звать человека'],
];

/** Нулевой символ PostgreSQL в тексте не хранит — вычищается, края обрезаются */
const clean = (value: unknown): string =>
  typeof value === 'string' ? value.replaceAll('\u0000', '').trim() : '';

const oneOf = <T extends string>(value: unknown, allowed: Readonly<Record<T, string>>): value is T =>
  typeof value === 'string' && Object.hasOwn(allowed, value);

export type SellerProfileParse =
  | { ok: true; value: SellerProfileInput }
  | { ok: false; errors: string[] };

/** Проверка полей «Настроек». Не указанное — умолчание; все причины отказа называются сразу */
export function parseSellerProfile(raw: unknown): SellerProfileParse {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { ok: false, errors: ['Профиль: ожидается объект'] };
  const input = raw as Record<string, unknown>;
  const errors: string[] = [];
  const has = (key: string) => input[key] !== undefined;

  const botName = has('botName') ? clean(input.botName) : '';
  if (botName.length > SELLER_PROFILE_LIMITS.botName)
    errors.push(`Имя бота: не длиннее ${SELLER_PROFILE_LIMITS.botName} знаков`);

  const addressForm = has('addressForm') ? input.addressForm : DEFAULT_SELLER_PROFILE.addressForm;
  if (!oneOf(addressForm, SELLER_ADDRESS_FORMS)) errors.push('Обращение: «вы» или «ты»');

  const emoji = has('emoji') ? input.emoji : DEFAULT_SELLER_PROFILE.emoji;
  if (!oneOf(emoji, SELLER_EMOJI))
    errors.push('Эмодзи: без эмодзи, изредка или только в приветствии');

  const replyLength = has('replyLength') ? input.replyLength : DEFAULT_SELLER_PROFILE.replyLength;
  if (!oneOf(replyLength, SELLER_REPLY_LENGTHS)) errors.push('Длина реплик: коротко или развёрнуто');

  const languages: string[] = [];
  const rawLanguages = has('languages') ? input.languages : DEFAULT_SELLER_PROFILE.languages;
  if (!Array.isArray(rawLanguages)) errors.push('Языки: ожидается список');
  else {
    for (const item of rawLanguages) {
      const code = clean(item).toLowerCase();
      if (!Object.hasOwn(SELLER_LANGUAGES, code)) {
        errors.push(`Языки: неизвестный код «${code}»`);
        continue;
      }
      if (!languages.includes(code)) languages.push(code);
    }
    if (rawLanguages.length === 0) errors.push('Языки: нужен хотя бы один');
    else if (languages.length > SELLER_PROFILE_LIMITS.languagesMax)
      errors.push(`Языки: не больше ${SELLER_PROFILE_LIMITS.languagesMax}`);
  }

  const texts = {} as Record<TextField, string>;
  for (const [field, label] of TEXT_FIELDS) {
    const value = has(field) ? clean(input[field]) : '';
    const max = SELLER_PROFILE_LIMITS[field];
    if (value.length > max) errors.push(`${label}: не длиннее ${max} знаков`);
    texts[field] = value;
  }

  const lists = {} as Record<ListField, string[]>;
  for (const [field, label] of LIST_FIELDS) {
    const rawList = has(field) ? input[field] : [];
    if (!Array.isArray(rawList)) {
      errors.push(`${label}: ожидается список`);
      lists[field] = [];
      continue;
    }
    // пустая строка формы — не правило, а незаполненное поле
    const items = rawList.map(clean).filter((item) => item !== '');
    if (items.length > SELLER_PROFILE_LIMITS.listItems)
      errors.push(`${label}: не больше ${SELLER_PROFILE_LIMITS.listItems} строк`);
    items.forEach((item, i) => {
      if (item.length > SELLER_PROFILE_LIMITS.listItem)
        errors.push(`${label}, строка ${i + 1}: не длиннее ${SELLER_PROFILE_LIMITS.listItem} знаков`);
    });
    lists[field] = items;
  }

  const faq: SellerFaqItem[] = [];
  const rawFaq = has('faq') ? input.faq : [];
  if (!Array.isArray(rawFaq)) errors.push('Частые вопросы: ожидается список');
  else {
    const rows = rawFaq
      .map((row) => {
        const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
        return { question: clean(r.question), answer: clean(r.answer) };
      })
      // строка, где не заполнено ничего, — пустая строка формы, а не ошибка
      .filter((r) => r.question !== '' || r.answer !== '');
    if (rows.length > SELLER_PROFILE_LIMITS.faqItems)
      errors.push(`Частые вопросы: не больше ${SELLER_PROFILE_LIMITS.faqItems}`);
    rows.forEach((r, i) => {
      const line = `Частые вопросы, строка ${i + 1}`;
      if (r.question === '' || r.answer === '') errors.push(`${line}: нужны и вопрос, и ответ`);
      else if (r.question.length > SELLER_PROFILE_LIMITS.faqQuestion)
        errors.push(`${line}: вопрос не длиннее ${SELLER_PROFILE_LIMITS.faqQuestion} знаков`);
      else if (r.answer.length > SELLER_PROFILE_LIMITS.faqAnswer)
        errors.push(`${line}: ответ не длиннее ${SELLER_PROFILE_LIMITS.faqAnswer} знаков`);
      faq.push(r);
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      botName: botName === '' ? null : botName,
      addressForm: addressForm as SellerAddressForm,
      emoji: emoji as SellerEmoji,
      replyLength: replyLength as SellerReplyLength,
      languages,
      ...texts,
      ...lists,
      faq,
    },
  };
}

/** Профиль ровно из полей `SellerProfileInput` — без служебных полей строки базы */
export function pickSellerProfile(row: SellerProfileInput): SellerProfileInput {
  return {
    botName: row.botName,
    addressForm: row.addressForm,
    emoji: row.emoji,
    replyLength: row.replyLength,
    languages: [...row.languages],
    greeting: row.greeting,
    includedInPrice: row.includedInPrice,
    extraCharges: row.extraCharges,
    houseRules: row.houseRules,
    prohibitions: [...row.prohibitions],
    callHumanWhen: [...row.callHumanWhen],
    faq: row.faq.map((f) => ({ question: f.question, answer: f.answer })),
  };
}

/** Тело `PUT /seller/profile` — модель бота `SellerProfile` (Б6, docs/assistant/README.md §4) */
export interface SellerProfilePayload {
  object_name: string;
  bot_name: string | null;
  address_form: 'vy' | 'ty';
  emoji: 'never' | 'moderate' | 'greeting_only';
  reply_length: 'short' | 'detailed';
  languages: string[];
  greeting: string;
  included_in_price: string;
  extra_charges: string;
  house_rules: string;
  prohibitions: string[];
  call_human_when: string[];
  faq: Array<{ q: string; a: string }>;
}

/**
 * Профиль для продавца. Название объекта бот требует в самом профиле («Ты продавец „…“»): оно берётся из карточки
 * объекта при каждой отправке, а не хранится здесь, и длиннее предела бота обрезается. Языки уходят названиями —
 * бот вставляет их в промпт как есть («Языки: русский, казахский»).
 */
export function sellerProfilePayload(
  profile: SellerProfileInput,
  objectName: string,
): SellerProfilePayload {
  return {
    object_name: objectName.trim().slice(0, SELLER_PROFILE_LIMITS.objectName),
    bot_name: profile.botName,
    address_form: profile.addressForm === 'INFORMAL' ? 'ty' : 'vy',
    emoji: profile.emoji.toLowerCase() as SellerProfilePayload['emoji'],
    reply_length: profile.replyLength.toLowerCase() as SellerProfilePayload['reply_length'],
    languages: profile.languages.map((code) => (SELLER_LANGUAGES[code] ?? code).toLowerCase()),
    greeting: profile.greeting,
    included_in_price: profile.includedInPrice,
    extra_charges: profile.extraCharges,
    house_rules: profile.houseRules,
    prohibitions: [...profile.prohibitions],
    call_human_when: [...profile.callHumanWhen],
    faq: profile.faq.map((f) => ({ q: f.question, a: f.answer })),
  };
}
