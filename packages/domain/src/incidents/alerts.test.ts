import { describe, expect, it } from 'vitest';
import { alertDue, effectiveSeverity, formatAlert, type AlertCandidate } from './alerts';

/**
 * Будильник (план среза 11, §6): CRITICAL — сразу в любое время и повторно каждые 30 минут, пока человек
 * не нажал «Принято»; WARNING — днём сразу, ночью копится до 09:00 Алматы. Сообщение без персональных данных.
 */
const at = (almatyHour: number, minute = 0) =>
  new Date(Date.UTC(2026, 8, 13, almatyHour - 5, minute)); // Алматы = UTC+5

function c(over: Partial<AlertCandidate> = {}): AlertCandidate {
  return {
    id: 'i-1',
    kind: 'stay.overbooked',
    severity: 'CRITICAL',
    status: 'ESCALATED',
    title: 'Продано сверх вместимости: Мужской дом, ночь 13.09 — 37 на 36',
    alertedAt: null,
    acknowledgedAt: null,
    fixAttempts: 0,
    lastFixResult: null,
    ...over,
  };
}

describe('alertDue', () => {
  it('CRITICAL будит и в 3 часа ночи', () => {
    expect(alertDue(c(), at(3))).toBe(true);
  });

  it('CRITICAL без «Принято» — повтор через 30 минут, не раньше', () => {
    expect(alertDue(c({ alertedAt: at(3) }), at(3, 29))).toBe(false);
    expect(alertDue(c({ alertedAt: at(3) }), at(3, 30))).toBe(true);
  });

  it('человек принял — больше не будить', () => {
    expect(
      alertDue(c({ alertedAt: at(3), acknowledgedAt: at(3, 5), status: 'ACKNOWLEDGED' }), at(4)),
    ).toBe(false);
  });

  it('WARNING ночью ждёт утра, днём уходит сразу и один раз', () => {
    const w = c({ severity: 'WARNING' });
    expect(alertDue(w, at(3))).toBe(false);
    expect(alertDue(w, at(8, 59))).toBe(false);
    expect(alertDue(w, at(9))).toBe(true);
    expect(alertDue(w, at(21, 59))).toBe(true);
    expect(alertDue(w, at(22))).toBe(false);
    expect(alertDue({ ...w, alertedAt: at(9) }, at(15))).toBe(false);
  });

  it('открытую, но не эскалированную (сторож ещё чинит) — не будить', () => {
    expect(alertDue(c({ status: 'OPEN' }), at(3))).toBe(false);
    expect(alertDue(c({ status: 'FIXING' }), at(3))).toBe(false);
  });
});

describe('formatAlert', () => {
  it('говорит, что сломалось, что сторож пробовал и что делать стойке', () => {
    const text = formatAlert(
      [
        c(),
        c({
          id: 'i-2',
          kind: 'outbox.failed',
          severity: 'CRITICAL',
          title: 'Остатки не ушли в Channex',
          fixAttempts: 2,
          lastFixResult: 'полная выгрузка: HTTP 503',
        }),
      ],
      at(3),
    );
    expect(text).toContain('Продано сверх вместимости');
    expect(text).toContain('сторож пробовал 2 раза: полная выгрузка: HTTP 503');
    expect(text).toMatch(/стойке/i);
    expect(text).toContain('Принято');
  });

  it('длинный список обрезается, чтобы уложиться в одно сообщение', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      c({ id: `i-${i}`, title: `Неисправность номер ${i} `.repeat(10) }),
    );
    const text = formatAlert(many, at(3));
    expect(text.length).toBeLessThanOrEqual(4000);
    expect(text).toMatch(/ещё \d+/);
  });
});

/**
 * 16–19.09.2026 туннель лежал трое суток, а «адрес webhook не отвечает» открывалось и закрывалось само,
 * будило один раз и затихало. Правило: неисправность, висящая больше суток, становится срочной, что бы
 * ни было записано в политике вида — будит ночью и повторяет каждые 30 минут, пока не нажали «Принято».
 */
describe('залежавшаяся неисправность становится срочной', () => {
  const DAY = 24 * 3600_000;
  it('WARNING старше суток будит ночью и повторно, как CRITICAL', () => {
    const now = at(3);
    const stale = c({
      severity: 'WARNING',
      kind: 'feed.stale',
      firstSeenAt: new Date(now.getTime() - DAY - 3600_000),
      alertedAt: new Date(now.getTime() - 40 * 60_000),
    });
    expect(effectiveSeverity(stale, now)).toBe('CRITICAL');
    expect(alertDue(stale, now)).toBe(true);
  });
  it('WARNING моложе суток остаётся WARNING: ночью ждёт утра', () => {
    const now = at(3);
    const fresh = c({ severity: 'WARNING', kind: 'feed.stale', firstSeenAt: new Date(now.getTime() - 2 * 3600_000) });
    expect(effectiveSeverity(fresh, now)).toBe('WARNING');
    expect(alertDue(fresh, now)).toBe(false);
  });
  it('в сообщении залежавшаяся помечена красным и сроком', () => {
    const now = at(12);
    const stale = c({ severity: 'WARNING', kind: 'feed.stale', title: 'Лента Channex не опрашивалась', firstSeenAt: new Date(now.getTime() - 3 * DAY) });
    const text = formatAlert([stale], now);
    expect(text).toContain('🔴');
    expect(text).toContain('висит 3 дн.');
    expect(text).toContain('срочных: 1');
  });
});
