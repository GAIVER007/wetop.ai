import { describe, expect, it, vi } from 'vitest';
import { withIntegrationPropertyScope } from '../auth/request-context';
import { propertyRef } from '../database/property-ref';

const FIRST = '67646baa-d066-4977-8afc-67f48398842f';
const SECOND = 'c178f0a8-8290-494e-9332-301267730ac7';

describe('Channex service property scope', () => {
  it('selects the mapped property for each background job, even with duplicate names', async () => {
    const findUnique = vi.fn(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      name: 'Same hotel name',
      organizationId: where.id === FIRST ? 'org-1' : 'org-2',
      timezone: 'Asia/Almaty',
    }));
    const findFirst = vi.fn();
    const db = { property: { findUnique, findFirst } } as never;
    const [first, second] = await Promise.all([
      withIntegrationPropertyScope(FIRST, () => propertyRef(db, 'Same hotel name')),
      withIntegrationPropertyScope(SECOND, () => propertyRef(db, 'Same hotel name')),
    ]);
    expect(first.id).toBe(FIRST);
    expect(second.id).toBe(SECOND);
    expect(findFirst).not.toHaveBeenCalled();
  });
});
