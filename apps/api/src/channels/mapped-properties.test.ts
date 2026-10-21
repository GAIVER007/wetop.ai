import { describe, expect, it, vi } from 'vitest';
import { mappedChannexProperties, localPropertyForChannex } from './mapped-properties';

describe('Channex property routing', () => {
  it('returns every connected local property without using its name', async () => {
    const db = { channelMapping: { findMany: vi.fn().mockResolvedValue([
      { propertyId: 'local-a', providerPropertyId: 'external-a' },
      { propertyId: 'local-b', providerPropertyId: 'external-b' },
    ]) } } as never;
    expect(await mappedChannexProperties(db)).toEqual([
      { localPropertyId: 'local-a', providerPropertyId: 'external-a' },
      { localPropertyId: 'local-b', providerPropertyId: 'external-b' },
    ]);
    expect(await localPropertyForChannex(db, 'external-b')).toBe('local-b');
    expect(await localPropertyForChannex(db, 'unknown')).toBeNull();
  });

  it('rejects a provider property mapped to two local properties', async () => {
    const db = { channelMapping: { findMany: vi.fn().mockResolvedValue([
      { propertyId: 'local-a', providerPropertyId: 'external-a' },
      { propertyId: 'local-b', providerPropertyId: 'external-a' },
    ]) } } as never;
    await expect(localPropertyForChannex(db, 'external-a')).rejects.toThrow('несколько');
  });
});
