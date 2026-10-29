import { describe, expect, it, vi } from 'vitest';
import {
  SubscriptionNightlyService,
  nightlyDue,
  planNight,
  reminderLetter,
  type NightOrg,
  type SubscriptionNightlyRepository,
} from './subscription-nightly';

/**
 * Ночная проверка подписок (план 2026-10-29-owner-cabinet-full.md §3, срез 4): пробный кончился или «оплачено до» прошло
 * больше 3 дней назад → «только чтение»; оплату получили → снова работает (только если закрыла сама проверка); за 7 и
 * за 1 день до конца письмо владельцу, один раз на срок. Своя организация WETOP и клиенты без подписки не трогаются.
 */
const NOW = new Date('2026-10-29T00:30:00.000Z'); // 05:30 по Алматы, местный день 2026-10-29
const org = (o: Partial<NightOrg>): NightOrg => ({
  id: 'o1',
  name: 'Клиент',
  status: 'TRIAL',
  trialEndsAt: null,
  paidUntil: null,
  ownerEmail: 'boss@example.invalid',
  closedByNight: false,
  remindersSent: [],
  company: false,
  ...o,
});

describe('planNight', () => {
  it('пробный кончился: только чтение; ещё идёт: не трогаем', () => {
    const plan = planNight([org({ trialEndsAt: new Date('2026-10-28T10:00:00Z') }), org({ id: 'o2', trialEndsAt: new Date('2026-11-20T00:00:00Z') })], NOW);
    expect(plan.statuses).toEqual([{ organizationId: 'o1', from: 'TRIAL', to: 'READ_ONLY', reason: 'trial_ended' }]);
  });

  it('оплачено до прошло: 3 дня ждём, на 4-й только чтение', () => {
    const late3 = org({ status: 'ACTIVE', paidUntil: '2026-10-26' });
    const late4 = org({ id: 'o2', status: 'ACTIVE', paidUntil: '2026-10-25' });
    expect(planNight([late3, late4], NOW).statuses).toEqual([{ organizationId: 'o2', from: 'ACTIVE', to: 'READ_ONLY', reason: 'unpaid' }]);
  });

  it('платит без подписки (оплачено до не задано), архив и своя организация WETOP: не трогаем', () => {
    const plan = planNight(
      [
        org({ status: 'ACTIVE', paidUntil: null }),
        org({ id: 'o2', status: 'SUSPENDED', trialEndsAt: new Date('2026-01-01T00:00:00Z') }),
        org({ id: 'o3', company: true, trialEndsAt: new Date('2026-01-01T00:00:00Z') }),
      ],
      NOW,
    );
    expect(plan.statuses).toEqual([]);
    expect(plan.reminders).toEqual([]);
  });

  it('оплату получили: открывает только то, что закрыла сама проверка', () => {
    const plan = planNight(
      [
        org({ status: 'READ_ONLY', paidUntil: '2026-11-29', closedByNight: true }),
        org({ id: 'o2', status: 'READ_ONLY', paidUntil: '2026-11-29', closedByNight: false }),
        org({ id: 'o3', status: 'READ_ONLY', paidUntil: '2026-10-20', closedByNight: true }),
      ],
      NOW,
    );
    expect(plan.statuses).toEqual([{ organizationId: 'o1', from: 'READ_ONLY', to: 'ACTIVE', reason: 'paid' }]);
  });

  it('письмо за 7 и за 1 день до конца пробного и оплаты, один раз на срок', () => {
    const plan = planNight(
      [
        org({ trialEndsAt: new Date('2026-11-05T09:00:00Z') }),
        org({ id: 'o2', status: 'ACTIVE', paidUntil: '2026-10-30' }),
        org({ id: 'o3', status: 'ACTIVE', paidUntil: '2026-11-05', remindersSent: ['paid:2026-11-05:7'] }),
        org({ id: 'o4', trialEndsAt: new Date('2026-11-03T00:00:00Z') }),
        org({ id: 'o5', status: 'ACTIVE', paidUntil: '2026-11-05', ownerEmail: null }),
      ],
      NOW,
    );
    expect(plan.reminders).toEqual([
      { organizationId: 'o1', to: 'boss@example.invalid', name: 'Клиент', kind: 'trial', until: '2026-11-05', days: 7, key: 'trial:2026-11-05:7' },
      { organizationId: 'o2', to: 'boss@example.invalid', name: 'Клиент', kind: 'paid', until: '2026-10-30', days: 1, key: 'paid:2026-10-30:1' },
    ]);
  });
});

describe('reminderLetter', () => {
  it('пробный и оплата: срок словами, без длинных тире', () => {
    const trial = reminderLetter({ kind: 'trial', name: 'Клиент', until: '2026-11-05', days: 7 }, 'https://app.wetop.ai');
    expect(trial.subject).toBe('WETOP: пробный период закончится 05.11.2026');
    expect(trial.text).toContain('через 7 дн.');
    expect(trial.text).toContain('https://app.wetop.ai');
    const paid = reminderLetter({ kind: 'paid', name: 'Клиент', until: '2026-10-30', days: 1 }, 'https://app.wetop.ai');
    expect(paid.subject).toBe('WETOP: оплата до 30.10.2026');
    expect(`${trial.text}${paid.text}`).not.toMatch(/—/);
  });
});

describe('nightlyDue', () => {
  it('после 05:00 по Алматы раз в местный день', () => {
    expect(nightlyDue(null, new Date('2026-10-28T23:59:00Z'))).toBe(false); // 04:59
    expect(nightlyDue(null, NOW)).toBe(true);
    expect(nightlyDue('2026-10-29', NOW)).toBe(false);
  });
});

describe('SubscriptionNightlyService', () => {
  const make = (orgs: NightOrg[], mailer: { send: ReturnType<typeof vi.fn> } | null) => {
    const repo: SubscriptionNightlyRepository & { statuses: unknown[]; reminders: unknown[] } = {
      statuses: [],
      reminders: [],
      async organizations() {
        return orgs;
      },
      async setStatus(change) {
        this.statuses.push(change);
      },
      async remindered(r) {
        this.reminders.push(r);
      },
    };
    return { repo, service: new SubscriptionNightlyService(repo, mailer as never, 'https://app.wetop.ai') };
  };

  it('меняет статусы, шлёт письма и записывает письмо в журнал; второй раз за день молчит', async () => {
    const mailer = { send: vi.fn(async () => undefined) };
    const { repo, service } = make(
      [org({ trialEndsAt: new Date('2026-10-28T00:00:00Z') }), org({ id: 'o2', trialEndsAt: new Date('2026-11-05T09:00:00Z') })],
      mailer,
    );
    const run = await service.runIfDue(NOW);
    expect(run).toEqual({ ran: true, statuses: 1, reminders: 1 });
    expect(repo.statuses).toEqual([{ organizationId: 'o1', from: 'TRIAL', to: 'READ_ONLY', reason: 'trial_ended' }]);
    expect(mailer.send).toHaveBeenCalledTimes(1);
    expect(repo.reminders).toHaveLength(1);
    expect(await service.runIfDue(new Date('2026-10-29T10:00:00Z'))).toEqual({ ran: false, statuses: 0, reminders: 0 });
  });

  it('почта не настроена или письмо не ушло: в журнал не пишем, завтра попробуем снова; статусы меняются', async () => {
    const failing = { send: vi.fn(async () => Promise.reject(new Error('сбой'))) };
    for (const mailer of [null, failing]) {
      const { repo, service } = make([org({ trialEndsAt: new Date('2026-11-05T09:00:00Z') }), org({ id: 'o2', trialEndsAt: new Date('2026-10-01T00:00:00Z') })], mailer);
      expect(await service.runIfDue(NOW)).toEqual({ ran: true, statuses: 1, reminders: 0 });
      expect(repo.reminders).toEqual([]);
    }
  });
});
