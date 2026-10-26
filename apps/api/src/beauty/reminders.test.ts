import { describe, expect, it, vi } from 'vitest';
import { reminderMessage, reminderSubject } from './reminders';

/** Язык организации (ORG-LOCALE-20261026): напоминание и подтверждение клиенту на языке салона */
function db(locale: string | undefined) {
  return {
    appointment: {
      findUnique: vi.fn(async () => ({
        status: 'BOOKED',
        startsAt: new Date('2026-10-27T07:30:00Z'),
        locationId: 'loc',
        customer: { firstName: 'Sara', lastName: null, phone: null, email: 'sara@example.invalid' },
        employee: { name: 'Dina' },
        service: { name: 'Classic lashes' },
        lines: [],
        location: {
          name: 'Pearl',
          address: 'Doha',
          phone: '+974 5000 0000',
          timezone: 'Asia/Qatar',
          business: { name: 'Lashes by Kyial salon', organization: locale ? { locale } : undefined },
        },
      })),
    },
    beautyReminderSettings: { findUnique: vi.fn(async () => null) },
  } as never;
}

describe('сообщения клиентам салона на языке организации', () => {
  it('английский салон: напоминание и подтверждение по-английски, тема письма тоже', async () => {
    const reminder = await reminderMessage(db('en'), 'a1', 'REMINDER');
    expect(reminder!.text).toMatch(/^Hello, Sara! This is a reminder of your appointment at Lashes by Kyial salon/);
    expect(reminder!.text).toContain('27 October at 10:30');
    expect(reminder!.locale).toBe('en');
    const confirmation = await reminderMessage(db('en'), 'a1', 'CONFIRMATION');
    expect(confirmation!.text).toMatch(/^Hello, Sara! You are booked at/);
    expect(reminderSubject('REMINDER', 'en')).toBe('Appointment reminder');
    expect(reminderSubject('REVIEW_REQUEST', 'en')).toBe('How was your visit');
  });
  it('русский салон как раньше', async () => {
    const reminder = await reminderMessage(db('ru'), 'a1', 'REMINDER');
    expect(reminder!.text).toMatch(/^Здравствуйте, Sara! Напоминаем о записи/);
    expect(reminderSubject('REMINDER', 'ru')).toBe('Напоминание о записи');
  });
});
