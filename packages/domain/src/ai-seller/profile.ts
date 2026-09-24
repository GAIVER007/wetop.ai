/**
 * Профиль ИИ-продавца (DATA_MODEL §15, ТЗ ред. 1 П5, Б6; ADR-076): поля экрана «Настройки».
 *
 * Платформа передаёт продавцу профиль полями, а не текстом промпта: промпт собирает бот из неизменяемого ядра правил
 * и этих полей (ТЗ §2 п. 2). Поэтому здесь нет и не может быть поля «текст промпта» — из свободного текста можно
 * стереть «не считай деньги» и «не обещай действий, которых не делаешь». Лишние ключи на входе отбрасываются.
 */

export type SellerAddressForm = 'FORMAL' | 'INFORMAL';
export type SellerReplyLength = 'SHORT' | 'MEDIUM' | 'LONG';

export interface SellerFaqItem {
  question: string;
  answer: string;
}

export interface SellerProfileInput {
  /** `null` — бот без имени */
  botName: string | null;
  addressForm: SellerAddressForm;
  useEmoji: boolean;
  replyLength: SellerReplyLength;
  /** ISO 639-1 из `SELLER_LANGUAGES`, первый — основной */
  languages: string[];
  greeting: string;
  includedInPrice: string;
  paidExtras: string;
  houseRules: string;
  prohibitions: string;
  handoffRules: string;
  faq: SellerFaqItem[];
}

/** Языки, которые можно выбрать; названия — для экрана */
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

export const SELLER_REPLY_LENGTHS: Readonly<Record<SellerReplyLength, string>> = {
  SHORT: 'коротко',
  MEDIUM: 'средне',
  LONG: 'подробно',
};

/** Пределы длины — те же, что у колонок `seller_profiles` (DATA_MODEL §15) */
export const SELLER_PROFILE_LIMITS = {
  botName: 60,
  greeting: 500,
  includedInPrice: 1000,
  paidExtras: 1000,
  houseRules: 2000,
  prohibitions: 1000,
  handoffRules: 1000,
  faqItems: 30,
  faqQuestion: 200,
  faqAnswer: 1000,
  languagesMax: 6,
} as const;

export const DEFAULT_SELLER_PROFILE: SellerProfileInput = {
  botName: null,
  addressForm: 'FORMAL',
  useEmoji: false,
  replyLength: 'SHORT',
  languages: ['ru'],
  greeting: '',
  includedInPrice: '',
  paidExtras: '',
  houseRules: '',
  prohibitions: '',
  handoffRules: '',
  faq: [],
};

type TextField =
  | 'greeting'
  | 'includedInPrice'
  | 'paidExtras'
  | 'houseRules'
  | 'prohibitions'
  | 'handoffRules';

const TEXT_FIELDS: ReadonlyArray<readonly [TextField, string]> = [
  ['greeting', 'Приветствие'],
  ['includedInPrice', 'Что входит в цену'],
  ['paidExtras', 'Что за доплату'],
  ['houseRules', 'Правила проживания'],
  ['prohibitions', 'Запреты'],
  ['handoffRules', 'Когда звать человека'],
];

/** Нулевой символ PostgreSQL в тексте не хранит — вычищается, края обрезаются */
const clean = (value: unknown): string =>
  typeof value === 'string' ? value.replaceAll('\u0000', '').trim() : '';

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
  if (addressForm !== 'FORMAL' && addressForm !== 'INFORMAL')
    errors.push('Обращение: «вы» или «ты»');

  const replyLength = has('replyLength') ? input.replyLength : DEFAULT_SELLER_PROFILE.replyLength;
  if (replyLength !== 'SHORT' && replyLength !== 'MEDIUM' && replyLength !== 'LONG')
    errors.push('Длина реплик: коротко, средне или подробно');

  const useEmoji = has('useEmoji') ? input.useEmoji === true : DEFAULT_SELLER_PROFILE.useEmoji;

  const languages: string[] = [];
  const rawLanguages = has('languages') ? input.languages : DEFAULT_SELLER_PROFILE.languages;
  if (!Array.isArray(rawLanguages)) errors.push('Языки: ожидается список');
  else {
    for (const item of rawLanguages) {
      const code = clean(item).toLowerCase();
      if (!(code in SELLER_LANGUAGES)) {
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
      useEmoji,
      replyLength: replyLength as SellerReplyLength,
      languages,
      ...texts,
      faq,
    },
  };
}

/** Профиль ровно из полей `SellerProfileInput` — без служебных полей строки базы */
export function pickSellerProfile(row: SellerProfileInput): SellerProfileInput {
  return {
    botName: row.botName,
    addressForm: row.addressForm,
    useEmoji: row.useEmoji,
    replyLength: row.replyLength,
    languages: [...row.languages],
    greeting: row.greeting,
    includedInPrice: row.includedInPrice,
    paidExtras: row.paidExtras,
    houseRules: row.houseRules,
    prohibitions: row.prohibitions,
    handoffRules: row.handoffRules,
    faq: row.faq.map((f) => ({ question: f.question, answer: f.answer })),
  };
}

/** Тело `PUT /seller/profile` (Б6, docs/assistant/README.md §4): snake_case, перечисления строчными */
export function sellerProfilePayload(profile: SellerProfileInput, updatedAt: Date) {
  return {
    bot_name: profile.botName,
    address_form: profile.addressForm.toLowerCase(),
    use_emoji: profile.useEmoji,
    reply_length: profile.replyLength.toLowerCase(),
    languages: [...profile.languages],
    greeting: profile.greeting,
    included_in_price: profile.includedInPrice,
    paid_extras: profile.paidExtras,
    house_rules: profile.houseRules,
    prohibitions: profile.prohibitions,
    handoff_rules: profile.handoffRules,
    faq: profile.faq.map((f) => ({ question: f.question, answer: f.answer })),
    updated_at: updatedAt.toISOString(),
  };
}
