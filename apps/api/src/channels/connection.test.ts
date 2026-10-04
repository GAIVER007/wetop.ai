import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { channex } from '@pms/integrations';
import { ChannelConnectionService } from './connection';
import type { ChannelsRepository } from './channels.repository';

afterEach(() => vi.unstubAllEnvs());
function context(key = true) {
  vi.stubEnv('CHANNEX_PROPERTY_ID', '');
  vi.stubEnv('CHANNEX_API_BASE_URL', '');
  const repo = {
    mappings: vi.fn().mockResolvedValue([
      {
        providerPropertyId: 'test-property',
        providerRoomTypeId: 'room-a',
        providerRatePlanId: 'rate-a',
      },
    ]),
    lastEventAt: vi.fn().mockResolvedValue(null),
    lastAuditAt: vi.fn().mockResolvedValue(null),
  };
  const reader = {
    getProperty: vi
      .fn()
      .mockResolvedValue({ id: 'test-property', attributes: { title: 'Тестовый объект' } }),
  };
  const service = new ChannelConnectionService(
    repo as unknown as ChannelsRepository,
    key ? reader : null,
  );
  return { service, repo, reader };
}
describe('Channex read-only connection check', () => {
  it('does not claim a connection without credentials', async () => {
    const c = context(false);
    const r = await c.service.status();
    expect(r.state).toBe('NO_KEY');
    expect(r.propertyAccessible).toBe(false);
    expect(c.reader.getProperty).not.toHaveBeenCalled();
  });
  it('requires a mapped property and never creates one during a read', async () => {
    const c = context();
    c.repo.mappings.mockResolvedValue([]);
    expect((await c.service.status()).state).toBe('NO_MAPPING');
    expect(c.reader.getProperty).not.toHaveBeenCalled();
  });
  it('checks the mapped property and returns only operational fields', async () => {
    const c = context();
    const r = await c.service.status();
    expect(c.reader.getProperty).toHaveBeenCalledWith('test-property');
    expect(r).toMatchObject({
      state: 'READY',
      environment: 'staging',
      propertyAccessible: true,
      mappedCategories: 1,
      mappedRatePlans: 1,
    });
    expect(r).not.toHaveProperty('attributes');
  });
  it('«Последний импорт» — последнее событие, пришедшее опросом ленты (CHANNEX_PULL в журнале никто не пишет)', async () => {
    const c = context();
    const pulled = new Date('2026-09-14T08:05:00Z');
    c.repo.lastEventAt.mockImplementation(async (_p: string, via: string) =>
      via === 'PULL' ? pulled : null,
    );
    const r = await c.service.status();
    expect(r.lastPullAt).toBe('2026-09-14T08:05:00.000Z');
  });
  it('legacy configured property does not block another mapped branch', async () => {
    const c = context();
    vi.stubEnv('CHANNEX_PROPERTY_ID', 'different-property');
    expect((await c.service.status()).state).toBe('READY');
    expect(c.reader.getProperty).toHaveBeenCalledWith('test-property');
  });
  it.each([
    [401, 'DENIED'],
    [403, 'DENIED'],
    [404, 'NOT_FOUND'],
    [429, 'RATE_LIMITED'],
    [503, 'UNREACHABLE'],
  ])('provider HTTP %s is %s, never connected', async (status, state) => {
    const c = context();
    c.reader.getProperty.mockRejectedValue(
      new channex.ChannexApiError(
        'provider error details must stay private',
        Number(status),
        '/properties/test-property',
      ),
    );
    const r = await c.service.status();
    expect(r.state).toBe(state);
    expect(r.propertyAccessible).toBe(false);
    expect(JSON.stringify(r)).not.toContain('provider error details');
  });
});
