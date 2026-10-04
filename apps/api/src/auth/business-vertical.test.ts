import { describe, expect, it } from 'vitest';
import { resolveBusinessVertical, assertBusinessCapability } from './business-vertical';

const db = (vertical: string, organizationId = 'own') => ({
  business: {
    findFirst: async ({ where }: { where: { organizationId: string; id: string } }) =>
      where.organizationId === organizationId && where.id === 'business' ? { vertical } : null,
  },
});

describe('verified Business capability boundary', () => {
  it.each(['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const)(
    'resolves %s from server data',
    async (vertical) => {
      expect(await resolveBusinessVertical(db(vertical) as never, 'own', 'business')).toBe(
        vertical,
      );
    },
  );
  it('rejects a foreign Business', async () => {
    await expect(
      resolveBusinessVertical(db('HOSPITALITY', 'foreign') as never, 'own', 'business'),
    ).rejects.toThrow();
  });
  it('rejects an unknown persisted enum rather than defaulting to Hospitality', async () => {
    await expect(
      resolveBusinessVertical(db('HOTEL') as never, 'own', 'business'),
    ).rejects.toThrow();
  });
  it.each(['BEAUTY', 'FOOD_SERVICE'] as const)(
    'denies %s even in a mixed organization',
    async (vertical) => {
      const actual = await resolveBusinessVertical(db(vertical) as never, 'own', 'business');
      expect(() => assertBusinessCapability(actual, 'hospitality.channels')).toThrow();
    },
  );
  it('allows the Hospitality capability without changing permission or trial', () => {
    expect(() => assertBusinessCapability('HOSPITALITY', 'hospitality.channels')).not.toThrow();
  });
});
