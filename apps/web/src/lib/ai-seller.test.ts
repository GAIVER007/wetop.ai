import { describe, expect, it } from 'vitest';
import {
  SELLER_TABS,
  categoryPriceLine,
  conversationChannelLabel,
  conversationModeLabel,
  conversationStageLabel,
  knowledgeSourceLabel,
  leadFacts,
  sellerBanner,
  sellerProfileFromForm,
} from './ai-seller';
import type { SellerCategoryPrice, SellerStatus } from './api';

/** Раздел «ИИ-продавец» стойки (ТЗ ред. 1 П6): то, что экраны считают сами, без API */

const status = (over: Partial<SellerStatus> = {}): SellerStatus => ({
  state: 'ready',
  profile: { saved: true, updatedAt: '2026-09-24T09:00:00.000Z', applied: true },
  facts: { applied: true, appliedAt: '2026-09-24T09:00:05.000Z' },
  lastError: null,
  lastErrorAt: null,
  retrying: false,
  embedAvailable: true,
  ...over,
});

describe('вкладки раздела (ТЗ §4.1)', () => {
  it('шесть экранов в порядке ТЗ', () => {
    expect(SELLER_TABS.map((t) => t.label)).toEqual([
      'Настройки',
      'Данные объекта',
      'Знания',
      'Диалоги',
      'Код для сайта',
      'Проверка',
    ]);
    expect(SELLER_TABS.map((t) => t.href)).toEqual([
      '/ai-seller',
      '/ai-seller/data',
      '/ai-seller/knowledge',
      '/ai-seller/dialogs',
      '/ai-seller/embed',
      '/ai-seller/check',
    ]);
  });
});

describe('sellerBanner — полоса состояния над экранами', () => {
  it('не подключён — предупреждение, настройки можно сохранить заранее', () => {
    const b = sellerBanner(status({ state: 'not-configured' }));
    expect(b).toMatchObject({ tone: 'warn', title: 'ИИ-продавец не подключён' });
    expect(b.text).toMatch(/заранее/);
  });

  it('другая организация — не её копия продавца', () => {
    expect(sellerBanner(status({ state: 'other-organization' }))).toMatchObject({
      tone: 'warn',
      title: 'ИИ-продавец для вашей организации не подключён',
    });
  });

  it('продавец недоступен — тревога с его словами и обещанием повтора', () => {
    const b = sellerBanner(
      status({ lastError: 'ИИ-продавец недоступен (HTTP 502)', retrying: true }),
    );
    expect(b.tone).toBe('alarm');
    expect(b.text).toContain('ИИ-продавец недоступен (HTTP 502)');
    expect(b.text).toMatch(/повтор/i);
  });

  it('продавец отклонил по содержанию — сами не повторяем, просим поправить и нажать «Применить»', () => {
    const b = sellerBanner(
      status({ lastError: 'ИИ-продавец отклонил: в поле найдены инструкции для модели', retrying: false }),
    );
    expect(b).toMatchObject({ tone: 'alarm', value: 'отклонил правки', title: 'Продавец отклонил правки' });
    expect(b.text).toContain('в поле найдены инструкции для модели');
    expect(b.text).toContain('«Применить»');
    // обещания повтора нет: «Повторяем отправку…» — слова временного отказа
    expect(b.text).not.toContain('Повторяем отправку');
    expect(b.text).toContain('Сами не повторяем');
  });

  it('профиль не сохранён — просим заполнить и применить', () => {
    expect(
      sellerBanner(status({ profile: { saved: false, updatedAt: null, applied: false } })),
    ).toMatchObject({ tone: 'warn', title: 'Продавец ещё не настроен' });
  });

  it('всё доставлено — спокойно', () => {
    expect(sellerBanner(status()).tone).toBe('calm');
  });

  it('правки ещё в пути — «отправим в течение минуты»', () => {
    const b = sellerBanner(status({ facts: { applied: false, appliedAt: null } }));
    expect(b.tone).toBe('warn');
    expect(b.text).toMatch(/минут/);
  });
});

describe('sellerProfileFromForm — поля формы «Настройки» в тело PUT /ai-seller/profile', () => {
  it('выпадающие списки, языки по порядку, запреты и «когда звать человека» — по одному в строке', () => {
    const form = new FormData();
    form.set('botName', ' Айгерим ');
    form.set('addressForm', 'INFORMAL');
    form.set('emoji', 'GREETING_ONLY');
    form.set('replyLength', 'DETAILED');
    form.append('languages', 'ru');
    form.append('languages', 'en');
    form.set('greeting', 'Привет!');
    form.set('includedInPrice', 'Бельё');
    form.set('extraCharges', 'Трансфер');
    form.set('houseRules', 'Тишина с 23:00');
    form.set('prohibitions', 'Не курить в номерах\r\n\n  Без животных  \n');
    form.set('callHumanWhen', '');
    form.set('faqCount', '2');
    form.set('faq-question-0', 'Парковка?');
    form.set('faq-answer-0', 'Нет');
    form.set('faq-question-1', '');
    form.set('faq-answer-1', '');
    expect(sellerProfileFromForm(form)).toEqual({
      botName: ' Айгерим ',
      addressForm: 'INFORMAL',
      emoji: 'GREETING_ONLY',
      replyLength: 'DETAILED',
      languages: ['ru', 'en'],
      greeting: 'Привет!',
      includedInPrice: 'Бельё',
      extraCharges: 'Трансфер',
      houseRules: 'Тишина с 23:00',
      prohibitions: ['Не курить в номерах', 'Без животных'],
      callHumanWhen: [],
      faq: [
        { question: 'Парковка?', answer: 'Нет' },
        { question: '', answer: '' },
      ],
    });
  });

  it('число строк вопросов не больше 50 даже при подделке', () => {
    const form = new FormData();
    form.set('faqCount', '1000');
    expect(sellerProfileFromForm(form).faq).toHaveLength(50);
  });
});

describe('categoryPriceLine — цена категории в «Данных объекта»: что знает продавец и почему', () => {
  const price = (over: Partial<SellerCategoryPrice>): SellerCategoryPrice => ({
    code: 'DBL',
    name: 'Двухместная',
    kind: 'PRIVATE_ROOM',
    capacity: 2,
    units: 4,
    occupancy: 2,
    priceMinor: '1500000',
    reason: 'same',
    min: '1500000',
    max: '1500000',
    days: 60,
    ...over,
  });

  it('одна цена весь срок — её продавец и называет; для нескольких гостей — за скольких', () => {
    expect(categoryPriceLine(price({}), 'KZT')).toEqual({
      value: '15 000 ₸ за ночь за 2 гостей',
      note: null,
      known: true,
    });
    expect(categoryPriceLine(price({ occupancy: 1 }), 'KZT').value).toBe('15 000 ₸ за ночь');
  });

  it('цена меняется — продавец скажет «уточнит администратор», стойка показывает разброс', () => {
    expect(
      categoryPriceLine(price({ reason: 'varies', priceMinor: null, min: '450000', max: '520000' }), 'KZT'),
    ).toEqual({
      value: 'уточнит администратор',
      note: 'цена меняется по датам: от 4 500 ₸ до 5 200 ₸',
      known: false,
    });
  });

  it('цены нет — тоже «уточнит администратор»', () => {
    expect(
      categoryPriceLine(
        price({ reason: 'none', priceMinor: null, min: null, max: null, occupancy: null, days: 0 }),
        'KZT',
      ),
    ).toEqual({ value: 'уточнит администратор', note: 'в тарифе сайта цены нет', known: false });
  });
});

describe('knowledgeSourceLabel — документы в «Знаниях»', () => {
  it('документ фактов бота — словами, а не именем файла; остальные — как загружены', () => {
    expect(knowledgeSourceLabel('platform:facts.md')).toBe('Данные объекта (от платформы)');
    expect(knowledgeSourceLabel('прайс.md')).toBe('прайс.md');
  });
});

describe('conversationModeLabel — режим диалога словами стойки', () => {
  it('«нужен человек» — предупреждением, остальные — спокойно', () => {
    expect(conversationModeLabel('needs_human')).toEqual({ label: 'нужен человек', tone: 'warn' });
    expect(conversationModeLabel('bot_active')).toEqual({ label: 'ведёт бот', tone: 'neutral' });
    expect(conversationModeLabel('owner_takeover')).toEqual({ label: 'ведёт человек', tone: 'info' });
    expect(conversationModeLabel('что-то новое')).toEqual({ label: 'что-то новое', tone: 'neutral' });
  });
});

describe('подписи диалога словами стойки, а не кодами бота', () => {
  it('этап воронки', () => {
    expect(conversationStageLabel('new')).toBe('новый');
    expect(conversationStageLabel('qualifying')).toBe('уточняет');
    expect(conversationStageLabel('presenting')).toBe('выбирает');
    expect(conversationStageLabel('objection')).toBe('сомневается');
    expect(conversationStageLabel('closing')).toBe('готов бронировать');
    expect(conversationStageLabel('won')).toBe('договорились');
    expect(conversationStageLabel('lost')).toBe('ушёл');
    expect(conversationStageLabel('')).toBe('—');
    expect(conversationStageLabel('unknown_stage')).toBe('unknown_stage');
  });

  it('канал', () => {
    expect(conversationChannelLabel('widget')).toBe('чат на сайте');
    expect(conversationChannelLabel('sandbox')).toBe('проверка');
    expect(conversationChannelLabel(null)).toBe('—');
    expect(conversationChannelLabel('telegram')).toBe('telegram');
  });
});

describe('короткое значение полосы состояния', () => {
  it('слово, а не фраза: фраза — в пояснении', () => {
    expect(sellerBanner(status()).value).toBe('работает');
    expect(sellerBanner(status({ state: 'not-configured' })).value).toBe('не подключён');
    expect(sellerBanner(status({ state: 'other-organization' })).value).toBe('не подключён');
    expect(sellerBanner(status({ lastError: 'x', retrying: true })).value).toBe('не принял правки');
    expect(sellerBanner(status({ lastError: 'x', retrying: false })).value).toBe('отклонил правки');
    expect(
      sellerBanner(status({ profile: { saved: false, updatedAt: null, applied: false } })).value,
    ).toBe('не настроен');
    expect(sellerBanner(status({ facts: { applied: false, appliedAt: null } })).value).toBe(
      'правки в пути',
    );
  });
});

describe('leadFacts — что продавец узнал о госте, словами стойки', () => {
  it('поля ядра по-русски, контакт не дублируется, пустое пропущено, «extra» развёрнуто', () => {
    expect(
      leadFacts({
        name: 'Алия Тестова',
        phone: '+7 700 000 00 00',
        email: null,
        interest: 'двухместная на выходные',
        budget: 20000,
        timeframe: '',
        notes: null,
        extra: { guests: 2, dates: '27.09–29.09', nested: { a: 1 } },
      }),
    ).toEqual([
      { label: 'Что ищет', value: 'двухместная на выходные' },
      { label: 'Бюджет', value: '20000' },
      { label: 'Гостей', value: '2' },
      { label: 'dates', value: '27.09–29.09' },
      { label: 'nested', value: '{"a":1}' },
    ]);
  });

  it('ключи `extra`, которые бот отдаёт в бронь (`create_lead`), — тоже словами стойки', () => {
    expect(
      leadFacts({ extra: { arrival: '2026-10-01', departure: '2026-10-03', category: 'Двухместная', guests: '2' } }),
    ).toEqual([
      { label: 'Заезд', value: '2026-10-01' },
      { label: 'Выезд', value: '2026-10-03' },
      { label: 'Категория', value: 'Двухместная' },
      { label: 'Гостей', value: '2' },
    ]);
  });

  it('сроки и заметки; незнакомый ключ — как есть; пусто — пусто', () => {
    expect(leadFacts({ timeframe: 'в октябре', notes: 'с собакой', source: 'сайт' })).toEqual([
      { label: 'Когда', value: 'в октябре' },
      { label: 'Заметки', value: 'с собакой' },
      { label: 'source', value: 'сайт' },
    ]);
    expect(leadFacts({})).toEqual([]);
    expect(leadFacts({ extra: 'не объект' })).toEqual([]);
  });
});
