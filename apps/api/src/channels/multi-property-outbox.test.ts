import { afterEach, expect, it, vi } from 'vitest';
import { currentIntegrationPropertyId } from '../auth/request-context';
import { OutboxWorker } from './outbox.worker';

const oldStop = process.env.CHANNEX_ARI;
afterEach(() => {
  if (oldStop === undefined) delete process.env.CHANNEX_ARI;
  else process.env.CHANNEX_ARI = oldStop;
});

it('a busy first branch does not starve another branch under shared endpoint throttling', async () => {
  process.env.CHANNEX_ARI = 'on';
  const sent: string[] = [];
  const repo = {
    connectedProperties: async () => [
      { localPropertyId: 'branch-a', providerPropertyId: 'provider-a' },
      { localPropertyId: 'branch-b', providerPropertyId: 'provider-b' },
    ],
    pendingOutbox: async (_provider: string, kind: string) => kind === 'AVAILABILITY'
      ? [{ id: currentIntegrationPropertyId(), payload: [] }] : [],
    markOutboxSent: vi.fn(),
    markOutboxFailed: vi.fn(),
    audit: vi.fn(),
  };
  const gateway = {
    updateAvailability: async () => {
      sent.push(currentIntegrationPropertyId()!);
      return { data: [], meta: {} };
    },
  };
  const worker = new OutboxWorker(gateway as never, repo as never);
  let now = 10_000;
  worker.now = () => now;
  await worker['flushConnectedProperties']();
  now += 5_000;
  await worker['flushConnectedProperties']();
  now += 5_000;
  await worker['flushConnectedProperties']();
  expect(sent).toEqual(['branch-a', 'branch-b']);
});
