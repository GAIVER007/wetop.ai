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
import { countLabel, msg, translator, type DeskLocale, type Translate } from '../i18n';
import type { WebVertical } from './vertical-landing';

/**
 * Раздел «ИИ-продавец» стойки (ТЗ ред. 1 П6, ADR-079): то, что экраны считают сами. Без зависимостей от сервера —
 * этим файлом пользуются и серверная страница, и серверные действия.
 */

/** Вкладки раздела — четыре экрана по макету владельца 26.09.2026 (план `plans/seller-prompt-window-2026-09-26.md`) */
export const SELLER_TABS = [
  { view: 'overview', href: '/ai-seller/overview', label: msg('Обзор') },
  { view: '', href: '/ai-seller', label: msg('Настройка') },
  { view: 'dialogs', href: '/ai-seller/dialogs', label: msg('Диалоги') },
  { view: 'knowledge', href: '/ai-seller/knowledge', label: msg('Знания') },
  { view: 'connections', href: '/ai-seller/connections', label: msg('Подключения') },
  { view: 'scenarios', href: '/ai-seller/scenarios', label: msg('Сценарии') },
  { view: 'analytics', href: '/ai-seller/analytics', label: msg('Аналитика') },
] as const;

/** Тексты экранов продавца, которые зависят от выбранного направления бизнеса. */
export function sellerVerticalUiCopy(vertical: WebVertical) {
  if (vertical === 'BEAUTY') {
    return {
      setupData:
        msg('Услуги, мастера и часы работы продавец берёт из WETOP сам, их писать не нужно.'),
      scenarioSales:
        msg('Отвечает клиентам на сайте и в мессенджерах, подбирает услугу и мастера по данным WETOP, собирает контакт и передаёт запрос администратору.'),
      scenarioSupport: msg('Отвечает на вопросы об услугах и правилах без продажи.'),
      embedIdentity:
        msg('Клиент пишет анонимно. В коде находится публичный ключ вашего салона: по нему продавец узнаёт салон и отвечает только с доменов его сайта.'),
      embedNoSite:
        msg('У салона нет сайта в «Настройках сайта». Заведите сайт с доменом, и продавец начнёт пускать с него.'),
      extensionOff:
        msg('Продавец отвечает клиентам в чате на сайте салона: рассказывает об услугах и правилах, помогает выбрать услугу и мастера, берёт контакт и зовёт администратора, когда нужно.'),
      agentCard: msg('Автоматизируйте ответы клиентам, подбор услуг и передачу заявок администратору.'),
    };
  }
  if (vertical === 'FOOD_SERVICE') {
    return {
      setupData: msg('Меню, залы и часы работы продавец берёт из WETOP сам, их писать не нужно.'),
      scenarioSales:
        msg('Отвечает гостям ресторана на сайте и в мессенджерах, рассказывает о меню и залах, помогает выбрать время, собирает контакт и передаёт бронь стола администратору.'),
      scenarioSupport: msg('Отвечает на вопросы о меню, залах и правилах без продажи.'),
      embedIdentity:
        msg('Гость пишет анонимно. В коде находится публичный ключ вашего ресторана: по нему продавец узнаёт ресторан и отвечает только с доменов его сайта.'),
      embedNoSite:
        msg('У ресторана нет сайта в «Настройках сайта». Заведите сайт с доменом, и продавец начнёт пускать с него.'),
      extensionOff:
        msg('Продавец отвечает гостям в чате на сайте ресторана: рассказывает о меню, залах и правилах, помогает выбрать время, берёт контакт и зовёт администратора, когда нужно.'),
      agentCard: msg('Автоматизируйте ответы гостям, брони столов и передачу заявок администратору.'),
    };
  }
  return {
    setupData: msg('Цены, номера, заезд и выезд продавец берёт из WETOP сам, их писать не нужно.'),
    scenarioSales:
      msg('Отвечает гостям на сайте и в мессенджерах, подбирает номер на даты, называет цену из WETOP, собирает контакт и после явного согласия гостя создаёт бронь.'),
    scenarioSupport: msg('Отвечает на вопросы о проживании и правилах без продажи.'),
    embedIdentity:
      msg('Гость пишет анонимно. В коде находится публичный ключ вашей гостиницы: по нему продавец узнаёт её и отвечает только с доменов её сайта.'),
    embedNoSite:
      msg('У гостиницы нет сайта в «Настройках сайта». Заведите сайт с доменом, и продавец начнёт пускать с него.'),
    extensionOff:
      msg('Продавец отвечает гостям в чате на сайте объекта: называет цены по тарифу сайта, рассказывает о правилах, берёт контакт и зовёт человека, когда нужно.'),
    agentCard: msg('Автоматизируйте ответы гостям, подбор размещения и продажи.'),
  };
}

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
    return msg('Срок расширения вышел: настройки только для просмотра. Продлевает администратор WETOP.');
  // старый API ролей не знает — тогда настраивать может каждый, как было до ADR-083
  if (status.canConfigure === false) return msg('Настройки продавца меняют владелец и управляющий.');
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
  t: Translate = translator('ru'),
  locale: DeskLocale = 'ru',
): string | null {
  if (!extension || extension.access !== 'active' || !extension.activeUntil) return null;
  const days = extension.daysLeft;
  if (days === null || days > 7) return null;
  const day = displayDay(extensionLastDay(extension.activeUntil));
  const what =
    extension.status === 'TRIAL' ? t('Пробный доступ к ИИ-продавцу') : t('Расширение «ИИ-продавец»');
  const left =
    days <= 1
      ? t('действует последний день — по {day}', { day })
      : t('действует ещё {days} — по {day}', {
          days: countLabel(locale, t, days, [msg('день'), 'дня', msg('дней')]), // kk-allow: форма склонения
          day,
        });
  return t('{what} {left}. Потом раздел останется только для чтения. Продлевает администратор WETOP после оплаты.', {
    what,
    left,
  });
}

/** Полоса состояния над экранами раздела: подключён ли продавец и дошли ли до него правки */
export function sellerBanner(status: SellerStatus, t: Translate = translator('ru')): SellerBanner {
  if (status.state === 'extension-off')
    return {
      tone: 'warn',
      value: t('не подключён'),
      title: t('Расширение «ИИ-продавец» не подключено'),
      text: t('Раздел открывается организациям с подключённым расширением. Подключает администратор WETOP после оплаты по счёту.'),
    };
  if (status.state === 'extension-expired')
    return {
      tone: 'alarm',
      value: t('срок вышел'),
      title: t('Срок расширения «ИИ-продавец» вышел'),
      text: t('Раздел только для чтения: настройки, знания и диалоги видны, но отвечать гостям и менять настройки нельзя. Ничего не удалено. Продлевает администратор WETOP.'),
    };
  if (status.state === 'not-configured')
    return {
      tone: 'warn',
      value: t('не подключён'),
      title: t('ИИ-продавец не подключён'),
      text: t('Настройки можно сохранить заранее: продавец получит их, как только его подключат. Адрес и ключ продавца задаёт владелец в настройках сервера.'),
    };
  if (status.lastError && status.retrying)
    return {
      tone: 'alarm',
      value: t('не принял правки'),
      title: t('Продавец не принял правки'),
      text: t('{error}. Повторяем отправку автоматически раз в минуту.', { error: status.lastError }),
    };
  // отказ по содержанию: та же версия будет отклонена снова, и сверка её сама не шлёт (ADR-079)
  if (status.lastError)
    return {
      tone: 'alarm',
      value: t('отклонил правки'),
      title: t('Продавец отклонил правки'),
      text: t(
        '{error}. Сами не повторяем: исправьте, что назвал продавец, и нажмите «Сохранить и применить» во вкладке «Настройка».',
        { error: status.lastError },
      ),
    };
  if (!status.profile.saved)
    return {
      tone: 'warn',
      value: t('не настроен'),
      title: t('Продавец ещё не настроен'),
      text: t('Опишите продавца своими словами во вкладке «Настройка» и нажмите «Сохранить и применить».'),
    };
  if (status.profile.applied && status.facts.applied)
    return {
      tone: 'calm',
      value: t('настройки применены'),
      title: t('Инструкция и данные переданы продавцу'),
      text: t('Правки настроек, карточки объекта и цен уходят продавцу сами.'),
    };
  return {
    tone: 'warn',
    value: t('правки в пути'),
    title: t('Правки ещё в пути'),
    text: t('Настройки или данные объекта изменились — отправим продавцу в течение минуты.'),
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
      title: msg('Подключить продавца'),
      hint: msg('Адрес и ключ продавца задаются на сервере — это делает администратор WETOP.'),
      done: false,
    });
  items.push({
    key: 'model',
    title: msg('Проверить модель'),
    hint: keySet
      ? msg('Ключ модели сохранён.')
      : msg('Личный ключ не задан. Если модель подключена платформой, проверьте ответ в «Проверке». Свой ключ можно добавить в подключениях.'),
    done: keySet === true,
    href: '/ai-seller/connections',
  });
  items.push({
    key: 'prompt',
    title: msg('Написать инструкцию'),
    hint: prompt?.applied
      ? msg('Сохранена и отправлена продавцу.')
      : prompt?.saved
        ? msg('Сохранена, но ещё не у продавца: нажмите «Сохранить и применить».')
        : msg('Опишите продавца своими словами ниже.'),
    done: prompt?.applied === true,
  });
  if (items.every((item) => item.done)) return null;
  items.push({
    key: 'check',
    title: msg('Проверить ответ'),
    hint: msg('Напишите продавцу в «Проверке» так, как написал бы гость.'),
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
export function sellerPromptDraft(
  profile: SellerProfileBody | null,
  vertical: WebVertical = 'HOSPITALITY',
): string {
  const p = profile;
  const name = p?.botName?.trim();
  const languages = (p?.languages.length ? p.languages : ['ru']).map((code) =>
    (SELLER_LANGUAGES[code] ?? code).toLowerCase(),
  );
  const conversation = vertical === 'BEAUTY'
    ? [
        'При подборе услуги уточняй только недостающие услугу, мастера и желаемое время. Для справочного вопроса подбор не начинай.', // kk-allow: инструкция боту, сохраняется в базу
        'Подбери подходящую услугу и мастера по данным WETOP.', // kk-allow: инструкция боту, сохраняется в базу
        'Если клиент хочет записаться, собери недостающие данные и передай запрос администратору. Не обещай созданную запись без подтверждения системы.', // kk-allow: инструкция боту, сохраняется в базу
      ]
    : [
        'При подборе размещения уточняй только недостающие даты, количество гостей и тип размещения. Для справочного вопроса подбор не начинай.', // kk-allow: инструкция боту, сохраняется в базу
        'Подбери подходящий вариант и расскажи о нём.', // kk-allow: инструкция боту, сохраняется в базу
        'При желании оформить бронь используй контакт канала и только проверенные действия платформы.', // kk-allow: инструкция боту, сохраняется в базу
      ];
  const clarificationExample = vertical === 'BEAUTY'
    ? 'Если нужны услуга и мастер, сначала уточни только услугу; не объединяй два вопроса в один.' // kk-allow: инструкция боту, сохраняется в базу
    : 'Если нужны даты и тип номера, сначала уточни только даты; не объединяй два вопроса в один.'; // kk-allow: инструкция боту, сохраняется в базу
  const parts = [
    'Разговор по шагам', // kk-allow: инструкция боту, сохраняется в базу
    ...lines(conversation),
  ];
  const rules = lines([
    p?.includedInPrice.trim() ? `Входит в цену: ${p.includedInPrice.trim()}` : '', // kk-allow: инструкция боту, сохраняется в базу
    p?.extraCharges.trim() ? `За доплату: ${p.extraCharges.trim()}` : '', // kk-allow: инструкция боту, сохраняется в базу
    ...(p?.houseRules.split('\n') ?? []),
  ]);
  if (rules.length) parts.push('', 'Правила объекта', ...rules); // kk-allow: инструкция боту, сохраняется в базу
  if (p?.prohibitions.length) parts.push('', 'Чего не делать', ...lines(p.prohibitions)); // kk-allow: инструкция боту, сохраняется в базу
  if (p?.callHumanWhen.length)
    parts.push('', 'Когда ещё звать человека', ...lines(p.callHumanWhen)); // kk-allow: инструкция боту, сохраняется в базу
  parts.push(
    '',
    'Стиль', // kk-allow: инструкция боту, сохраняется в базу
    ...lines([
      'Сначала ответь прямо на вопрос: обычно достаточно 1–3 коротких предложений.', // kk-allow: инструкция боту, сохраняется в базу
      'Не повторяй уже известные сведения, приветствия и рекламные предложения. Не добавляй список своих возможностей к каждому ответу.', // kk-allow: инструкция боту, сохраняется в базу
      `Задавай не больше одного необходимого уточняющего вопроса за сообщение, только если без него нельзя помочь. Не спрашивай повторно то, что уже известно из диалога. ${clarificationExample}`, // kk-allow: инструкция боту, сохраняется в базу
      'Не запрашивай телефон у пользователя. Контакт бери из канала связи, а данные вошедшего пользователя — из авторизованного контекста системы. Не проси повторить уже известные имя, контакты или объект. Если контекст недоступен, не выдумывай его и не запрашивай телефон вместо восстановления подключения.', // kk-allow: инструкция боту, сохраняется в базу
      'Не выдумывай цены, доступность, причины ошибок или выполненные действия. Если проверенных данных нет, кратко скажи об этом и предложи следующий шаг.', // kk-allow: инструкция боту, сохраняется в базу
      'Подробности давай по просьбе: тогда объясняй полно, по шагам, без искусственного ограничения длины.', // kk-allow: инструкция боту, сохраняется в базу
      'О передаче специалисту или создании заявки говори в прошедшем времени только после подтверждения системой. Иначе предложи передачу.', // kk-allow: инструкция боту, сохраняется в базу

      name ? `Тебя зовут ${name}.` : '', // kk-allow: инструкция боту, сохраняется в базу
      `Обращайся к гостю ${SELLER_ADDRESS_FORMS[p?.addressForm ?? 'FORMAL']}, отвечай ${SELLER_REPLY_LENGTHS[p?.replyLength ?? 'SHORT']}, эмодзи — ${SELLER_EMOJI[p?.emoji ?? 'NEVER']}.`, // kk-allow: инструкция боту, сохраняется в базу
      `Отвечай на языке гостя: ${languages.join(', ')}.`, // kk-allow: инструкция боту, сохраняется в базу
      p?.greeting.trim() ? `Первое сообщение: ${p.greeting.trim()}` : '', // kk-allow: инструкция боту, сохраняется в базу
    ]),
  );
  if (p?.faq.length)
    parts.push(
      '',
      'Готовые ответы', // kk-allow: инструкция боту, сохраняется в базу
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
  t: Translate = translator('ru'),
): { value: string; note: string | null; known: boolean } {
  if (price.reason === 'same' && price.priceMinor !== null) {
    const sum = formatMoney(price.priceMinor, currency);
    return {
      value:
        price.occupancy && price.occupancy > 1
          ? t('{sum} за ночь за {n} гостей', { sum, n: price.occupancy })
          : t('{sum} за ночь', { sum }),
      note: null,
      known: true,
    };
  }
  if (price.reason === 'varies' && price.min !== null && price.max !== null)
    return {
      value: t('уточнит администратор'),
      note: t('цена меняется по датам: от {min} до {max}', {
        min: formatMoney(price.min, currency),
        max: formatMoney(price.max, currency),
      }),
      known: false,
    };
  return { value: t('уточнит администратор'), note: t('в тарифе сайта цены нет'), known: false };
}

/** Документ фактов, который бот собирает из «Данных объекта» (`platform:facts.md`), — словами, а не именем файла */
export function knowledgeSourceLabel(source: string): string {
  return source === 'platform:facts.md' ? msg('Данные объекта (от платформы)') : source;
}

/** Режим диалога словами стойки; «нужен человек» — пометка, которую ищут глазами (ТЗ §4.1) */
export function conversationModeLabel(mode: string): { label: string; tone: BadgeTone } {
  if (mode === 'needs_human') return { label: msg('нужен человек'), tone: 'warn' };
  if (mode === 'owner_takeover') return { label: msg('ведёт человек'), tone: 'info' };
  if (mode === 'bot_active') return { label: msg('ведёт бот'), tone: 'neutral' };
  return { label: mode, tone: 'neutral' };
}

/**
 * Что продавец узнал о госте: поля ядра бота (`LeadFields`) и ключи свободной сумки `extra`, которые бот отдаёт в бронь
 * (`create_lead`, `src/integrations/wetop.py`), — словами стойки; остальные ключи `extra` задаёт промпт — как есть
 */
const LEAD_LABELS: Readonly<Record<string, string>> = {
  interest: msg('Что ищет'),
  budget: msg('Бюджет'),
  timeframe: msg('Когда'),
  notes: msg('Заметки'),
  arrival: msg('Заезд'),
  departure: msg('Выезд'),
  category: msg('Категория'),
  guests: msg('Гостей'),
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
  new: msg('новый'),
  qualifying: msg('уточняет'),
  presenting: msg('выбирает'),
  objection: msg('сомневается'),
  closing: msg('готов бронировать'),
  won: msg('договорились'),
  lost: msg('ушёл'),
};

export function conversationStageLabel(stage: string): string {
  if (!stage) return '—';
  return STAGES[stage] ?? stage;
}

/** Канал диалога словами стойки */
export function conversationChannelLabel(channel: string | null): string {
  if (!channel) return '—';
  if (channel === 'widget') return msg('чат на сайте');
  if (channel === 'sandbox') return msg('проверка');
  return channel;
}

/** Время первого ответа словами: 20 → «20 с», 65 → «1 мин 5 с», 3720 → «1 ч 2 мин»; нет данных → null */
export function replyTimeText(seconds: number | null, t: Translate = translator('ru')): string | null {
  if (seconds === null) return null;
  const sec = (n: number) => t('{n} с', { n });
  const min = (n: number) => t('{n} мин', { n });
  if (seconds < 60) return sec(seconds);
  if (seconds < 3600) {
    const s = seconds % 60;
    return `${min(Math.floor(seconds / 60))}${s ? ` ${sec(s)}` : ''}`;
  }
  const m = Math.floor((seconds % 3600) / 60);
  return `${t('{n} ч', { n: Math.floor(seconds / 3600) })}${m ? ` ${min(m)}` : ''}`;
}

/**
 * Где правят данные, которые продавец говорит гостю, по направлению филиала (аудит платформы 17.10.2026, Д11):
 * раньше «Знания» салона и ресторана вели в гостиничные «Объект», «Категории номеров» и «Тариф сайта».
 */
export function sellerDataLinks(vertical: WebVertical): Array<{ href: string; label: string }> {
  if (vertical === 'BEAUTY')
    return [
      { href: '/services', label: msg('Изменить услуги и цены') },
      { href: '/employees', label: msg('Мастера филиала') },
      { href: '/branches', label: msg('Карточка филиала') },
    ];
  if (vertical === 'FOOD_SERVICE')
    return [
      { href: '/menu', label: msg('Изменить меню и цены') },
      { href: '/restaurant-settings', label: msg('Часы работы и брони') },
      { href: '/branches', label: msg('Карточка филиала') },
    ];
  return [
    { href: '/hotel-settings', label: msg('Изменить карточку объекта') },
    { href: '/rooms/categories', label: msg('Изменить цены в «Категориях номеров»') },
    { href: '/website/booking', label: msg('Тариф сайта') },
  ];
}
