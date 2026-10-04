import { describe, expect, it } from 'vitest';
import type { ChannelsRepository, ChannexGateway } from './channels.repository';
import { ChannexSyncService } from './sync.service';

describe('webhook registration cache per branch', () => {
  it('never returns another branch registration from the daily cache', async () => {
    let selected = 'property-a';
    let calls = 0;
    const repo = {
      mappings: async () => [{ providerPropertyId: selected }],
    } as unknown as ChannelsRepository;
    const gateway = {
      listWebhooks: async () => {
        calls++;
        return ['property-a', 'property-b'].map((id) => ({
          id: `webhook-${id}`,
          type: 'webhook',
          attributes: {
            callback_url: `https://${id}.test/webhook`,
            event_mask: 'booking',
            is_active: true,
            send_data: true,
          },
          relationships: { property: { data: { id, type: 'property' } } },
        }));
      },
    } as unknown as ChannexGateway;
    const sync = new ChannexSyncService(gateway, repo);
    const options = { maxAgeMs: 86400000, now: new Date('2026-10-04T10:00:00Z') };
    expect((await sync.webhookStatus(options)).id).toBe('webhook-property-a');
    selected = 'property-b';
    expect((await sync.webhookStatus(options)).id).toBe('webhook-property-b');
    selected = 'property-a';
    expect((await sync.webhookStatus(options)).id).toBe('webhook-property-a');
    expect(calls).toBe(2);
  });
});
