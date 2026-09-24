import type { BadgeTone } from '../components/ui';
import type { SellerCategoryPrice, SellerProfileBody, SellerStatus } from './api';
import { formatMoney } from './money';

/**
 * Раздел «ИИ-продавец» стойки (ТЗ ред. 1 П6, ADR-077): то, что экраны считают сами. Без зависимостей от сервера —
 * этим файлом пользуются и серверная страница, и серверные действия.
 */

/** Вкладки раздела — экраны ТЗ §4.1 в том же порядке */
export const SELLER_TABS = [
  { view: '', href: '/ai-seller', label: 'Настройки' },
  { view: 'data', href: '/ai-seller/data', label: 'Данные объекта' },
  { view: 'knowledge', href: '/ai-seller/knowledge', label: 'Знания' },
  { view: 'dialogs', href: '/ai-seller/dialogs', label: 'Диалоги' },
  { view: 'embed', href: '/ai-seller/embed', label: 'Код для сайта' },
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

/** Полоса состояния над экранами раздела: подключён ли продавец и дошли ли до него правки */
export function sellerBanner(status: SellerStatus): SellerBanner {
  if (status.state === 'not-configured')
    return {
      tone: 'warn',
      value: 'не подключён',
      title: 'ИИ-продавец не подключён',
      text: 'Настройки можно сохранить заранее: продавец получит их, как только его подключат. Адрес и ключ продавца задаёт владелец в настройках сервера.',
    };
  if (status.state === 'other-organization')
    return {
      tone: 'warn',
      value: 'не подключён',
      title: 'ИИ-продавец для вашей организации не подключён',
      text: 'Эта копия продавца работает с другой гостиницей. Настройки можно сохранить заранее.',
    };
  if (status.lastError && status.retrying)
    return {
      tone: 'alarm',
      value: 'не принял правки',
      title: 'Продавец не принял правки',
      text: `${status.lastError}. Повторяем отправку автоматически раз в минуту.`,
    };
  // отказ по содержанию: та же версия будет отклонена снова, и сверка её сама не шлёт (ADR-077)
  if (status.lastError)
    return {
      tone: 'alarm',
      value: 'отклонил правки',
      title: 'Продавец отклонил правки',
      text: `${status.lastError}. Сами не повторяем: исправьте, что назвал продавец, и нажмите «Применить».`,
    };
  if (!status.profile.saved)
    return {
      tone: 'warn',
      value: 'не настроен',
      title: 'Продавец ещё не настроен',
      text: 'Заполните «Настройки» и нажмите «Применить».',
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
 * Поля формы «Настройки» → тело `PUT /ai-seller/profile`. Проверяет API (домен `parseSellerProfile`): здесь только
 * сборка, края пробелов не трогаются. «Запреты» и «Когда звать человека» — по одному в строке, у продавца это списки.
 * Строки частых вопросов — `faq-question-N` / `faq-answer-N`, их число — `faqCount`.
 */
export function sellerProfileFromForm(form: FormData): SellerProfileBody {
  const count = Math.min(Math.max(Number(text(form, 'faqCount')) || 0, 0), FAQ_MAX);
  return {
    botName: text(form, 'botName'),
    addressForm: text(form, 'addressForm') as SellerProfileBody['addressForm'],
    emoji: text(form, 'emoji') as SellerProfileBody['emoji'],
    replyLength: text(form, 'replyLength') as SellerProfileBody['replyLength'],
    languages: form.getAll('languages').filter((v): v is string => typeof v === 'string'),
    greeting: text(form, 'greeting'),
    includedInPrice: text(form, 'includedInPrice'),
    extraCharges: text(form, 'extraCharges'),
    houseRules: text(form, 'houseRules'),
    prohibitions: lines(form, 'prohibitions'),
    callHumanWhen: lines(form, 'callHumanWhen'),
    faq: Array.from({ length: count }, (_, i) => ({
      question: text(form, `faq-question-${i}`),
      answer: text(form, `faq-answer-${i}`),
    })),
  };
}

/**
 * Цена категории в «Данных объекта»: ровно то, что продавец скажет гостю (ADR-080, Q-179). Одна цена весь срок — она;
 * иначе продавец говорит «уточнит администратор», а стойка объясняет почему.
 */
export function categoryPriceLine(
  price: SellerCategoryPrice,
  currency: string,
): { value: string; note: string | null; known: boolean } {
  if (price.reason === 'same' && price.priceMinor !== null) {
    const guests = price.occupancy && price.occupancy > 1 ? ` за ${price.occupancy} гостей` : '';
    return { value: `${formatMoney(price.priceMinor, currency)} за ночь${guests}`, note: null, known: true };
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

