import { describe, expect, it } from 'vitest';
import type { ChannelsRepository } from './channels.repository';
import type { InboundBookingsService } from './inbound.service';
import { WebhookHealthService } from './webhook-health.service';

const utc = (s: string) => new Date(s);
function make(events: { webhook: Date | null; pullBooking: Date | null }) {
  const pulls: number[] = [];
  const repo = {
    async lastEventAt(_p: string, via: 'WEBHOOK' | 'PULL' | 'MANUAL', typePrefix?: string) {
      if (via === 'WEBHOOK') return events.webhook;
      if (via === 'PULL' && typePrefix === 'booking') return events.pullBooking;
      return null;
    },
  } as unknown as ChannelsRepository;
  const inbound = {
    async pull() {
      pulls.push(Date.now());
      return { received: 0, outcomes: [], acknowledged: 0 };
    },
  } as unknown as InboundBookingsService;
  return { svc: new WebhookHealthService(repo, inbound), pulls, events };
}

/** Сторож с проверкой зарегистрированного адреса: поддельный Channex и поддельная проба. */
function makeWithProbe(opts: {
  webhook: Date | null;
  pullBooking: Date | null;
  callbackUrl: string | null;
  reachable: boolean;
}) {
  const pulls: number[] = [];
  const repo = {
    async lastEventAt(_p: string, via: 'WEBHOOK' | 'PULL' | 'MANUAL', typePrefix?: string) {
      if (via === 'WEBHOOK') return opts.webhook;
      if (via === 'PULL' && typePrefix === 'booking') return opts.pullBooking;
      return null;
    },
  } as unknown as ChannelsRepository;
  const inbound = {
    async pull() {
      pulls.push(Date.now());
      return { received: 0, outcomes: [], acknowledged: 0 };
    },
  } as unknown as InboundBookingsService;
  const statusCalls: number[] = [];
  const sync = {
    async webhookStatus() {
      statusCalls.push(Date.now());
      return { registered: opts.callbackUrl !== null, callbackUrl: opts.callbackUrl };
    },
  } as unknown as ConstructorParameters<typeof WebhookHealthService>[2];
  const probed: string[] = [];
  const probe = async (url: string) => {
    probed.push(url);
    return opts.reachable;
  };
  return {
    svc: new WebhookHealthService(repo, inbound, sync, probe),
    pulls,
    probed,
    statusCalls,
    opts,
  };
}

describe('WebhookHealthService', () => {
  it('спокойствие: бронь опросом не приходила — ленту сверх расписания не дёргаем', async () => {
    const { svc, pulls } = make({ webhook: utc('2026-09-11T10:11:00Z'), pullBooking: null });
    const h = await svc.tick(utc('2026-09-11T12:00:00Z'));
    expect(h.suspect).toBe(false);
    expect(pulls).toHaveLength(0);
    expect(svc.snapshot().webhookSuspect).toBe(false);
  });
  it('бронь пришла опросом, webhook молчал — подозрение, опрос ленты сразу и на каждом тике', async () => {
    const { svc, pulls } = make({
      webhook: utc('2026-09-11T10:11:00Z'),
      pullBooking: utc('2026-09-11T13:57:28Z'),
    });
    const h1 = await svc.tick(utc('2026-09-11T14:00:00Z'));
    expect(h1.suspect).toBe(true);
    expect(pulls).toHaveLength(1);
    await svc.tick(utc('2026-09-11T14:01:00Z'));
    expect(pulls).toHaveLength(2);
    const s = svc.snapshot();
    expect(s.webhookSuspect).toBe(true);
    expect(s.suspectSince).toBe('2026-09-11T13:57:28.000Z');
    expect(s.lastWebhookAt).toBe('2026-09-11T10:11:00.000Z');
  });
  it('webhook доставил событие после начала подозрения — подозрение снято, частый опрос прекращён', async () => {
    const st = make({
      webhook: utc('2026-09-11T10:11:00Z'),
      pullBooking: utc('2026-09-11T13:57:28Z'),
    });
    await st.svc.tick(utc('2026-09-11T14:00:00Z'));
    st.events.webhook = utc('2026-09-11T14:22:32Z');
    const h = await st.svc.tick(utc('2026-09-11T14:23:00Z'));
    expect(h.suspect).toBe(false);
    expect(st.pulls).toHaveLength(1);
  });
});

describe('WebhookHealthService — проба зарегистрированного адреса', () => {
  it('адрес не отвечает — подозрение и опрос ленты, хотя броней опросом не было', async () => {
    const { svc, pulls, probed } = makeWithProbe({
      webhook: utc('2026-09-13T07:18:00Z'),
      pullBooking: null,
      callbackUrl: 'https://tunnel.example/channels/channex/webhook',
      reachable: false,
    });
    const h = await svc.tick(utc('2026-09-13T09:00:00Z'));
    expect(h.suspect).toBe(true);
    expect(h.kind).toBe('unreachable');
    expect(probed).toEqual(['https://tunnel.example/channels/channex/webhook']);
    expect(pulls).toHaveLength(1);
    const s = svc.snapshot();
    expect(s.callbackReachable).toBe(false);
    expect(s.callbackProbedUrl).toBe('https://tunnel.example/channels/channex/webhook');
    expect(s.callbackCheckedAt).toBe('2026-09-13T09:00:00.000Z');
  });

  it('адрес отвечает — тишина', async () => {
    const { svc, pulls } = makeWithProbe({
      webhook: utc('2026-09-13T07:18:00Z'),
      pullBooking: null,
      callbackUrl: 'https://tunnel.example/channels/channex/webhook',
      reachable: true,
    });
    const h = await svc.tick(utc('2026-09-13T09:00:00Z'));
    expect(h.suspect).toBe(false);
    expect(pulls).toHaveLength(0);
    expect(svc.snapshot().callbackReachable).toBe(true);
  });

  it('адрес дёргается не чаще раза в интервал', async () => {
    const { svc, probed, statusCalls } = makeWithProbe({
      webhook: utc('2026-09-13T07:18:00Z'),
      pullBooking: null,
      callbackUrl: 'https://tunnel.example/channels/channex/webhook',
      reachable: true,
    });
    await svc.tick(utc('2026-09-13T09:00:00Z'));
    await svc.tick(utc('2026-09-13T09:01:00Z'));
    await svc.tick(utc('2026-09-13T09:02:00Z'));
    expect(probed).toHaveLength(1);
    expect(statusCalls).toHaveLength(1);
    await svc.tick(utc('2026-09-13T09:06:00Z'));
    expect(probed).toHaveLength(2);
  });

  it('webhook не зарегистрирован — пробовать нечего, подозрения нет', async () => {
    const { svc, probed } = makeWithProbe({
      webhook: null,
      pullBooking: null,
      callbackUrl: null,
      reachable: false,
    });
    const h = await svc.tick(utc('2026-09-13T09:00:00Z'));
    expect(h.suspect).toBe(false);
    expect(probed).toHaveLength(0);
    expect(svc.snapshot().callbackReachable).toBeNull();
  });

  it('Channex не ответил на запрос статуса — сторож не падает и подозрения не выдумывает', async () => {
    const { svc } = makeWithProbe({
      webhook: utc('2026-09-13T07:18:00Z'),
      pullBooking: null,
      callbackUrl: 'https://tunnel.example/channels/channex/webhook',
      reachable: true,
    });
    const broken = new WebhookHealthService(
      {
        async lastEventAt() {
          return null;
        },
      } as unknown as ChannelsRepository,
      {
        async pull() {
          return { received: 0, outcomes: [], acknowledged: 0 };
        },
      } as unknown as InboundBookingsService,
      {
        async webhookStatus() {
          throw new Error('Channex 502');
        },
      } as unknown as ConstructorParameters<typeof WebhookHealthService>[2],
      async () => true,
    );
    const h = await broken.tick(utc('2026-09-13T09:00:00Z'));
    expect(h.suspect).toBe(false);
    expect(broken.snapshot().callbackReachable).toBeNull();
    expect(svc).toBeDefined();
  });
});
