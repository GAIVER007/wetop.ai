import { describe, expect, it } from 'vitest';
import {
  FOOD_CONFIRMATION_TEMPLATE,
  FOOD_DEFAULT_REMINDER_TEMPLATE,
  FOOD_REMINDER_PLACEHOLDERS,
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
