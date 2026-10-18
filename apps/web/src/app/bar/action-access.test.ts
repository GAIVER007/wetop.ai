import type { BeautyPermission } from '@pms/domain';
import { describe, expect, it } from 'vitest';
import { barActionAccess } from './action-access';

const permission = (
  section: BeautyPermission['section'],
  action: BeautyPermission['action'],
): BeautyPermission => ({ section, action, scope: 'BUSINESS' });

const assigned = (permissions: BeautyPermission[]) => ({
  access: {
    aiSeller: false,
    platform: false,
    role: 'MANAGER' as const,
    beautyAccess: { mode: 'ASSIGNED' as const, assigned: true, permissions },
  },
  readOnly: false,
});

describe('bar actions in a salon position', () => {
  it('does not inherit broad manager writes and keeps stock actions separate', () => {
    expect(barActionAccess(assigned([]), 'BEAUTY')).toMatchObject({
      createStock: false,
      updateStock: false,
      deleteStock: false,
      createFinance: false,
      refundFinance: false,
    });
    expect(barActionAccess(assigned([permission('stock', 'create')]), 'BEAUTY')).toMatchObject({
      createStock: true,
      updateStock: false,
      deleteStock: false,
    });
  });

  it('requires explicit finance rights for sales, supplier payments and refunds', () => {
    expect(barActionAccess(assigned([permission('finance', 'create')]), 'BEAUTY')).toMatchObject({
      createFinance: true,
      refundFinance: false,
    });
    expect(barActionAccess(assigned([permission('finance', 'refund')]), 'BEAUTY')).toMatchObject({
      createFinance: false,
      refundFinance: true,
    });
  });

  it('preserves legacy rights outside Beauty and subscription read-only', () => {
    const legacy = {
      access: { aiSeller: false, platform: false, role: 'MANAGER' as const },
      readOnly: false,
    };
    expect(barActionAccess(legacy, 'FOOD_SERVICE')).toMatchObject({
      createStock: true,
      updateStock: true,
      deleteStock: true,
      createFinance: true,
      refundFinance: true,
    });
    expect(barActionAccess({ ...legacy, readOnly: true }, 'FOOD_SERVICE')).toMatchObject({
      createStock: false,
      updateStock: false,
      deleteStock: false,
      createFinance: false,
      refundFinance: false,
    });
  });

  it('preserves the old Food split between shift and catalog actions', () => {
    const staff = {
      access: { aiSeller: false, platform: false, role: 'STAFF' as const },
      readOnly: false,
    };
    expect(barActionAccess(staff, 'FOOD_SERVICE')).toMatchObject({
      createCatalog: false,
      receiveStock: true,
      updateCatalog: false,
      operateStock: true,
      archiveCatalog: false,
    });
  });

  it('requires stock.create plus finance.create to sell in Beauty', () => {
    expect(barActionAccess(assigned([permission('stock', 'create')]), 'BEAUTY').sell).toBe(false);
    expect(barActionAccess(assigned([permission('finance', 'create')]), 'BEAUTY').sell).toBe(false);
    expect(barActionAccess(assigned([
      permission('stock', 'create'),
      permission('finance', 'create'),
    ]), 'BEAUTY').sell).toBe(true);
  });
});
