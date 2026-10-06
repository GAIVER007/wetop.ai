import { describe, expect, it } from 'vitest';
import type { ChannelsRepository, ChannexGateway } from './channels.repository';
import type { InboundBookingsService } from './inbound.service';
import {
  PROBE_EVERY_MS,
  REGISTRATION_EVERY_MS,
  WebhookHealthService,
} from './webhook-health.service';
import { ChannexSyncService, WEBHOOK_PATH } from './sync.service';
import { currentIntegrationPropertyId } from '../auth/request-context';

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
  /** Постоянный адрес PMS из PUBLIC_API_URL (webhookStatus.expectedUrl); нет — не задан */
  expectedUrl?: string | null;
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
      return {
        registered: opts.callbackUrl !== null,
        callbackUrl: opts.callbackUrl,
        expectedUrl: opts.expectedUrl ?? null,
      };
    },
  } as unknown as ConstructorParameters<typeof WebhookHealthService>[2];
  const probed: string[] = [];
  const probe = async (url: string) => {
    probed.push(url);
    return opts.reachable;
  };
  const svc = new WebhookHealthService(repo, inbound, sync, probe);
  svc.retryDelayMs = 0;
  return { svc, pulls, probed, statusCalls, opts };
}

describe('WebhookHealthService', () => {
  it('checks and reports each mapped branch independently', async () => {
    const pulls: string[] = [];
    const repo = {
      async connectedProperties() {
        return [
          { localPropertyId: 'branch-a', providerPropertyId: 'external-a' },
          { localPropertyId: 'branch-b', providerPropertyId: 'external-b' },
        ];
      },
      async lastEventAt(_provider: string, via: string) {
        const branch = currentIntegrationPropertyId();
        if (via === 'WEBHOOK') return utc('2026-09-11T10:00:00Z');
        return branch === 'branch-a' ? utc('2026-09-11T13:57:28Z') : null;
      },
    } as unknown as ChannelsRepository;
    const inbound = {
      async pull() {
        pulls.push(currentIntegrationPropertyId() ?? 'missing');
        return { received: 0, outcomes: [], acknowledged: 0 };
      },
    } as unknown as InboundBookingsService;
    const svc = new WebhookHealthService(repo, inbound);
    await svc.tickConnectedProperties(utc('2026-09-11T14:00:00Z'));
    expect(pulls).toEqual(['branch-a']);
    expect(svc.snapshot('branch-a').webhookSuspect).toBe(true);
    expect(svc.snapshot('branch-b').webhookSuspect).toBe(false);
  });
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
    // две неудачи подряд: после первой сторож переспрашивает, а не объявляет адрес мёртвым
    expect(probed).toEqual([
      'https://tunnel.example/channels/channex/webhook',
      'https://tunnel.example/channels/channex/webhook',
    ]);
    expect(pulls).toHaveLength(1);
    const s = svc.snapshot();
    expect(s.callbackReachable).toBe(false);
    expect(s.callbackProbedUrl).toBe('https://tunnel.example/channels/channex/webhook');
    expect(s.callbackCheckedAt).toBe('2026-09-13T09:00:00.000Z');
  });

  it('единичный пропуск пробы — не неисправность: повторная проба ответила, подозрения нет', async () => {
    const { svc, probed, opts } = makeWithProbe({
      webhook: utc('2026-09-13T07:18:00Z'),
      pullBooking: null,
      callbackUrl: 'https://tunnel.example/channels/channex/webhook',
      reachable: false,
    });
    // первая проба не отвечает, вторая — отвечает (20–21.09.2026: так выглядели все шесть «отказов» за день)
    let calls = 0;
    (svc as unknown as { probe: (url: string) => Promise<boolean> }).probe = async () => {
      probed.push('x');
      return ++calls > 1 ? true : opts.reachable;
    };
    const h = await svc.tick(utc('2026-09-13T09:00:00Z'));
    expect(h.suspect).toBe(false);
    expect(probed).toHaveLength(2);
    expect(svc.snapshot().callbackReachable).toBe(true);
  });

  it('Д4: в Channex стоит не постоянный адрес PMS — подозрение, даже если тот адрес отвечает', async () => {
    const { svc, pulls } = makeWithProbe({
      webhook: utc('2026-09-13T07:18:00Z'),
      pullBooking: null,
      callbackUrl: 'https://old-quick.trycloudflare.com/channels/channex/webhook',
      expectedUrl: 'https://api.wetop.ai/channels/channex/webhook',
      reachable: true,
    });
    const h = await svc.tick(utc('2026-09-13T09:00:00Z'));
    expect(h.suspect).toBe(true);
    expect(pulls).toHaveLength(1);
    const s = svc.snapshot();
    expect(s.callbackReachable).toBe(false);
    expect(s.callbackExpectedUrl).toBe('https://api.wetop.ai/channels/channex/webhook');
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

/**
 * Письмо Channex 03.10.2026: «You don't need to pull webhooks on a constant basis». Настоящий ChannexSyncService и
 * поддельный Channex, который считает запросы списка webhook: за сутки сторож спрашивает Channex один раз, а наш
 * собственный адрес проверяет каждые пять минут, как раньше.
 */
describe('WebhookHealthService: Channex о webhook спрашивается раз в сутки', () => {
  const PERMANENT = 'https://api.wetop.test';
  const quietRepo = {
    async lastEventAt() {
      return null;
    },
    mappings: async () => [{ providerPropertyId: 'prop-1' }],
  } as unknown as ChannelsRepository;
  const inbound = {
    async pull() {
      return { received: 0, outcomes: [], acknowledged: 0 };
    },
  } as unknown as InboundBookingsService;

  function setup(gatewayFails = false) {
    process.env.PUBLIC_API_URL = PERMANENT;
    let lists = 0;
    const gateway = {
      listWebhooks: async () => {
        lists += 1;
        if (gatewayFails) throw new Error('Channex 502');
        return [
          {
            id: 'wh-1',
            type: 'webhook',
            attributes: {
              callback_url: `${PERMANENT}${WEBHOOK_PATH}`,
              event_mask: 'booking',
              is_active: true,
              send_data: true,
            },
            relationships: { property: { data: { id: 'prop-1', type: 'property' } } },
          },
        ];
      },
    } as unknown as ChannexGateway;
    const sync = new ChannexSyncService(gateway, quietRepo);
    const probed: string[] = [];
    const svc = new WebhookHealthService(quietRepo, inbound, sync, async (url) => {
      probed.push(url);
      return true;
    });
    svc.retryDelayMs = 0;
    return { svc, probed, lists: () => lists };
  }

  it('сутки тиков раз в минуту: один запрос списка webhook, проба своего адреса каждые 5 минут', async () => {
    const { svc, probed, lists } = setup();
    const t0 = Date.parse('2026-10-03T10:00:00Z');
    for (let m = 0; m < 24 * 60; m += 1) await svc.tick(new Date(t0 + m * 60_000));
    expect(lists()).toBe(1);
    expect(probed).toHaveLength((24 * 60 * 60_000) / PROBE_EVERY_MS);
    expect(new Set(probed)).toEqual(new Set([`${PERMANENT}${WEBHOOK_PATH}`]));
    await svc.tick(new Date(t0 + REGISTRATION_EVERY_MS));
    expect(lists()).toBe(2);
  });

  it('Channex не ответил: повтор не на каждом тике, а со следующей пробой через 5 минут', async () => {
    const { svc, probed, lists } = setup(true);
    const t0 = Date.parse('2026-10-03T10:00:00Z');
    for (let m = 0; m < 10; m += 1) await svc.tick(new Date(t0 + m * 60_000));
    expect(lists()).toBe(2);
    expect(probed).toEqual([]);
    expect(svc.snapshot().callbackReachable).toBeNull();
  });
});
