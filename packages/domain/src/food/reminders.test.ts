import { describe, expect, it } from 'vitest';
import {
  FOOD_CONFIRMATION_TEMPLATE,
  FOOD_DEFAULT_REMINDER_TEMPLATE,
  FOOD_REMINDER_PLACEHOLDERS,
  foodConfirmationTemplate,
  foodDefaultReminderTemplate,
  foodReminderVariables,
  foodReminderWanted,
  renderFoodReminder,
} from './reminders';

/**
 * Напоминания гостям ресторана (DATA_MODEL §61, миграция 152, «да» владельца 23.10.2026): какие строки очереди нужны
 * брони и текст для гостя. Расписание и повтор общие с салоном (beauty/reminders), здесь только правила брони стола.
 */
const at = (iso: string) => new Date(iso);
const now = at('2026-10-23T06:00:00Z');
const base = { startsAt: at('2026-10-25T14:00:00Z'), status: 'BOOKED', source: 'DESK', enabled: true, hoursBefore: [24, 2], now };

describe('напоминания гостям ресторана', () => {
  it('бронь со стойки: напоминания за 24 и за 2 часа, без подтверждения', () => {
    expect(foodReminderWanted(base)).toEqual({
      reminders: [at('2026-10-24T14:00:00Z'), at('2026-10-25T12:00:00Z')],
      confirmation: false,
    });
  });

  it('бронь с сайта: ещё подтверждение сразу', () => {
    expect(foodReminderWanted({ ...base, source: 'WEBSITE', confirm: true }).confirmation).toBe(true);
    // повторная синхронизация той же брони (перенос) подтверждение второй раз не просит
    expect(foodReminderWanted({ ...base, source: 'WEBSITE' }).confirmation).toBe(false);
  });

  it('гости уже за столом, ушли, не пришли, отмена или напоминания выключены: ничего не нужно', () => {
    for (const status of ['SEATED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'])
      expect(foodReminderWanted({ ...base, status, source: 'WEBSITE', confirm: true })).toEqual({ reminders: [], confirmation: false });
    expect(foodReminderWanted({ ...base, enabled: false, source: 'WEBSITE', confirm: true })).toEqual({ reminders: [], confirmation: false });
  });

  it('гость с улицы (WALK_IN) напоминаний не получает; прошедшие моменты не ставятся', () => {
    expect(foodReminderWanted({ ...base, source: 'WALK_IN' })).toEqual({ reminders: [], confirmation: false });
    expect(foodReminderWanted({ ...base, startsAt: at('2026-10-23T07:30:00Z') }).reminders).toEqual([]);
    expect(foodReminderWanted({ ...base, startsAt: at('2026-10-23T09:00:00Z') }).reminders).toEqual([at('2026-10-23T07:00:00Z')]);
  });

  it('текст: дата и время по поясу филиала, гостей числом со словом, ресторан и адрес', () => {
    const vars = foodReminderVariables({
      customerName: ' Айгуль ',
      startsAt: at('2026-10-25T14:00:00Z'),
      timezone: 'Asia/Almaty',
      partySize: 4,
      restaurantName: 'Ресторан у гор',
      address: 'ул. Абая, 1',
      phone: '+7 700 000 00 00',
    });
    expect(Object.keys(vars)).toEqual([...FOOD_REMINDER_PLACEHOLDERS]);
    expect(vars).toMatchObject({ имя: 'Айгуль', дата: '25 октября', время: '19:00', гостей: '4 гостя' });
    expect(renderFoodReminder(null, vars)).toBe(
      'Здравствуйте, Айгуль! Напоминаем о брони в Ресторан у гор: 25 октября в 19:00, 4 гостя. Адрес: ул. Абая, 1. Телефон: +7 700 000 00 00.',
    );
    expect(renderFoodReminder(FOOD_CONFIRMATION_TEMPLATE, vars)).toContain('Столик забронирован');
    expect(renderFoodReminder('{имя}, ждём {гостей}! {мастер}', vars)).toBe('Айгуль, ждём 4 гостя! {мастер}');
    expect(FOOD_DEFAULT_REMINDER_TEMPLATE).not.toContain('{мастер}');
    expect(foodReminderVariables({ ...{ customerName: 'А', startsAt: now, timezone: 'Asia/Almaty', restaurantName: 'Р', address: null, phone: null }, partySize: 1 }).гостей).toBe('1 гость');
    expect(foodReminderVariables({ customerName: 'А', startsAt: now, timezone: 'Asia/Almaty', restaurantName: 'Р', address: null, phone: null, partySize: 5 }).гостей).toBe('5 гостей');
  });

  it('пустой адрес и телефон не оставляют двойных пробелов и пустых «Адрес:»', () => {
    const vars = foodReminderVariables({ customerName: 'Иван', startsAt: at('2026-10-25T14:00:00Z'), timezone: 'Asia/Almaty', partySize: 2, restaurantName: 'Р', address: null, phone: null });
    expect(renderFoodReminder(null, vars)).toBe('Здравствуйте, Иван! Напоминаем о брони в Р: 25 октября в 19:00, 2 гостя.');
  });
});

/** Язык организации (ORG-LOCALE-20261026): ресторан на английском пишет гостям по-английски */
describe('сообщения гостям ресторана на языке организации', () => {
  const input = {
    customerName: 'Sara', startsAt: at('2026-10-27T15:00:00Z'), timezone: 'Asia/Qatar', partySize: 2,
    restaurantName: 'Pearl Grill', address: 'Doha', phone: '+974 5000 0000',
  };
  it('напоминание и подтверждение по-английски, гости и дата по-английски', () => {
    const vars = foodReminderVariables({ ...input, locale: 'en' });
    expect(vars.гостей).toBe('2 guests');
    expect(vars.дата).toBe('27 October');
    expect(renderFoodReminder(foodDefaultReminderTemplate('en'), vars)).toBe(
      'Hello, Sara! This is a reminder of your table booking at Pearl Grill: 27 October at 18:00, 2 guests. Address: Doha. Phone: +974 5000 0000.',
    );
    expect(renderFoodReminder(foodConfirmationTemplate('en'), vars)).toMatch(/^Hello, Sara! Your table at Pearl Grill is booked/);
  });
  it('один гость в единственном числе; пустой адрес убирается и по-английски', () => {
    const vars = foodReminderVariables({ ...input, partySize: 1, address: null, locale: 'en' });
    expect(vars.гостей).toBe('1 guest');
    expect(renderFoodReminder(foodDefaultReminderTemplate('en'), vars)).not.toContain('Address:');
  });
  it('без языка как раньше', () => {
    expect(foodDefaultReminderTemplate()).toBe(FOOD_DEFAULT_REMINDER_TEMPLATE);
    expect(foodReminderVariables(input).гостей).toBe('2 гостя');
  });
});
