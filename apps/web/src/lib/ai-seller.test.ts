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
  sellerChecklist,
  sellerPromptDraft,
  SELLER_LEGACY_VIEWS,
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

describe('вкладки раздела (макет владельца 26.09.2026)', () => {
  it('четыре экрана: настройка, диалоги, знания, подключения', () => {
    expect(SELLER_TABS.map((t) => t.label)).toEqual(['Настройка', 'Диалоги', 'Знания', 'Подключения']);
    expect(SELLER_TABS.map((t) => t.href)).toEqual([
      '/ai-seller',
      '/ai-seller/dialogs',
      '/ai-seller/knowledge',
      '/ai-seller/connections',
    ]);
  });

  it('прежние адреса ведут в новые экраны: закладки и ссылки не ломаются', () => {
    expect(SELLER_LEGACY_VIEWS).toEqual({
      data: 'knowledge',
      model: 'connections',
      embed: 'connections',
      whatsapp: 'connections',
      check: '',
    });
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

  it('продавец отклонил по содержанию — сами не повторяем, просим поправить и нажать «Сохранить и применить»', () => {
    const b = sellerBanner(
      status({ lastError: 'ИИ-продавец отклонил: в поле найдены инструкции для модели', retrying: false }),
    );
    expect(b).toMatchObject({ tone: 'alarm', value: 'отклонил правки', title: 'Продавец отклонил правки' });
    expect(b.text).toContain('в поле найдены инструкции для модели');
    expect(b.text).toContain('«Сохранить и применить»');
    // обещания повтора нет: «Повторяем отправку…» — слова временного отказа
    expect(b.text).not.toContain('Повторяем отправку');
    expect(b.text).toContain('Сами не повторяем');
    expect(b.text).toContain('нажмите «Сохранить и применить» во вкладке «Настройка»');
  });

  it('инструкция не сохранена — ведём к одному окну на «Настройке»', () => {
    const b = sellerBanner(status({ profile: { saved: false, updatedAt: null, applied: false } }));
    expect(b).toMatchObject({ tone: 'warn', title: 'Продавец ещё не настроен' });
    expect(b.text).toBe(
      'Опишите продавца своими словами во вкладке «Настройка» и нажмите «Сохранить и применить».',
    );
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

describe('чек-лист «Три шага до запуска» (макет владельца 26.09.2026)', () => {
  const prompt = (saved: boolean, applied: boolean) => ({ saved, applied });

  it('новый продавец: модель и инструкция не готовы, проверка — подсказкой', () => {
    const items = sellerChecklist(status(), false, prompt(false, false))!;
    expect(items.map((i) => [i.key, i.done])).toEqual([
      ['model', false],
      ['prompt', false],
      ['check', false],
    ]);
    expect(items[0]).toMatchObject({ title: 'Проверить модель', href: '/ai-seller/connections' });
  });

  it('продавец не подключён к платформе — первым шагом, остальное ждёт', () => {
    const items = sellerChecklist(status({ state: 'not-configured', connection: 'not-configured' }), null, prompt(true, false))!;
    expect(items[0]).toMatchObject({ key: 'connect', done: false });
  });

  it('ключ есть и инструкция у продавца — чек-листа нет', () => {
    expect(sellerChecklist(status(), true, prompt(true, true))).toBeNull();
  });

  it('инструкция сохранена, но не применена — шаг не готов и говорит, что нажать', () => {
    const item = sellerChecklist(status(), true, prompt(true, false))!.find((i) => i.key === 'prompt')!;
    expect(item.done).toBe(false);
    expect(item.hint).toContain('«Сохранить и применить»');
  });
});

describe('sellerPromptDraft — черновик инструкции из того, что уже было', () => {
  it('пустой профиль — общий черновик без выдуманных цен и имён', () => {
    const draft = sellerPromptDraft(null);
    expect(draft).toContain('на «вы»');
    expect(draft).toContain('на языке гостя');
    expect(draft).not.toMatch(/\d+\s*₸/);
  });

  it('заполненные поля переносятся в текст, ничего не теряется', () => {
    const draft = sellerPromptDraft(FILLED);
    for (const piece of [
      'Тебя зовут Айгерим',
      'на «ты»',
      'русский, казахский',
      'Привет! Я Айгерим из хостела.',
      'Бельё и полотенца',
      'Трансфер из аэропорта',
      'Тишина с 23:00',
      'Не курить в номерах',
      'Группа от 6 человек',
      'Есть парковка?',
      'Нет, рядом городская.',
    ])
      expect(draft).toContain(piece);
  });

  it('разделы и порядок — как в скелете кита (sistemnyy-prompt.md): правила раньше стиля, примеры последними', () => {
    const draft = sellerPromptDraft(FILLED);
    const order = [
      'Разговор по шагам',
      'Правила объекта',
      'Чего не делать',
      'Когда ещё звать человека',
      'Стиль',
      'Готовые ответы',
    ].map((title) => draft.split('\n').indexOf(title));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(draft).toContain('- Есть парковка? → Нет, рядом городская.');
  });
});
