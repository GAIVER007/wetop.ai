import { describe, expect, it } from 'vitest';
import { assessWebhook, isFullSyncDue, pullDelayMs, type WebhookHealth } from './schedule';

const utc = (s: string) => new Date(s);
const calm: WebhookHealth = { suspect: false, since: null, reason: null };

describe('isFullSyncDue — раз в сутки после назначенного часа по Алматы', () => {
  it('до назначенного часа не пора, даже если вчера не делали', () => {
    // 01:30 Алматы = 20:30 UTC накануне
    expect(isFullSyncDue({ lastRunAt: null, now: utc('2026-09-11T20:30:00Z'), hourLocal: 3 })).toBe(
      false,
    );
  });
  it('после часа и без единого прогона — пора', () => {
    expect(isFullSyncDue({ lastRunAt: null, now: utc('2026-09-11T22:30:00Z'), hourLocal: 3 })).toBe(
      true,
    );
  });
  it('после часа, но сегодня (по Алматы) уже делали — не пора', () => {
    // 22:30 UTC 11.09 = 03:30 Алматы 12.09; прогон в 23:10 UTC 11.09 = 04:10 Алматы 12.09 — тот же день
    expect(
      isFullSyncDue({
        lastRunAt: utc('2026-09-11T23:10:00Z'),
        now: utc('2026-09-12T01:00:00Z'),
        hourLocal: 3,
      }),
    ).toBe(false);
  });
  it('после часа, последний прогон вчера по Алматы — пора', () => {
    // 04:10 Алматы 11.09 против 03:30 Алматы 12.09
    expect(
      isFullSyncDue({
        lastRunAt: utc('2026-09-10T23:10:00Z'),
        now: utc('2026-09-11T22:30:00Z'),
        hourLocal: 3,
      }),
    ).toBe(true);
  });
  it('ручной прогон днём засчитывается за сегодня', () => {
    // прогон 15:05 Алматы, сейчас 17:00 Алматы того же дня
    expect(
      isFullSyncDue({
        lastRunAt: utc('2026-09-11T10:05:00Z'),
        now: utc('2026-09-11T12:00:00Z'),
        hourLocal: 3,
      }),
    ).toBe(false);
  });
});

describe('assessWebhook — webhook под подозрением, если бронь пришла опросом ленты', () => {
  it('без броней опросом подозрения нет', () => {
    const h = assessWebhook({
      lastWebhookAt: utc('2026-09-11T10:00:00Z'),
      lastPullBookingAt: null,
      now: utc('2026-09-11T12:00:00Z'),
      previous: calm,
    });
    expect(h.suspect).toBe(false);
  });
  it('бронь опросом новее последнего webhook и свежая — подозрение с момента той брони', () => {
    const h = assessWebhook({
      lastWebhookAt: utc('2026-09-11T10:11:00Z'),
      lastPullBookingAt: utc('2026-09-11T13:57:00Z'),
      now: utc('2026-09-11T14:00:00Z'),
      previous: calm,
    });
    expect(h.suspect).toBe(true);
    expect(h.since?.toISOString()).toBe('2026-09-11T13:57:00.000Z');
    expect(h.reason).toMatch(/опрос/);
  });
  it('webhook ни разу не приходил, а бронь опросом есть — подозрение', () => {
    const h = assessWebhook({
      lastWebhookAt: null,
      lastPullBookingAt: utc('2026-09-11T13:57:00Z'),
      now: utc('2026-09-11T14:00:00Z'),
      previous: calm,
    });
    expect(h.suspect).toBe(true);
  });
  it('давняя бронь опросом (старше окна) сама по себе подозрения не создаёт', () => {
    const h = assessWebhook({
      lastWebhookAt: null,
      lastPullBookingAt: utc('2026-09-11T08:00:00Z'),
      now: utc('2026-09-11T14:00:00Z'),
      previous: calm,
    });
    expect(h.suspect).toBe(false);
  });
  it('подозрение снимается, когда webhook доставил событие после начала подозрения', () => {
    const suspect: WebhookHealth = {
      suspect: true,
      since: utc('2026-09-11T13:57:00Z'),
      reason: 'x',
    };
    const h = assessWebhook({
      lastWebhookAt: utc('2026-09-11T14:22:00Z'),
      lastPullBookingAt: utc('2026-09-11T13:57:00Z'),
      now: utc('2026-09-11T14:23:00Z'),
      previous: suspect,
    });
    expect(h.suspect).toBe(false);
    expect(h.since).toBeNull();
  });
  it('пока webhook молчит, подозрение держится и после окна', () => {
    const suspect: WebhookHealth = {
      suspect: true,
      since: utc('2026-09-11T13:57:00Z'),
      reason: 'x',
    };
    const h = assessWebhook({
      lastWebhookAt: utc('2026-09-11T10:11:00Z'),
      lastPullBookingAt: utc('2026-09-11T13:57:00Z'),
      now: utc('2026-09-11T18:00:00Z'),
      previous: suspect,
    });
    expect(h.suspect).toBe(true);
    expect(h.since?.toISOString()).toBe('2026-09-11T13:57:00.000Z');
  });
});

describe('pullDelayMs', () => {
  it('под подозрением опрашиваем чаще', () => {
    expect(pullDelayMs({ suspect: false, baseMs: 300_000, fastMs: 60_000 })).toBe(300_000);
    expect(pullDelayMs({ suspect: true, baseMs: 300_000, fastMs: 60_000 })).toBe(60_000);
  });
});
