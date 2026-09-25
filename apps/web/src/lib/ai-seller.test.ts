import { describe, expect, it } from 'vitest';
import {
  SELLER_FAQ_SUGGESTIONS,
  SELLER_SETUP_STEPS,
  SELLER_TABS,
  categoryPriceLine,
  conversationChannelLabel,
  conversationModeLabel,
  conversationStageLabel,
  defaultSellerStep,
  knowledgeSourceLabel,
  leadFacts,
  sellerBanner,
  sellerBriefing,
  sellerSetupProgress,
  sellerStepFromForm,
  sellerStepNumber,
  userDocuments,
  sellerStoryFieldWords,
} from './ai-seller';
import type { SellerCategoryPrice, SellerProfileBody, SellerStatus } from './api';

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
    expect(b.text).toContain('нажмите «Применить» на шаге «Запуск»');
  });

  it('профиль не сохранён — ведём по шагам настройки к «Применить» на «Запуске»', () => {
    const b = sellerBanner(status({ profile: { saved: false, updatedAt: null, applied: false } }));
    expect(b).toMatchObject({ tone: 'warn', title: 'Продавец ещё не настроен' });
    expect(b.text).toBe('Пройдите шаги во вкладке «Настройки» и нажмите «Применить» на последнем — «Запуск».');
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

const EMPTY: SellerProfileBody = {
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

const FILLED: SellerProfileBody = {
  ...EMPTY,
  botName: 'Айгерим',
  addressForm: 'INFORMAL',
  emoji: 'GREETING_ONLY',
  replyLength: 'DETAILED',
  languages: ['ru', 'kk'],
  greeting: 'Привет! Я Айгерим из хостела.',
  includedInPrice: 'Бельё и полотенца',
  extraCharges: 'Трансфер из аэропорта',
  houseRules: 'Тишина с 23:00',
  prohibitions: ['Не курить в номерах'],
  callHumanWhen: ['Группа от 6 человек'],
  faq: [{ question: 'Есть парковка?', answer: 'Нет, рядом городская.' }],
};

describe('шаги настройки продавца (поручение владельца 25.09.2026)', () => {
  it('семь шагов по порядку: от знакомства до запуска', () => {
    expect(SELLER_SETUP_STEPS.map((s) => `${s.step} ${s.title}`)).toEqual([
      '1 Знакомство',
      '2 Манера',
      '3 Цены',
      '4 Правила',
      '5 Частые вопросы',
      '6 Документы',
      '7 Запуск',
    ]);
  });

  it('новый продавец: всё не заполнено, документы — после подключения, открывается первый шаг', () => {
    const progress = sellerSetupProgress({ saved: false, profile: EMPTY, documents: null, applied: false });
    expect(progress.map((p) => `${p.key}:${p.word}`)).toEqual([
      'intro:не заполнено',
      'manner:не заполнено',
      'prices:не заполнено',
      'rules:не заполнено',
      'faq:не заполнено',
      'docs:после подключения',
      'launch:не отправлено',
    ]);
    expect(defaultSellerStep(progress)).toBe(1);
  });

  it('сохранили только знакомство: манера — с умолчаниями, дальше открывается «Цены»', () => {
    const progress = sellerSetupProgress({
      saved: true,
      profile: { ...EMPTY, greeting: 'Здравствуйте!' },
      documents: 0,
      applied: false,
    });
    expect(progress.map((p) => p.state)).toEqual(['done', 'done', 'todo', 'todo', 'todo', 'optional', 'todo']);
    expect(progress[5]!.word).toBe('по желанию');
    expect(defaultSellerStep(progress)).toBe(3);
  });

  it('всё заполнено и продавец принял — все шаги готовы, открывается «Запуск»', () => {
    const progress = sellerSetupProgress({ saved: true, profile: FILLED, documents: 2, applied: true });
    expect(progress.map((p) => p.word)).toEqual([
      'готово',
      'готово',
      'готово',
      'готово',
      'готово',
      'готово',
      'отправлено',
    ]);
    expect(defaultSellerStep(progress)).toBe(7);
  });

  it('документы и отправка на шаг по умолчанию не влияют: без них — тоже «Запуск»', () => {
    const progress = sellerSetupProgress({ saved: true, profile: FILLED, documents: null, applied: false });
    expect(defaultSellerStep(progress)).toBe(7);
  });

  it('правила готовы и по одному запрету, и цены — по одной доплате', () => {
    const progress = sellerSetupProgress({
      saved: true,
      profile: { ...EMPTY, greeting: 'Здравствуйте!', extraCharges: 'Завтрак', prohibitions: ['Без животных'] },
      documents: 0,
      applied: false,
    });
    expect(progress[2]!.state).toBe('done');
    expect(progress[3]!.state).toBe('done');
  });

  it('номер шага из адреса: 1…7, остальное — не шаг', () => {
    expect(sellerStepNumber('3')).toBe(3);
    expect(sellerStepNumber('7')).toBe(7);
    for (const raw of ['', '0', '8', '2.5', 'три', '1e0', ' 3']) expect(sellerStepNumber(raw)).toBeNull();
  });

  it('документы людей считаются без фактов платформы', () => {
    expect(
      userDocuments([{ source: 'platform:facts.md' }, { source: 'правила.md' }, { source: 'прайс.pdf' }]),
    ).toBe(2);
    expect(userDocuments([{ source: 'platform:facts.md' }])).toBe(0);
  });
});

describe('sellerStepFromForm — шаг меняет только свои поля, остальное берёт из сохранённого', () => {
  const form = (fields: Array<[string, string]>) => {
    const f = new FormData();
    for (const [k, v] of fields) f.append(k, v);
    return f;
  };

  it('знакомство: имя, приветствие, языки по порядку', () => {
    const next = sellerStepFromForm(
      'intro',
      form([
        ['botName', ' Айгерим '],
        ['greeting', 'Привет!'],
        ['languages', 'kk'],
        ['languages', 'ru'],
        ['houseRules', 'подделка чужого шага'],
      ]),
      FILLED,
    );
    expect(next).toEqual({ ...FILLED, botName: ' Айгерим ', greeting: 'Привет!', languages: ['kk', 'ru'] });
  });

  it('знакомство без языков — пустой список: отказ назовёт домен', () => {
    expect(sellerStepFromForm('intro', form([['greeting', 'Привет!']]), FILLED).languages).toEqual([]);
  });

  it('манера: обращение, эмодзи, длина', () => {
    const next = sellerStepFromForm(
      'manner',
      form([
        ['addressForm', 'FORMAL'],
        ['emoji', 'NEVER'],
        ['replyLength', 'SHORT'],
      ]),
      FILLED,
    );
    expect(next).toEqual({ ...FILLED, addressForm: 'FORMAL', emoji: 'NEVER', replyLength: 'SHORT' });
  });

  it('цены: что входит и что за доплату', () => {
    const next = sellerStepFromForm(
      'prices',
      form([
        ['includedInPrice', 'Завтрак'],
        ['extraCharges', ''],
      ]),
      FILLED,
    );
    expect(next).toEqual({ ...FILLED, includedInPrice: 'Завтрак', extraCharges: '' });
  });

  it('правила: запреты и «когда звать человека» — по одному в строке, пустые строки не правила', () => {
    const next = sellerStepFromForm(
      'rules',
      form([
        ['houseRules', 'Тишина с 22:00'],
        ['prohibitions', 'Не курить в номерах\r\n\n  Без животных  \n'],
        ['callHumanWhen', ''],
      ]),
      FILLED,
    );
    expect(next).toEqual({
      ...FILLED,
      houseRules: 'Тишина с 22:00',
      prohibitions: ['Не курить в номерах', 'Без животных'],
      callHumanWhen: [],
    });
  });

  it('частые вопросы: строки по счётчику, не больше 50 даже при подделке', () => {
    const next = sellerStepFromForm(
      'faq',
      form([
        ['faqCount', '2'],
        ['faq-question-0', 'Есть завтрак?'],
        ['faq-answer-0', 'Нет'],
        ['faq-question-1', ''],
        ['faq-answer-1', ''],
      ]),
      FILLED,
    );
    expect(next).toEqual({
      ...FILLED,
      faq: [
        { question: 'Есть завтрак?', answer: 'Нет' },
        { question: '', answer: '' },
      ],
    });
    expect(sellerStepFromForm('faq', form([['faqCount', '1000']]), FILLED).faq).toHaveLength(50);
  });

  it('подсказки частых вопросов — живые вопросы гостей, без повторов', () => {
    expect(SELLER_FAQ_SUGGESTIONS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(SELLER_FAQ_SUGGESTIONS).size).toBe(SELLER_FAQ_SUGGESTIONS.length);
    for (const q of SELLER_FAQ_SUGGESTIONS) expect(q.endsWith('?')).toBe(true);
  });
});

describe('sellerBriefing — что получит продавец, словами', () => {
  it('заполненный профиль: имя, манера, языки, цены, правила, вопросы', () => {
    expect(sellerBriefing(FILLED)).toEqual([
      { label: 'Представляется', value: '«Айгерим»' },
      { label: 'Обращается к гостю', value: 'на «ты»' },
      { label: 'Эмодзи', value: 'только в приветствии' },
      { label: 'Ответы', value: 'развёрнуто' },
      { label: 'Языки', value: 'Русский (основной), Казахский' },
      { label: 'Приветствие', value: 'Привет! Я Айгерим из хостела.' },
      { label: 'Что входит в цену', value: 'Бельё и полотенца' },
      { label: 'За доплату', value: 'Трансфер из аэропорта' },
      { label: 'Правила проживания', value: 'Тишина с 23:00' },
      { label: 'Запреты', value: 'Не курить в номерах' },
      {
        label: 'Зовёт человека',
        value: 'Группа от 6 человек; всегда — жалоба, возврат денег, изменение или отмена брони',
      },
      { label: 'Частые вопросы', value: '1 готовый ответ' },
    ]);
  });

  it('пустой профиль: без имени, прочерки, человека зовёт в обязательных случаях', () => {
    const lines = Object.fromEntries(sellerBriefing(EMPTY).map((l) => [l.label, l.value]));
    expect(lines['Представляется']).toBe('без имени — от лица гостиницы');
    expect(lines['Языки']).toBe('Русский (основной)');
    expect(lines['Приветствие']).toBe('—');
    expect(lines['Запреты']).toBe('—');
    expect(lines['Зовёт человека']).toBe('всегда — жалоба, возврат денег, изменение или отмена брони');
    expect(lines['Частые вопросы']).toBe('—');
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

describe('итог рассказа: имена полей словами мастера (С1)', () => {
  it('известные поля — подписями шагов, незнакомое — как пришло', () => {
    expect(sellerStoryFieldWords(['botName', 'includedInPrice', 'faq'])).toBe(
      'Имя бота, Что входит в цену, Частые вопросы',
    );
    expect(sellerStoryFieldWords(['objectName'])).toBe('Название объекта');
    expect(sellerStoryFieldWords(['neizvestnoe'])).toBe('neizvestnoe');
    expect(sellerStoryFieldWords([])).toBe('');
  });
});
