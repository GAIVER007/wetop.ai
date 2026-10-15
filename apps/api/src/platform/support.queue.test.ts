import { describe, expect, it } from 'vitest';
import {
  SUPPORT_CATEGORIES,
  categoryCounts,
  filterByCategory,
  queueItems,
  supportCategory,
  supportCategoryOf,
} from './support.queue';

/**
 * Категория обращения (план `plans/support-queue-hygiene-2026-10-02.md` §3): считается по первому
 * сообщению пользователя, в базе не хранится. Признак поломки сильнее денежного намеренно:
 * «ошибка при оплате» и «500 на странице тарифов» значат, что сломалось, а не вопрос про деньги.
 */
describe('категория обращения', () => {
  const cases: ReadonlyArray<[string, string]> = [
    ['Хочу вернуть деньги за подписку', 'payment'],
    ['Списали дважды за тариф', 'payment'],
    ['Не приходит возврат гостю', 'payment'],
    ['Не могу войти в кабинет', 'access'],
    ['Сотруднику не выдаются права на финансы', 'access'],
    ['Не сохраняется бронь, пишет ошибку', 'error'],
    ['Шахматка не открывается, всё зависает', 'error'],
    ['500 на странице тарифов', 'error'],
    ['Ошибка при оплате картой', 'error'],
    ['Как завести койко-место?', 'platform'],
    ['Где посмотреть долги по броням', 'platform'],
    ['Подскажите про выгрузку в каналы', 'platform'],
    ['Спасибо', 'other'],
    ['', 'other'],
  ];

  it.each(cases)('«%s» → %s', (text, expected) => {
    expect(supportCategory(text)).toBe(expected);
  });

  it('категорий ровно пять, «другое» последняя', () => {
    expect(SUPPORT_CATEGORIES).toEqual(['platform', 'error', 'payment', 'access', 'other']);
  });

  it('без сообщений пользователя ставим «другое», а не догадку по ответу помощника', () => {
    expect(supportCategoryOf(null)).toBe('other');
    expect(supportCategoryOf({ role: 'assistant', text: 'Ошибка на вашей стороне', at: null })).toBe(
      'other',
    );
  });
});

describe('строка очереди', () => {
  const row = (first: unknown) => ({
    id: '11111111-1111-4111-8111-111111111111',
    channel: 'widget',
    client_name: null,
    mode: 'bot_active',
    stage: 'new',
    messages: 2,
    started_at: '2026-10-02T10:00:00+00:00',
    last_activity_at: '2026-10-02T10:05:00+00:00',
    last_message: { role: 'assistant', text: 'Передал специалисту', at: null },
    first_message: first,
    waiting_since: null,
    closed: false,
  });

  it('категория берётся из первого сообщения пользователя, а не из последнего', () => {
    const [item] = queueItems({
      items: [row({ role: 'user', text: 'Верните деньги за подписку', at: null })],
    });
    expect(item?.category).toBe('payment');
    expect(item?.firstMessage).toEqual({
      role: 'user',
      text: 'Верните деньги за подписку',
      at: null,
    });
  });

  it('старый бот поля не отдаёт: строка встаёт в «другое», а не роняет очередь', () => {
    const [item] = queueItems({ items: [row(undefined)] });
    expect(item?.firstMessage).toBeNull();
    expect(item?.category).toBe('other');
  });
});

describe('числа и отбор по категории', () => {
  const items = [
    { category: 'payment' as const },
    { category: 'payment' as const },
    { category: 'error' as const },
    { category: 'other' as const },
  ];

  it('числа считаются по строкам выбранного статуса: столько же, сколько покажет отбор', () => {
    expect(categoryCounts(items)).toEqual({
      all: 4,
      platform: 0,
      error: 1,
      payment: 2,
      access: 0,
      other: 1,
    });
  });

  it('отбор «все» строк не трогает, чужая категория даёт пусто', () => {
    expect(filterByCategory(items, 'all')).toHaveLength(4);
    expect(filterByCategory(items, 'payment')).toHaveLength(2);
    expect(filterByCategory(items, 'access')).toHaveLength(0);
  });
});
