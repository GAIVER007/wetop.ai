import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDER_HOURS,
  DEFAULT_REMINDER_TEMPLATE,
  REMINDER_MAX_ATTEMPTS,
  confirmationTemplate,
  defaultReminderTemplate,
  parseReminderSettings,
  reminderBackoffMs,
  reminderDueTimes,
  reminderVariables,
  renderReminder,
  reviewRequestDueAt,
  reviewRequestText,
  reviewUrl,
  whatsappLink,
} from './reminders';

const H = 3_600_000;

describe('reminderDueTimes', () => {
  const startsAt = new Date('2026-10-23T10:00:00Z');
  it('за 24 и 2 часа до начала, по возрастанию', () => {
    const now = new Date('2026-10-21T10:00:00Z');
    expect(reminderDueTimes(startsAt, [24, 2], now).map((d) => d.toISOString())).toEqual([
      '2026-10-22T10:00:00.000Z',
      '2026-10-23T08:00:00.000Z',
    ]);
  });
  it('прошедшие пропускаются, повторы часов схлопываются', () => {
    const now = new Date('2026-10-22T12:00:00Z');
    expect(reminderDueTimes(startsAt, [2, 24, 2], now).map((d) => d.toISOString())).toEqual(['2026-10-23T08:00:00.000Z']);
  });
  it('запись в прошлом: ничего', () => {
    expect(reminderDueTimes(startsAt, [24, 2], new Date(startsAt.getTime() + H))).toEqual([]);
  });
  it('ровно сейчас уже не планируется', () => {
    expect(reminderDueTimes(startsAt, [2], new Date(startsAt.getTime() - 2 * H))).toEqual([]);
  });
});

describe('renderReminder', () => {
  const vars = reminderVariables({
    customerName: 'Айгуль',
    serviceName: 'Стрижка',
    startsAt: new Date('2026-10-23T05:30:00Z'),
    timezone: 'Asia/Almaty',
    masterName: 'Дина',
    salonName: 'Лён',
    address: 'ул. Абая, 10',
    phone: '+7 701 000 00 00',
  });
  it('подставляет все восемь полей; дата и время по поясу филиала', () => {
    expect(renderReminder('{имя} {услуга} {дата} {время} {мастер} {салон} {адрес} {телефон}', vars)).toBe(
      'Айгуль Стрижка 23 октября 10:30 Дина Лён ул. Абая, 10 +7 701 000 00 00',
    );
  });
  it('шаблон по умолчанию на русском и без пустых мест', () => {
    const text = renderReminder(DEFAULT_REMINDER_TEMPLATE, vars);
    expect(text).toContain('Айгуль');
    expect(text).toContain('23 октября');
    expect(text).not.toMatch(/\{[^}]+\}/);
    expect(text).not.toContain('\u2014');
  });
  it('незнакомое поле остаётся как есть, пустое значение не оставляет двойных пробелов', () => {
    expect(renderReminder('{имя}  {неизвестно} {адрес}!', { ...vars, адрес: '' })).toBe('Айгуль {неизвестно}!');
  });
  it('пустой шаблон берёт текст по умолчанию', () => {
    expect(renderReminder('', vars)).toBe(renderReminder(DEFAULT_REMINDER_TEMPLATE, vars));
  });
});

describe('whatsappLink', () => {
  it('только цифры номера и закодированный текст', () => {
    expect(whatsappLink('+7 (701) 000-00-00', 'Привет & до встречи')).toBe(
      'https://wa.me/77010000000?text=%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82%20%26%20%D0%B4%D0%BE%20%D0%B2%D1%81%D1%82%D1%80%D0%B5%D1%87%D0%B8',
    );
  });
  it('казахстанский номер с 8 приводится к 7', () => {
    expect(whatsappLink('8 701 000 00 00', 'x')).toBe('https://wa.me/77010000000?text=x');
  });
  it('без номера или с коротким номером ссылки нет', () => {
    expect(whatsappLink(null, 'x')).toBeNull();
    expect(whatsappLink('12345', 'x')).toBeNull();
  });
});

describe('parseReminderSettings', () => {
  it('нормальные настройки', () => {
    expect(parseReminderSettings({ expectedRevision: 0, enabled: true, hoursBefore: [2, 24], template: ' Привет {имя} ', whatsappTemplateName: 'reminder_ru' })).toEqual({
      ok: true,
      value: { expectedRevision: 0, enabled: true, hoursBefore: [24, 2], template: 'Привет {имя}', whatsappTemplateName: 'reminder_ru' },
    });
  });
  it('пустой текст значит текст по умолчанию, пустое имя шаблона значит без WhatsApp', () => {
    const r = parseReminderSettings({ expectedRevision: 1, enabled: false, hoursBefore: [24], template: '  ', whatsappTemplateName: '' });
    expect(r).toMatchObject({ ok: true, value: { template: null, whatsappTemplateName: null } });
  });
  it.each([
    [{ expectedRevision: 0, enabled: true, hoursBefore: [], template: null, whatsappTemplateName: null }, 'часов'],
    [{ expectedRevision: 0, enabled: true, hoursBefore: [0], template: null, whatsappTemplateName: null }, 'часов'],
    [{ expectedRevision: 0, enabled: true, hoursBefore: [1, 2, 3, 4], template: null, whatsappTemplateName: null }, 'часов'],
    [{ expectedRevision: 0, enabled: true, hoursBefore: [24], template: 'x'.repeat(1001), whatsappTemplateName: null }, 'Текст'],
    [{ expectedRevision: 0, enabled: true, hoursBefore: [24], template: null, whatsappTemplateName: 'Bad Name' }, 'шаблона'],
    [{ expectedRevision: -1, enabled: true, hoursBefore: [24], template: null, whatsappTemplateName: null }, 'версию'],
    [{ expectedRevision: 0, enabled: true, hoursBefore: [24], template: null, whatsappTemplateName: null, extra: 1 }, 'поля'],
  ])('отказ %#', (raw, reason) => {
    const r = parseReminderSettings(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(reason);
  });
});

describe('повторы', () => {
  it('пауза растёт и упирается в 6 часов; ошибка после пяти попыток', () => {
    expect(reminderBackoffMs(1)).toBe(5 * 60_000);
    expect(reminderBackoffMs(2)).toBe(10 * 60_000);
    expect(reminderBackoffMs(20)).toBe(6 * H);
    expect(REMINDER_MAX_ATTEMPTS).toBe(5);
    expect(DEFAULT_REMINDER_HOURS).toEqual([24, 2]);
  });
});

describe('просьба отзыва после визита', () => {
  it('через 2 часа после конца визита, если «Выполнено» нажали раньше конца', () => {
    // визит до 12:00 по Алматы (07:00Z), выполнено в 11:50
    expect(
      reviewRequestDueAt({ endsAt: new Date('2026-10-23T07:00:00Z'), doneAt: new Date('2026-10-23T06:50:00Z'), timezone: 'Asia/Almaty' }).toISOString(),
    ).toBe('2026-10-23T09:00:00.000Z');
  });
  it('через 2 часа после «Выполнено», если нажали позже конца визита', () => {
    expect(
      reviewRequestDueAt({ endsAt: new Date('2026-10-23T07:00:00Z'), doneAt: new Date('2026-10-23T08:00:00Z'), timezone: 'Asia/Almaty' }).toISOString(),
    ).toBe('2026-10-23T10:00:00.000Z');
  });
  it('поздний вечер и ночь переносятся на 10:00 по поясу филиала', () => {
    // конец визита 20:00 Алматы, +2 часа = 22:00: просьба на следующий день в 10:00 (05:00Z)
    expect(
      reviewRequestDueAt({ endsAt: new Date('2026-10-23T15:00:00Z'), doneAt: new Date('2026-10-23T15:00:00Z'), timezone: 'Asia/Almaty' }).toISOString(),
    ).toBe('2026-10-24T05:00:00.000Z');
    // конец визита 06:30 Алматы, +2 часа = 08:30: в тот же день в 10:00
    expect(
      reviewRequestDueAt({ endsAt: new Date('2026-10-23T01:30:00Z'), doneAt: new Date('2026-10-23T01:30:00Z'), timezone: 'Asia/Almaty' }).toISOString(),
    ).toBe('2026-10-23T05:00:00.000Z');
  });
  it('текст: имя и ссылка, без длинного тире; без имени без пустой запятой', () => {
    const withName = reviewRequestText('Айгуль', 'https://app.wetop.ai/reviews/abc');
    expect(withName).toBe('Спасибо, что были у нас, Айгуль! Оцените визит: https://app.wetop.ai/reviews/abc');
    expect(withName).not.toContain('\u2014');
    expect(reviewRequestText('  ', 'https://x.test/reviews/abc')).toBe('Спасибо, что были у нас! Оцените визит: https://x.test/reviews/abc');
  });
  it('адрес отзыва: база стойки без лишней косой черты плюс путь приглашения', () => {
    expect(reviewUrl('https://app.wetop.ai/', '/reviews/abc')).toBe('https://app.wetop.ai/reviews/abc');
    expect(reviewUrl('https://app.wetop.ai', '/reviews/abc')).toBe('https://app.wetop.ai/reviews/abc');
  });
});

/** Язык организации (ORG-LOCALE-20261026): салон на английском пишет клиентам по-английски */
describe('сообщения клиентам на языке салона', () => {
  const at = new Date('2026-10-27T07:30:00Z');
  const base = {
    customerName: 'Sara',
    serviceName: 'Classic lashes',
    startsAt: at,
    timezone: 'Asia/Qatar',
    masterName: 'Dina',
    salonName: 'Lashes by Kyial salon',
    address: 'Doha, Pearl',
    phone: '+974 5000 0000',
  };
  it('напоминание по умолчанию на английском: дата по-английски, кириллицы нет', () => {
    const vars = reminderVariables({ ...base, locale: 'en' });
    expect(vars.дата).toBe('27 October');
    const text = renderReminder(defaultReminderTemplate('en'), vars);
    expect(text).toBe(
      'Hello, Sara! This is a reminder of your appointment at Lashes by Kyial salon: Classic lashes, 27 October at 10:30, with Dina. Address: Doha, Pearl. If your plans change, please call us: +974 5000 0000.',
    );
    expect(text).not.toMatch(/[А-Яа-яЁё]/);
  });
  it('подтверждение и просьба отзыва на английском', () => {
    const vars = reminderVariables({ ...base, locale: 'en' });
    expect(renderReminder(confirmationTemplate('en'), vars)).toMatch(/^Hello, Sara! You are booked at Lashes by Kyial salon/);
    expect(reviewRequestText('Sara', 'https://x/reviews/k', 'en')).toBe('Thank you for visiting us, Sara! Rate your visit: https://x/reviews/k');
  });
  it('английские поля в своём шаблоне тоже подставляются', () => {
    const vars = reminderVariables({ ...base, locale: 'en' });
    expect(renderReminder('Hi {name}, see you {date} at {time}', vars)).toBe('Hi Sara, see you 27 October at 10:30');
  });
  it('без языка всё как раньше: русский', () => {
    const vars = reminderVariables(base);
    expect(vars.дата).toBe('27 октября');
    expect(defaultReminderTemplate('ru')).toBe(DEFAULT_REMINDER_TEMPLATE);
    expect(reviewRequestText('Сара', 'https://x/r')).toBe('Спасибо, что были у нас, Сара! Оцените визит: https://x/r');
  });
});
