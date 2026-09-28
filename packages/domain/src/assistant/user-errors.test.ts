import { describe, expect, it } from 'vitest';
import {
  USER_ERRORS_RETENTION_DAYS,
  UserErrorDedupe,
  isUserErrorRecorded,
  userErrorMessage,
  userErrorSection,
  userErrorsCutoff,
} from './user-errors';

/**
 * Журнал ошибок, которые видит человек (DATA_MODEL §14, ТЗ ред. 1, П3): что попадает в строку и как помощник
 * называет раздел. Тело запроса, значения из адреса и данные гостей в строку не попадают по построению — сюда
 * приходят только шаблон маршрута и текст ответа, который API отдал сам.
 */

describe('userErrorSection — раздел стойки по шаблону маршрута', () => {
  it.each([
    ['/reservations', 'Брони'],
    ['/reservations/:number/items/:itemId', 'Брони'],
    ['/hotel/reservations', 'Брони'],
    ['/chessboard', 'Шахматка'],
    ['/availability', 'Доступность номеров'],
    ['/rates/bulk', 'Тарифы'],
    ['/rate-plans', 'Тарифы'],
    ['/guests/:id', 'Гости'],
    ['/finance/folios/:id/payments', 'Оплаты'],
    ['/desk/today', 'Главная'],
    ['/units/:code/blocks', 'Номера'],
    ['/inventory/units', 'Номерной фонд'],
    ['/hotel/settings', 'Настройки объекта'],
    ['/hotel/onboarding', 'Настройка отеля'],
    ['/hotel/channel-report', 'Менеджер каналов'],
    ['/channels/channex/mapping', 'Менеджер каналов'],
    ['/analytics/sites/:id', 'Сайт и онлайн-бронирование'],
    ['/guard/incidents/:id/resolve', 'Неисправности'],
    ['/audit', 'Журнал действий'],
    ['/auth/password', 'Вход и учётная запись'],
    ['/system/freshness', 'Система'],
    ['/ai-seller/profile', 'ИИ-продавец'],
  ])('%s → %s', (route, section) => {
    expect(userErrorSection(route)).toBe(section);
  });

  it('незнакомый маршрут — «Прочее», а не выдуманный раздел', () => {
    expect(userErrorSection('/something-new')).toBe('Прочее');
    expect(userErrorSection('')).toBe('Прочее');
  });

  it('совпадение по целому сегменту: /reservations-archive — не «Брони»', () => {
    expect(userErrorSection('/reservations-archive')).toBe('Прочее');
  });
});

describe('userErrorMessage — текст, который получил человек', () => {
  it('текст отказа Nest строкой', () => {
    expect(
      userErrorMessage({ statusCode: 400, message: 'adults — целое ≥ 1', error: 'Bad Request' }),
    ).toBe('adults — целое ≥ 1');
  });

  it('список причин — через «; », как его показывает стойка', () => {
    expect(userErrorMessage({ message: ['adults — целое ≥ 1', 'дата выезда раньше заезда'] })).toBe(
      'adults — целое ≥ 1; дата выезда раньше заезда',
    );
  });

  it('ответ строкой', () => {
    expect(userErrorMessage('Бронь не найдена')).toBe('Бронь не найдена');
  });

  it('ни текста, ни списка — «Internal server error», как отвечает Nest на поломку', () => {
    expect(userErrorMessage(null)).toBe('Internal server error');
    expect(userErrorMessage({ statusCode: 500 })).toBe('Internal server error');
  });

  it('почта, телефон и секрет в тексте маскируются', () => {
    const text = userErrorMessage({
      message: 'Гость ivan.petrov@example.com, +7 701 123 45 67, Bearer abc.def.ghi уже заселён',
    });
    expect(text).not.toContain('ivan.petrov@example.com');
    expect(text).not.toContain('701 123 45 67');
    expect(text).not.toContain('abc.def.ghi');
    expect(text).toContain('<почта>');
    expect(text).toContain('<телефон>');
  });

  it('длиннее 500 знаков — обрезается', () => {
    const text = userErrorMessage({ message: 'я'.repeat(800) });
    expect(text.length).toBeLessThanOrEqual(501);
    expect(text.endsWith('…')).toBe(true);
  });
});

describe('isUserErrorRecorded — что пишется', () => {
  it('ответы 4xx и 5xx', () => {
    expect(isUserErrorRecorded(400, '/reservations')).toBe(true);
    expect(isUserErrorRecorded(404, '/reservations/:number')).toBe(true);
    expect(isUserErrorRecorded(503, '/channels/channex/sync')).toBe(true);
    expect(isUserErrorRecorded(599, '/reservations')).toBe(true);
  });

  it('не ошибка — не пишется', () => {
    expect(isUserErrorRecorded(200, '/reservations')).toBe(false);
    expect(isUserErrorRecorded(304, '/reservations')).toBe(false);
    expect(isUserErrorRecorded(399, '/reservations')).toBe(false);
    expect(isUserErrorRecorded(600, '/reservations')).toBe(false);
  });

  it('маршруты помощника не пишутся: «подпись не настроена» иначе попадала бы в журнал на каждой странице', () => {
    expect(isUserErrorRecorded(503, '/assistant/identity')).toBe(false);
    expect(isUserErrorRecorded(403, '/assistant/errors')).toBe(false);
  });

  it('без шаблона маршрута не пишется: неизвестный адрес — не раздел стойки', () => {
    expect(isUserErrorRecorded(404, '')).toBe(false);
  });
});

describe('срок хранения', () => {
  it('30 суток', () => {
    expect(USER_ERRORS_RETENTION_DAYS).toBe(30);
    expect(userErrorsCutoff(new Date('2026-09-24T12:00:00Z')).toISOString()).toBe(
      '2026-08-25T12:00:00.000Z',
    );
  });
});

describe('UserErrorDedupe — одна и та же ошибка чаще раза в минуту не дублируется', () => {
  const key = { userId: 'u', method: 'GET', route: '/chessboard', status: 404, message: 'нет' };

  it('первая — пишется, повтор в ту же минуту — нет, после минуты — снова', () => {
    const dedupe = new UserErrorDedupe(60_000);
    const t0 = 1_000_000;
    expect(dedupe.firstSeen(key, t0)).toBe(true);
    expect(dedupe.firstSeen(key, t0 + 59_999)).toBe(false);
    expect(dedupe.firstSeen(key, t0 + 60_000)).toBe(true);
  });

  it('другой человек, маршрут, код или текст — отдельная ошибка', () => {
    const dedupe = new UserErrorDedupe(60_000);
    expect(dedupe.firstSeen(key, 0)).toBe(true);
    expect(dedupe.firstSeen({ ...key, userId: 'v' }, 1)).toBe(true);
    expect(dedupe.firstSeen({ ...key, route: '/rates' }, 2)).toBe(true);
    expect(dedupe.firstSeen({ ...key, status: 400 }, 3)).toBe(true);
    expect(dedupe.firstSeen({ ...key, message: 'другое' }, 4)).toBe(true);
  });

  it('память не растёт без предела: старые отметки вычищаются', () => {
    const dedupe = new UserErrorDedupe(60_000, 100);
    for (let i = 0; i < 1_000; i += 1) dedupe.firstSeen({ ...key, userId: `u${i}` }, i * 1_000);
    expect(dedupe.size).toBeLessThanOrEqual(100);
  });
});
