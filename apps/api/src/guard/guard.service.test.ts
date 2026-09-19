import { describe, expect, it } from 'vitest';
import { POLICY, type Observation } from '@pms/domain';
import type { IncidentRow, IncidentsRepository, ResolvedBy } from './incidents.repository';
import type {
  AlertNotifier,
  FixOutcome,
  GuardFixes,
  GuardProbes,
  OutboxSignal,
  StaySignal,
  WebhookSignal,
} from './guard.ports';
import { GuardService } from './guard.service';

/**
 * Сторож системы целиком на подделках (ADR-028, план среза 11 §5): наблюдение → запись → починка техники →
 * закрытие; данные — к человеку без починки; упавшая проверка ничего не закрывает; будильник по правилам.
 */
const NIGHT = new Date('2026-09-13T21:00:00Z'); // 03:00 Алматы
const plus = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

class MemoryIncidents implements IncidentsRepository {
  rows: IncidentRow[] = [];
  private n = 0;
  async open() {
    return this.rows.filter((r) => r.status !== 'RESOLVED').map((r) => ({ ...r }));
  }
  async record(o: Observation & { fingerprint: string }, now: Date) {
    const cur = this.rows.find((r) => r.fingerprint === o.fingerprint && r.status !== 'RESOLVED');
    if (cur) {
      cur.occurrences += 1;
      cur.lastSeenAt = now;
      cur.title = o.title;
      cur.severity = o.severity ?? POLICY[o.kind].severity;
      return { ...cur };
    }
    const row: IncidentRow = {
      id: `i-${++this.n}`,
      kind: o.kind,
      class: POLICY[o.kind].class,
      severity: o.severity ?? POLICY[o.kind].severity,
      fingerprint: o.fingerprint,
      status: 'OPEN',
      title: o.title,
      subjectType: o.subjectType ?? null,
      subjectId: o.subjectId ?? null,
      details: o.details ?? null,
      occurrences: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      fixAttempts: 0,
      lastFixAt: null,
      lastFixResult: null,
      alertedAt: null,
      acknowledgedAt: null,
      resolvedAt: null,
      resolvedBy: null,
    };
    this.rows.push(row);
    return { ...row };
  }
  async resolve(ids: string[], by: ResolvedBy, now: Date) {
    let n = 0;
    for (const r of this.rows)
      if (ids.includes(r.id) && r.status !== 'RESOLVED') {
        Object.assign(r, { status: 'RESOLVED', resolvedAt: now, resolvedBy: by });
        n++;
      }
    return n;
  }
  async markFixAttempt(id: string, result: string, now: Date) {
    const r = this.rows.find((x) => x.id === id)!;
    Object.assign(r, {
      status: 'FIXING',
      fixAttempts: r.fixAttempts + 1,
      lastFixAt: now,
      lastFixResult: result,
    });
  }
  async escalate(id: string, reason: string | null) {
    const r = this.rows.find((x) => x.id === id)!;
    if (r.status === 'OPEN' || r.status === 'FIXING')
      Object.assign(r, { status: 'ESCALATED', ...(reason ? { lastFixResult: reason } : {}) });
  }
  async markAlerted(ids: string[], now: Date) {
    for (const r of this.rows) if (ids.includes(r.id)) r.alertedAt = now;
  }
  async acknowledge(id: string, now: Date) {
    const r = this.rows.find((x) => x.id === id) ?? null;
    if (r) Object.assign(r, { status: 'ACKNOWLEDGED', acknowledgedAt: now });
    return r;
  }
  async get(id: string) {
    return this.rows.find((x) => x.id === id) ?? null;
  }
  async list() {
    return this.rows;
  }
  async purgeResolvedBefore() {
    return 0;
  }
}

const QUIET_WEBHOOK: WebhookSignal = {
  checkedAt: NIGHT.toISOString(),
  suspect: false,
  suspectSince: null,
  suspectReason: null,
  callbackUrl: 'https://pms.example/channels/channex/webhook',
  callbackReachable: true,
  callbackCheckedAt: NIGHT.toISOString(),
  callbackExpectedUrl: 'https://pms.example/channels/channex/webhook',
};
const NO_STAYS: StaySignal = {
  units: [],
  blocks: [],
  items: [],
  unassigned: [],
  categoryNames: {},
};

function setup(
  over: Partial<{
    outbox: OutboxSignal;
    webhook: WebhookSignal;
    stays: StaySignal;
    notifier: boolean;
    events: Awaited<ReturnType<GuardProbes['failedEvents']>>;
    enabled: GuardProbes['enabled'];
  }> = {},
) {
  const state = {
    outbox: over.outbox ?? {
      lastFullSyncAt: plus(NIGHT, -60),
      failedSinceSync: 0,
      lastFailedError: null,
      oldestPendingAt: null,
      lostDeltaAt: null,
    },
    webhook: over.webhook ?? QUIET_WEBHOOK,
    stays: over.stays ?? NO_STAYS,
    events: over.events ?? [],
    dbDown: false,
    outboxThrows: false,
    pullOkAt: plus(NIGHT, -2),
    webOk: true,
    exelySyncAt: plus(NIGHT, -60) as Date | null,
    avail: null as {
      pms: Map<string, Map<string, number>>;
      channel: Map<string, Map<string, number>>;
    } | null,
  };
  const probes: GuardProbes = {
    channexEnabled: () => true,
    enabled: over.enabled ?? (() => true),
    dbPing: async () => {
      if (state.dbDown) throw new Error("P1001: Can't reach database server");
    },
    webhook: () => state.webhook,
    pullHealth: () => ({
      startedAt: plus(NIGHT, -120),
      okAt: state.pullOkAt,
      failedAt: null,
      error: null,
    }),
    outbox: async () => {
      if (state.outboxThrows) throw new Error('Channex недоступен');
      return state.outbox;
    },
    failedEvents: async () => state.events,
    stays: async () => state.stays,
    reports: () => [],
    failingSuites: () => [],
    webHealth: async () => ({ ok: state.webOk, error: state.webOk ? null : 'timeout 10 s' }),
    lastExelySyncAt: async () => state.exelySyncAt,
    channelAvailability: async () => state.avail,
  };
  const calls: string[] = [];
  const ok = (text: string): FixOutcome => ({ ok: true, text });
  const fixes: GuardFixes = {
    pull: async () => (calls.push('pull'), ok('опрос')),
    flushOutbox: async () => (calls.push('flush'), ok('очередь')),
    fullSync: async () => {
      calls.push('fullSync');
      state.outbox = { ...state.outbox, failedSinceSync: 0, lastFullSyncAt: NIGHT };
      return ok('полная выгрузка: задачи t1, t2');
    },
    retryEvent: async (id) => (calls.push(`retry:${id}`), { ok: false, text: 'HTTP 503' }),
    restartWeb: async () => {
      calls.push('restartWeb');
      state.webOk = true;
      return ok('стойка перезапущена');
    },
    registerWebhook: async () => {
      calls.push('registerWebhook');
      state.webhook = QUIET_WEBHOOK;
      return ok('webhook возвращён на https://pms.example/channels/channex/webhook');
    },
  };
  const sent: string[] = [];
  const notifier: AlertNotifier = {
    configured: over.notifier ?? true,
    recipients: 1,
    send: async (text) => (sent.push(text), { delivered: 1, failed: [] }),
  };
  const beats: unknown[] = [];
  const heartbeat = {
    configured: true,
    fail: false,
    send: async (b: unknown) => {
      if (heartbeat.fail) throw new Error('сервер сторожа недоступен');
      beats.push(b);
    },
  };
  const repo = new MemoryIncidents();
  const guard = new GuardService(repo, probes, fixes, notifier, heartbeat);
  return { guard, repo, state, calls, sent, beats, heartbeat };
}

describe('GuardService.tick', () => {
  it('упавшая отправка ARI: запись → полная выгрузка → на следующем проходе закрыта сторожем', async () => {
    const t = setup({
      outbox: {
        lastFullSyncAt: plus(NIGHT, -600),
        failedSinceSync: 3,
        lastFailedError: 'Channex POST /availability: HTTP 503',
        oldestPendingAt: null,
        lostDeltaAt: null,
      },
    });
    const first = await t.guard.tick(NIGHT);
    expect(t.calls).toEqual(['fullSync']);
    expect(first.fixes).toEqual([
      { kind: 'outbox.failed', subjectId: null, ok: true, text: 'полная выгрузка: задачи t1, t2' },
    ]);
    expect(t.repo.rows[0]).toMatchObject({
      kind: 'outbox.failed',
      status: 'FIXING',
      fixAttempts: 1,
    });
    await t.guard.tick(plus(NIGHT, 1));
    expect(t.repo.rows[0]).toMatchObject({ status: 'RESOLVED', resolvedBy: 'GUARD' });
    expect(t.sent).toEqual([]);
  });

  /*
   * Дельта остатков не встала в очередь (Б6, план wetop-domain §«Хвосты»). Команда записана, очередь пуста,
   * поэтому ни «упавшая отправка», ни «застряла очередь» этого не видят: канал продолжает продавать по старому
   * остатку до ночной полной выгрузки. Починка та же, что у упавшей отправки, — полная выгрузка: повторять
   * потерянную дельту нечем, её содержимое нигде не сохранено.
   */
  it('дельта не встала в очередь после записи: полная выгрузка, после неё закрыта', async () => {
    const t = setup({
      outbox: {
        lastFullSyncAt: plus(NIGHT, -600),
        failedSinceSync: 0,
        lastFailedError: null,
        oldestPendingAt: null,
        lostDeltaAt: plus(NIGHT, -5),
      },
    });
    const first = await t.guard.tick(NIGHT);
    expect(t.repo.rows[0]).toMatchObject({ kind: 'ari.delta.lost', status: 'FIXING' });
    expect(t.calls).toEqual(['fullSync']);
    expect(first.fixes[0]).toMatchObject({ kind: 'ari.delta.lost', ok: true });
  });

  it('потерянная дельта старше последней полной выгрузки — выгрузка её уже перекрыла, неисправности нет', async () => {
    const t = setup({
      outbox: {
        lastFullSyncAt: plus(NIGHT, -60),
        failedSinceSync: 0,
        lastFailedError: null,
        oldestPendingAt: null,
        lostDeltaAt: plus(NIGHT, -600),
      },
    });
    await t.guard.tick(NIGHT);
    expect(t.repo.rows.filter((r) => r.kind === 'ari.delta.lost')).toEqual([]);
    expect(t.calls).toEqual([]);
  });

  it('проверка упала — её неисправность остаётся открытой, ошибка проверки видна в итоге прохода', async () => {
    const t = setup({
      outbox: {
        lastFullSyncAt: plus(NIGHT, -600),
        failedSinceSync: 1,
        lastFailedError: 'HTTP 503',
        oldestPendingAt: null,
        lostDeltaAt: null,
      },
    });
    t.guard.autofix = false;
    await t.guard.tick(NIGHT);
    t.state.outboxThrows = true;
    const s = await t.guard.tick(plus(NIGHT, 1));
    expect(s.checkErrors.map((e) => e.check)).toContain('channex.outbox');
    expect(t.repo.rows[0]!.status).not.toBe('RESOLVED');
  });

  it('бронь отклонена правилом: не повторять, сразу эскалировать и разбудить (CRITICAL ночью)', async () => {
    const t = setup({
      events: [
        {
          externalEventId: 'rev-9',
          type: 'booking_new',
          attempts: 6,
          receivedAt: NIGHT,
          lastError:
            'Бронь BDC-1: перенесённых из Exely броней с таким же составом несколько — PMS не выбирает сама (ADR-024)',
        },
      ],
    });
    await t.guard.tick(NIGHT);
    expect(t.calls).toEqual([]);
    expect(t.repo.rows[0]).toMatchObject({
      kind: 'event.rejected',
      status: 'ESCALATED',
      subjectId: 'rev-9',
    });
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toContain('отклонена');
    expect(t.repo.rows[0]!.alertedAt).toEqual(NIGHT);
  });

  it('временная ошибка события — повтор, после исчерпания попыток — к человеку', async () => {
    const t = setup({
      events: [
        {
          externalEventId: 'rev-7',
          type: 'booking_new',
          attempts: 6,
          receivedAt: NIGHT,
          lastError: 'Channex GET /booking_revisions/rev-7: сеть — fetch failed',
        },
      ],
    });
    const every = POLICY['event.failed'].fix!;
    let now = NIGHT;
    for (let i = 0; i < every.maxAttempts; i++) {
      await t.guard.tick(now);
      now = new Date(now.getTime() + every.minIntervalMs);
    }
    // лента в подделке стоит на месте, и через 15 минут сторож законно зовёт опрос — считаем только повторы события
    const retries = () => t.calls.filter((c) => c.startsWith('retry:'));
    expect(retries()).toEqual(['retry:rev-7', 'retry:rev-7', 'retry:rev-7']);
    await t.guard.tick(now);
    expect(retries()).toHaveLength(3);
    expect(t.repo.rows.find((r) => r.kind === 'event.failed')).toMatchObject({
      status: 'ESCALATED',
      fixAttempts: 3,
    });
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toContain('ревизия rev-7');
  });

  it('лента не читается, а сторож webhook уже опрашивает её каждую минуту — второй опрос не запускать', async () => {
    const t = setup({
      webhook: {
        ...QUIET_WEBHOOK,
        suspect: true,
        suspectReason: 'адрес не отвечает',
        suspectSince: NIGHT.toISOString(),
      },
    });
    t.state.pullOkAt = plus(NIGHT, -30);
    const s = await t.guard.tick(NIGHT);
    expect(t.calls).not.toContain('pull');
    expect(s.fixes.find((f) => f.kind === 'feed.stale')?.text).toMatch(/уже опрашивает/);
    t.state.webhook = QUIET_WEBHOOK;
    await t.guard.tick(plus(NIGHT, 6));
    expect(t.calls).toContain('pull');
  });

  it('GUARD_AUTOFIX=off — ничего не чинит, эскалирует', async () => {
    const t = setup({
      outbox: {
        lastFullSyncAt: plus(NIGHT, -600),
        failedSinceSync: 2,
        lastFailedError: 'HTTP 503',
        oldestPendingAt: null,
        lostDeltaAt: null,
      },
    });
    t.guard.autofix = false;
    await t.guard.tick(NIGHT);
    expect(t.calls).toEqual([]);
    expect(t.repo.rows[0]!.status).toBe('ESCALATED');
  });

  it('овербукинг: к человеку без починки; пока объект на Exely — предупреждение, ночью не будит', async () => {
    const t = setup({
      stays: {
        units: [{ code: 'MALE', active: 1 }],
        blocks: [],
        items: [
          { accommodationTypeCode: 'MALE', arrivalDate: '2026-09-13', departureDate: '2026-09-15' },
          { accommodationTypeCode: 'MALE', arrivalDate: '2026-09-14', departureDate: '2026-09-15' },
        ],
        unassigned: [],
        categoryNames: { MALE: 'Общая мужская комната' },
      },
    });
    t.guard.propertyLive = false;
    await t.guard.tick(NIGHT); // 03:00 14.09 по Алматы
    expect(t.repo.rows).toHaveLength(1);
    expect(t.repo.rows[0]).toMatchObject({
      kind: 'stay.overbooked',
      severity: 'WARNING',
      status: 'ESCALATED',
      subjectId: 'MALE:2026-09-14',
    });
    expect(t.repo.rows[0]!.title).toContain('Общая мужская комната');
    expect(t.sent).toEqual([]);
    t.guard.propertyLive = true;
    await t.guard.tick(plus(NIGHT, 1));
    expect(t.repo.rows[0]!.severity).toBe('CRITICAL');
    expect(t.sent).toHaveLength(1);
  });

  /*
   * 15.09.2026: за один час webhook трижды уехал с постоянного адреса на одноразовые туннели Cloudflare
   * (чужой запуск scripts/ops/channex-tunnel.sh). Каждый такой туннель умирает через минуты, и брони идут
   * только опросом ленты. Адрес в Channex — техника класса А, и чинится она тем же путём, что кнопка
   * «Зарегистрировать webhook» на /channels.
   */
  it('в Channex чужой адрес вместо постоянного — сторож перерегистрирует webhook сам', async () => {
    const t = setup({
      webhook: {
        ...QUIET_WEBHOOK,
        suspect: true,
        suspectReason: 'зарегистрированный адрес webhook не отвечает',
        callbackUrl: 'https://one-off-tunnel.trycloudflare.test/channels/channex/webhook',
        callbackReachable: false,
      },
    });
    const s = await t.guard.tick(NIGHT);
    expect(t.calls).toContain('registerWebhook');
    expect(s.fixes.find((f) => f.kind === 'webhook.misrouted')?.ok).toBe(true);
  });

  it('зарегистрирован сам постоянный адрес, но молчит — перерегистрация не поможет, сторож не трогает', async () => {
    const t = setup({ webhook: { ...QUIET_WEBHOOK, callbackReachable: false } });
    await t.guard.tick(NIGHT);
    expect(t.calls).not.toContain('registerWebhook');
  });

  it('человек нажал «Принято» — CRITICAL больше не будит', async () => {
    const t = setup({ webhook: { ...QUIET_WEBHOOK, callbackReachable: false } });
    await t.guard.tick(NIGHT);
    await t.guard.tick(plus(NIGHT, 16)); // после 15 минут без починки — к человеку
    expect(t.sent).toHaveLength(1);
    await t.repo.acknowledge(t.repo.rows[0]!.id, plus(NIGHT, 17));
    await t.guard.tick(plus(NIGHT, 60));
    expect(t.sent).toHaveLength(1);
  });

  it('база легла: будит напрямую, не чаще раза в 30 минут; поднялась — остаётся запись в истории', async () => {
    const t = setup();
    t.state.dbDown = true;
    const s = await t.guard.tick(NIGHT);
    expect(s.dbOk).toBe(false);
    await t.guard.tick(plus(NIGHT, 5));
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toContain('база');
    await t.guard.tick(plus(NIGHT, 20));
    expect(t.sent).toHaveLength(1);
    await t.guard.tick(plus(NIGHT, 36));
    expect(t.sent).toHaveLength(2);
    t.state.dbDown = false;
    await t.guard.tick(plus(NIGHT, 40));
    expect(t.repo.rows[0]).toMatchObject({
      kind: 'db.down',
      status: 'RESOLVED',
      resolvedBy: 'GUARD',
    });
  });

  it('будильник не настроен — неисправности пишутся, сообщение не уходит, итог прохода это говорит', async () => {
    const t = setup({
      notifier: false,
      webhook: {
        ...QUIET_WEBHOOK,
        suspect: true,
        suspectReason: 'бронь пришла опросом',
        suspectSince: NIGHT.toISOString(),
      },
    });
    await t.guard.tick(NIGHT);
    const s = await t.guard.tick(plus(NIGHT, 16));
    expect(t.repo.rows[0]!.status).toBe('ESCALATED');
    expect(s.alerted).toBe(0);
    expect(s.alertError).toMatch(/не настроен/);
  });
});

describe('GuardService: стойка, синхронизация с Exely, остатки в канале', () => {
  const grid = (o: Record<string, Record<string, number>>) =>
    new Map(Object.entries(o).map(([k, v]) => [k, new Map(Object.entries(v))]));

  it('стойка не отвечает: 5 минут ждём (сборка после слияния бывает долгой), потом перезапуск; ответила — закрыта', async () => {
    const t = setup();
    t.state.webOk = false;
    await t.guard.tick(NIGHT);
    await t.guard.tick(plus(NIGHT, 4));
    expect(t.calls).not.toContain('restartWeb');
    await t.guard.tick(plus(NIGHT, 5));
    expect(t.calls).toContain('restartWeb');
    await t.guard.tick(plus(NIGHT, 6));
    expect(t.repo.rows.find((r) => r.kind === 'web.down')).toMatchObject({
      status: 'RESOLVED',
      resolvedBy: 'GUARD',
    });
  });

  it('синхронизации из Exely больше суток: к человеку, сам не импортирует; после переключения объекта проверка не нужна', async () => {
    const t = setup();
    t.state.exelySyncAt = plus(NIGHT, -30 * 60);
    t.guard.propertyLive = false;
    await t.guard.tick(NIGHT);
    const inc = t.repo.rows.find((r) => r.kind === 'exely.stale');
    expect(inc).toMatchObject({ status: 'ESCALATED', class: 'B' });
    expect(inc!.title).toContain('30 ч');
    expect(t.calls).toEqual([]);
    const live = setup();
    live.state.exelySyncAt = null;
    live.guard.propertyLive = true;
    const s = await live.guard.tick(NIGHT);
    expect(s.checked).not.toContain('exely.stale');
    expect(live.repo.rows).toEqual([]);
  });

  it('канал видит больше мест, чем есть: полная выгрузка и пересверка сразу, а не через час', async () => {
    const t = setup();
    t.state.avail = {
      pms: grid({ MALE: { '2026-09-14': 0 } }),
      channel: grid({ MALE: { '2026-09-14': 2 } }),
    };
    await t.guard.tick(NIGHT);
    expect(t.calls).toEqual(['fullSync']);
    const inc = t.repo.rows.find((r) => r.kind === 'ari.oversell')!;
    expect(inc.title).toContain('PMS 0, канал 2');
    t.state.avail = {
      pms: grid({ MALE: { '2026-09-14': 0 } }),
      channel: grid({ MALE: { '2026-09-14': 0 } }),
    };
    await t.guard.tick(plus(NIGHT, 1));
    expect(t.repo.rows.find((r) => r.kind === 'ari.oversell')).toMatchObject({
      status: 'RESOLVED',
      resolvedBy: 'GUARD',
    });
  });

  it('сверять не с чем (нет маппинга) — не ошибка проверки и не повод закрыть', async () => {
    const t = setup();
    const s = await t.guard.tick(NIGHT);
    expect(s.checked).not.toContain('ari.oversell');
    expect(s.checkErrors).toEqual([]);
  });
});

describe('GuardService: сигнал на сервер «сторож сторожа»', () => {
  it('раз в проход — только числа: открыто, срочных, ждут человека, не отработавших проверок', async () => {
    const t = setup({
      events: [
        {
          externalEventId: 'rev-9',
          type: 'booking_new',
          attempts: 6,
          receivedAt: NIGHT,
          lastError: 'PMS не выбирает сама (ADR-024)',
        },
      ],
    });
    await t.guard.tick(NIGHT);
    expect(t.beats).toEqual([
      { at: NIGHT.toISOString(), open: 1, critical: 1, escalated: 1, checksFailed: 0 },
    ]);
    expect(JSON.stringify(t.beats)).not.toContain('rev-9');
  });

  it('база легла — сигнал всё равно уходит и говорит «срочно»: сервер продублирует тревогу', async () => {
    const t = setup();
    t.state.dbDown = true;
    await t.guard.tick(NIGHT);
    expect(t.beats).toEqual([
      { at: NIGHT.toISOString(), open: 1, critical: 1, escalated: 1, checksFailed: 1 },
    ]);
  });

  it('сервер сторожа недоступен — проход не ломается, ошибка видна в итоге', async () => {
    const t = setup();
    t.heartbeat.fail = true;
    const s = await t.guard.tick(NIGHT);
    expect(s.heartbeatError).toMatch(/недоступен/);
  });
});

describe('GuardService: ложные тревоги 13.09.2026 (после слияния PR #1)', () => {
  it('статус webhook — не приём брони: его 500 не срочный; срочен только сам POST webhook и бронь с сайта', async () => {
    const t = setup();
    const err = new Error('TypeError: boom');
    await t.guard.recordApiError(
      { method: 'GET', route: '/channels/channex/webhook/status', status: 500, error: err },
      NIGHT,
    );
    await t.guard.recordApiError(
      { method: 'POST', route: '/channels/channex/webhook', status: 500, error: err },
      NIGHT,
    );
    expect(t.repo.rows.map((r) => [r.subjectId, r.severity])).toEqual([
      ['GET /channels/channex/webhook/status', 'WARNING'],
      ['POST /channels/channex/webhook', 'CRITICAL'],
    ]);
  });

  it('500 из-за обрыва связи с базой — не ошибка кода: дежурному агенту чинить нечего, база проверяется отдельно', async () => {
    const t = setup();
    const dbBlip = new Error(
      'Invalid `this.prisma.db.channelMapping.findMany()` invocation: Database error. Code: `08006`. Message: `(EAUTHTIMEOUT) timeout`',
    );
    await t.guard.recordApiError(
      { method: 'GET', route: '/channels/channex/mapping', status: 500, error: dbBlip },
      NIGHT,
    );
    expect(t.repo.rows).toEqual([]);
  });

  it('в сигнал на сервер идут только срочные, которые уже ждут человека; то, что сторож ещё чинит, сервер не дублирует', async () => {
    const t = setup({ webhook: { ...QUIET_WEBHOOK, callbackReachable: false } });
    await t.guard.tick(NIGHT);
    expect(t.beats.at(-1)).toMatchObject({ open: 1, critical: 0, escalated: 0 });
    // лента в подделке читается вовремя — иначе через 15 минут законно появилась бы ещё одна неисправность
    t.state.pullOkAt = plus(NIGHT, 15);
    await t.guard.tick(plus(NIGHT, 16));
    expect(t.beats.at(-1)).toMatchObject({ open: 1, critical: 1, escalated: 1 });
    await t.repo.acknowledge(t.repo.rows[0]!.id, plus(NIGHT, 17));
    t.state.pullOkAt = plus(NIGHT, 17);
    await t.guard.tick(plus(NIGHT, 18));
    expect(t.beats.at(-1)).toMatchObject({ critical: 0 });
  });
});

describe('GuardService.recordApiError', () => {
  it('500 от кода пишется одной неисправностью на маршрут, без тела запроса и секретов', async () => {
    const t = setup();
    const err = new Error(
      'Cannot read properties of undefined (reading "id") postgresql://app:pw-not-real@db.example.com/pms',
    );
    await t.guard.recordApiError(
      { method: 'POST', route: '/reservations/:number/check-in', status: 500, error: err },
      NIGHT,
    );
    await t.guard.recordApiError(
      { method: 'POST', route: '/reservations/:number/check-in', status: 500, error: err },
      plus(NIGHT, 1),
    );
    expect(t.repo.rows).toHaveLength(1);
    expect(t.repo.rows[0]).toMatchObject({
      kind: 'api.error',
      subjectId: 'POST /reservations/:number/check-in',
      occurrences: 2,
      severity: 'WARNING',
    });
  });

  it('ошибка на приёме брони (webhook, сайт) — срочная', async () => {
    const t = setup();
    await t.guard.recordApiError(
      { method: 'POST', route: '/w/book', status: 500, error: new Error('boom') },
      NIGHT,
    );
    expect(t.repo.rows[0]!.severity).toBe('CRITICAL');
  });
});

describe('GuardService при остановленном ARI (CHANNEX_ARI=off, план отката)', () => {
  it('упавшую отправку и выгрузку не «чинит»; стоящую очередь показывает с причиной и будит, но не отправляет', async () => {
    const t = setup({
      outbox: {
        lastFullSyncAt: plus(NIGHT, -30 * 60),
        failedSinceSync: 2,
        lastFailedError: 'Исходящий ARI остановлен',
        oldestPendingAt: plus(NIGHT, -20),
        lostDeltaAt: null,
      },
      enabled: (what) => what !== 'ariOut',
    });
    const s = await t.guard.tick(NIGHT);
    expect(t.calls).toEqual([]);
    expect(s.fixes).toEqual([]);
    expect(t.repo.rows.map((r) => r.kind)).toEqual(['outbox.stuck']);
    expect(t.repo.rows[0]).toMatchObject({ status: 'ESCALATED' });
    expect(t.repo.rows[0]!.title).toMatch(/CHANNEX_ARI=off/);
    expect(t.repo.rows[0]!.lastFixResult).toMatch(/ARI остановлен вручную/);
  });
});
