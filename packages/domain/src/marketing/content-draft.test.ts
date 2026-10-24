import { describe, expect, it } from 'vitest';
import type { SiteFacts } from './site-facts';
import {
  availableContentCtas,
  composeContentPost,
  contentFactsOf,
  CONTENT_CHANNELS,
  CONTENT_CTAS,
  ContentDraftError,
  checkDraftFacts,
  normalizeContentDraft,
  normalizeContentVariants,
} from './content-draft';

describe('content-draft/0: ответ модели приводится к правилам', () => {
  it('берёт 1–2 варианта, режет длины и хештеги, убирает решётку и длинное тире', () => {
    const v = normalizeContentVariants({
      variants: [
        {
          hook: 'Осень — время ухода',
          title: 'Скидка на окрашивание',
          body: 'Текст поста '.repeat(300),
          hashtags: ['#салон', 'уход', '', '#осень', ...Array.from({ length: 12 }, (_, i) => `тег${i}`)],
          cta: 'BOOK_ONLINE',
        },
        { hook: 'Второй хук', title: null, body: 'Короткий текст', hashtags: [], cta: 'whatever' },
        { hook: 'Третий лишний', body: 'Не нужен', hashtags: [] },
      ],
    });
    expect(v).toHaveLength(2);
    expect(v[0]!.hook).toBe('Осень, время ухода');
    expect(v[0]!.body.length).toBeLessThanOrEqual(2200);
    expect(v[0]!.hashtags).toHaveLength(10);
    expect(v[0]!.hashtags.slice(0, 3)).toEqual(['салон', 'уход', 'осень']);
    expect(v[0]!.cta).toBe('BOOK_ONLINE');
    expect(v[1]!.cta).toBe('NONE');
    expect(v[1]!.title).toBeNull();
  });

  it('пустой или чужой ответ: честная ошибка, не пустой черновик', () => {
    expect(() => normalizeContentVariants(null)).toThrow(ContentDraftError);
    expect(() => normalizeContentVariants({ variants: [] })).toThrow(ContentDraftError);
    expect(() => normalizeContentVariants({ variants: [{ hook: 'x', body: '   ' }] })).toThrow(ContentDraftError);
  });

  it('модель не вставляет ссылки и телефоны: их подставляет домен по CTA', () => {
    const [v] = normalizeContentVariants({
      variants: [{ hook: 'h', body: 'Пишите +7 701 123 45 67 или на https://evil.example/x и www.spam.kz', cta: 'CALL' }],
    });
    expect(v!.body).not.toMatch(/\d{3}\s?\d{2}\s?\d{2}/);
    expect(v!.body).not.toMatch(/https?:|www\./);
  });
});

describe('проверка цифр по фактам карточки', () => {
  const facts = ['Стрижка женская 8 000 ₸', 'Окрашивание от 15000 ₸', 'Работаем с 2015 года'];
  it('цифры из карточки и темы не помечаются', () => {
    expect(checkDraftFacts('Стрижка за 8 000 ₸, окрашивание от 15 000 ₸, мы с 2015 года', facts, 'акция 20%')).toEqual([]);
    expect(checkDraftFacts('Скидка 20% всю неделю', facts, 'акция 20%')).toEqual([]);
  });
  it('выдуманные цены, проценты и стаж помечаются, сохранение не блокируется', () => {
    const w = checkDraftFacts('Скидка 50%, стрижка 5 000 ₸, 12 лет опыта', facts, 'осенний уход');
    expect(w).toEqual(['50%', '5000', '12']);
  });
  it('время и даты не считаются фактами цены', () => {
    expect(checkDraftFacts('Ждём с 10:00 до 20:00, 25.10', facts, '')).toEqual([]);
  });
});

describe('черновик, который сохраняет человек', () => {
  it('проверяет канал, CTA, длины и день публикации', () => {
    const d = normalizeContentDraft({
      channel: 'INSTAGRAM',
      topic: '  Осенний уход  ',
      title: '',
      body: 'Текст',
      hashtags: ['#a', 'b'],
      cta: 'WHATSAPP',
      origin: 'AI',
      plannedOn: '2026-10-27',
    });
    expect(d).toEqual({
      channel: 'INSTAGRAM',
      topic: 'Осенний уход',
      title: null,
      body: 'Текст',
      hashtags: ['a', 'b'],
      cta: 'WHATSAPP',
      origin: 'AI',
      plannedOn: '2026-10-27',
    });
    expect(CONTENT_CHANNELS).toContain('WHATSAPP_STATUS');
    expect(CONTENT_CTAS).toContain('NONE');
  });
  it('отклоняет чужой канал, пустой текст, лишнюю длину и кривую дату', () => {
    const base = { channel: 'INSTAGRAM', topic: 't', body: 'b', hashtags: [], origin: 'MANUAL' };
    expect(() => normalizeContentDraft({ ...base, channel: 'TIKTOK' })).toThrow(ContentDraftError);
    expect(() => normalizeContentDraft({ ...base, body: '  ' })).toThrow(ContentDraftError);
    expect(() => normalizeContentDraft({ ...base, body: 'x'.repeat(2201) })).toThrow(ContentDraftError);
    expect(() => normalizeContentDraft({ ...base, topic: 'x'.repeat(501) })).toThrow(ContentDraftError);
    expect(() => normalizeContentDraft({ ...base, plannedOn: '2026-02-30' })).toThrow(ContentDraftError);
    expect(() => normalizeContentDraft({ ...base, hashtags: Array(11).fill('a') })).toThrow(ContentDraftError);
    expect(() => normalizeContentDraft({ ...base, origin: 'BOT' })).toThrow(ContentDraftError);
    expect(normalizeContentDraft({ ...base }).cta).toBeNull();
    expect(normalizeContentDraft({ ...base }).plannedOn).toBeNull();
  });
});

describe('факты карточки и кнопка действия', () => {
  const facts: SiteFacts = {
    vertical: 'BEAUTY',
    location: { id: 'l1', name: 'Салон Тест', address: 'ул. Абая, 1', phone: '+7 700 000 00 01', whatsapp: null, city: null },
    catalog: {
      kind: 'services',
      items: [
        { code: 's1', name: 'Стрижка женская', price: { minor: '800000', currency: 'KZT' }, durationMin: 60, category: 'Волосы' },
        { code: 's2', name: 'Маникюр', price: { minor: '450050', currency: 'KZT' } },
        { code: 's3', name: 'Консультация' },
      ],
    },
    staff: [{ id: 'e1', name: 'Мастер Тест', specialization: 'Стрижка женская' }],
    hours: { days: [{ weekday: 1, open: '10:00', close: '20:00' }], checkInTime: null, checkOutTime: null },
    photosCount: 0,
    reviews: { avg: 4.8, count: 25 },
    gaps: [],
  };

  it('факты строками без float: цена из minor, адрес, мастера, отзывы', () => {
    expect(contentFactsOf(facts)).toEqual([
      'Название: Салон Тест',
      'Адрес: ул. Абая, 1',
      'Стрижка женская (Волосы): 8000 KZT, 60 мин',
      'Маникюр: 4500.50 KZT',
      'Консультация',
      'Мастер: Мастер Тест (Стрижка женская)',
      'Оценка гостей: 4.8 из 5, отзывов 25',
    ]);
  });

  it('кнопки только те, для которых есть данные; NONE всегда', () => {
    expect(availableContentCtas({ siteUrl: null, phone: '+7 700', whatsapp: null, address: 'ул. Абая, 1' })).toEqual([
      'CALL',
      'VISIT',
      'NONE',
    ]);
    expect(
      availableContentCtas({ siteUrl: 'https://s.example', phone: null, whatsapp: '+7 701 111 22 33', address: null }),
    ).toEqual(['BOOK_ONLINE', 'WHATSAPP', 'NONE']);
  });

  it('готовый пост: текст, строка действия из карточки и хештеги; недоступная кнопка не печатается', () => {
    const contacts = { siteUrl: 'https://s.example', phone: '+7 700 000 00 01', whatsapp: '+7 (701) 111-22-33', address: null };
    const v = { hook: 'h', title: null, body: 'Текст поста', hashtags: ['уход', 'салон'], cta: 'WHATSAPP' as const };
    expect(composeContentPost(v, contacts)).toBe('Текст поста\n\nНаписать в WhatsApp: https://wa.me/77011112233\n\n#уход #салон');
    expect(composeContentPost({ ...v, cta: 'BOOK_ONLINE' }, contacts)).toContain('Записаться онлайн: https://s.example');
    expect(composeContentPost({ ...v, cta: 'VISIT', hashtags: [] }, contacts)).toBe('Текст поста');
    expect(composeContentPost({ ...v, cta: 'NONE', hashtags: [] }, contacts)).toBe('Текст поста');
  });
});
