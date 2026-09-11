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
