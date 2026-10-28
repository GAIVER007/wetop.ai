import { describe, expect, it } from 'vitest';
import { closeReminder, CLOSE_REMINDER_MINUTES } from './shift-close-reminder';

/**
 * Владелец 27.10.2026: «напоминай что к закрытию нужно отправить уведомление о закрытии смены». За 30 минут до
 * конца рабочего дня филиала касса в шапке напоминает закрыть смену и сдать кассу; после конца напоминание красное.
 */
const closesAt = '2026-10-27T21:00:00.000Z';
const at = (iso: string) => new Date(iso);

describe('напоминание о закрытии смены', () => {
  it('за 30 минут до закрытия: «скоро закрытие»', () => {
    expect(CLOSE_REMINDER_MINUTES).toBe(30);
    expect(closeReminder({ shiftOpen: true, closesAt, now: at('2026-10-27T20:30:00Z') })).toEqual({ tone: 'soon', minutes: 30 });
    expect(closeReminder({ shiftOpen: true, closesAt, now: at('2026-10-27T20:50:00Z') })).toEqual({ tone: 'soon', minutes: 10 });
  });
  it('раньше чем за 30 минут: молчит', () => {
    expect(closeReminder({ shiftOpen: true, closesAt, now: at('2026-10-27T20:29:00Z') })).toBeNull();
  });
  it('время вышло, смена открыта: красное «пора закрыть»', () => {
    expect(closeReminder({ shiftOpen: true, closesAt, now: at('2026-10-27T21:00:00Z') })).toEqual({ tone: 'late', minutes: 0 });
    expect(closeReminder({ shiftOpen: true, closesAt, now: at('2026-10-27T22:15:00Z') })).toEqual({ tone: 'late', minutes: 75 });
  });
  it('смена закрыта или время закрытия неизвестно: молчит', () => {
    expect(closeReminder({ shiftOpen: false, closesAt, now: at('2026-10-27T21:30:00Z') })).toBeNull();
    expect(closeReminder({ shiftOpen: true, closesAt: null, now: at('2026-10-27T21:30:00Z') })).toBeNull();
  });
});
