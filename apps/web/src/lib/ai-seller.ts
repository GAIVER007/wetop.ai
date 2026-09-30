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

/** Вкладки раздела — четыре экрана по макету владельца 26.09.2026 (план `plans/seller-prompt-window-2026-09-26.md`) */
export const SELLER_TABS = [
  { view: '', href: '/ai-seller', label: 'Настройка' },
  { view: 'dialogs', href: '/ai-seller/dialogs', label: 'Диалоги' },
  { view: 'knowledge', href: '/ai-seller/knowledge', label: 'Знания' },
  { view: 'connections', href: '/ai-seller/connections', label: 'Подключения' },
] as const;

export type SellerView = (typeof SELLER_TABS)[number]['view'];

/** Инструкция продавцу одним текстом: предел — как у API и колонки `seller_profiles.prompt_text` (ADR-097) */
export const SELLER_PROMPT_MAX = 20_000;

/** Прежние адреса восьми вкладок ведут в новые экраны: закладки и ссылки из писем не ломаются */
export const SELLER_LEGACY_VIEWS: Readonly<Record<string, SellerView>> = {
  data: 'knowledge',
  model: 'connections',
  embed: 'connections',
  whatsapp: 'connections',
  check: '',
};

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
  if (status.canConfigure === false) return 'Настройки продавца меняют владелец и управляющий.';
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
      text: `${status.lastError}. Сами не повторяем: исправьте, что назвал продавец, и нажмите «Сохранить и применить» во вкладке «Настройка».`,
    };
  if (!status.profile.saved)
    return {
      tone: 'warn',
      value: 'не настроен',
      title: 'Продавец ещё не настроен',
      text: 'Опишите продавца своими словами во вкладке «Настройка» и нажмите «Сохранить и применить».',
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

export interface SellerChecklistItem {
  key: 'connect' | 'model' | 'prompt' | 'check';
  title: string;
  hint: string;
  done: boolean;
  /** Куда вести кнопкой шага; нет — шаг делается здесь же, на «Настройке» */
  href?: string;
}

/**
 * «Три шага до запуска» (макет владельца 26.09.2026): вместо семи бейджей «не заполнено» — только то, что осталось.
 * Ключ модели и инструкция у продавца — чек-листа нет. `keySet: null` — продавец не подключён, ключ не спросить.
 */
export function sellerChecklist(
  status: SellerStatus,
  keySet: boolean | null,
  prompt: { saved: boolean; applied: boolean } | null,
): SellerChecklistItem[] | null {
  const items: SellerChecklistItem[] = [];
  if (!sellerConnected(status))
    items.push({
      key: 'connect',
      title: 'Подключить продавца',
      hint: 'Адрес и ключ продавца задаются на сервере — это делает администратор WETOP.',
      done: false,
    });
  items.push({
    key: 'model',
    title: 'Проверить модель',
    hint: keySet
      ? 'Ключ модели сохранён.'
      : 'Личный ключ не задан. Если модель подключена платформой, проверьте ответ в «Проверке». Свой ключ можно добавить в подключениях.',
    done: keySet === true,
    href: '/ai-seller/connections',
  });
  items.push({
    key: 'prompt',
    title: 'Написать инструкцию',
    hint: prompt?.applied
      ? 'Сохранена и отправлена продавцу.'
      : prompt?.saved
        ? 'Сохранена, но ещё не у продавца: нажмите «Сохранить и применить».'
        : 'Опишите продавца своими словами ниже.',
    done: prompt?.applied === true,
  });
  if (items.every((item) => item.done)) return null;
  items.push({
    key: 'check',
    title: 'Проверить ответ',
    hint: 'Напишите продавцу в «Проверке» так, как написал бы гость.',
    done: false,
  });
  return items;
}

const lines = (items: readonly string[]) =>
  items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `- ${item}`);

/**
 * Черновик инструкции, пока владелец её не написал (ADR-097): разделы скелета кита, которые пишутся под заказчика
 * (`apps/ai-seller/sistemnyy-prompt.md` §5, §7, §8), и всё, что уже сохранено полями прежних шагов, — при переходе на
 * одно окно ничего не теряется. Роль, границы, главные правила и общий список «когда звать человека» бот ставит сам
 * выше текста. Порядок — как в скелете: правила раньше стиля, примеры последними. Цен и остатка в черновике нет: их
 * продавец берёт из данных объекта сам.
 */
export function sellerPromptDraft(profile: SellerProfileBody | null): string {
  const p = profile;
  const name = p?.botName?.trim();
  const languages = (p?.languages.length ? p.languages : ['ru']).map((code) =>
    (SELLER_LANGUAGES[code] ?? code).toLowerCase(),
  );
  const parts = [
    'Разговор по шагам',
    ...lines([
      'При подборе размещения уточняй только недостающие даты, количество гостей и тип размещения. Для справочного вопроса подбор не начинай.',
      'Подбери подходящий вариант и расскажи о нём.',
      'При желании оформить бронь используй контакт канала и только проверенные действия платформы.',
    ]),
  ];
  const rules = lines([
    p?.includedInPrice.trim() ? `Входит в цену: ${p.includedInPrice.trim()}` : '',
    p?.extraCharges.trim() ? `За доплату: ${p.extraCharges.trim()}` : '',
    ...(p?.houseRules.split('\n') ?? []),
  ]);
  if (rules.length) parts.push('', 'Правила объекта', ...rules);
  if (p?.prohibitions.length) parts.push('', 'Чего не делать', ...lines(p.prohibitions));
  if (p?.callHumanWhen.length)
    parts.push('', 'Когда ещё звать человека', ...lines(p.callHumanWhen));
  parts.push(
    '',
    'Стиль',
    ...lines([
      'Сначала ответь прямо на вопрос: обычно достаточно 1–3 коротких предложений.',
      'Не повторяй уже известные сведения, приветствия и рекламные предложения. Не добавляй список своих возможностей к каждому ответу.',
      'Задавай не больше одного необходимого уточняющего вопроса за сообщение, только если без него нельзя помочь. Не спрашивай повторно то, что уже известно из диалога. Если нужны даты и тип номера, сначала уточни только даты; не объединяй два вопроса в один.',
      'Не запрашивай телефон у пользователя. Контакт бери из канала связи, а данные вошедшего пользователя — из авторизованного контекста системы. Не проси повторить уже известные имя, контакты или объект. Если контекст недоступен, не выдумывай его и не запрашивай телефон вместо восстановления подключения.',
      'Не выдумывай цены, доступность, причины ошибок или выполненные действия. Если проверенных данных нет, кратко скажи об этом и предложи следующий шаг.',
      'Подробности давай по просьбе: тогда объясняй полно, по шагам, без искусственного ограничения длины.',
      'О передаче специалисту или создании заявки говори в прошедшем времени только после подтверждения системой. Иначе предложи передачу.',

      name ? `Тебя зовут ${name}.` : '',
      `Обращайся к гостю ${SELLER_ADDRESS_FORMS[p?.addressForm ?? 'FORMAL']}, отвечай ${SELLER_REPLY_LENGTHS[p?.replyLength ?? 'SHORT']}, эмодзи — ${SELLER_EMOJI[p?.emoji ?? 'NEVER']}.`,
      `Отвечай на языке гостя: ${languages.join(', ')}.`,
      p?.greeting.trim() ? `Первое сообщение: ${p.greeting.trim()}` : '',
    ]),
  );
  if (p?.faq.length)
    parts.push(
      '',
      'Готовые ответы',
      ...p.faq.map((item) => `- ${item.question.trim()} → ${item.answer.trim()}`),
    );
  return parts.join('\n').trim() + '\n';
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
