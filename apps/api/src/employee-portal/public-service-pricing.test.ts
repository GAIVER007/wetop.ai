import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { EmployeePortalService } from './employee-portal.service';
import type { PrismaService } from '../database/prisma.provider';

const employeeId = '10000000-0000-4000-8000-000000000001';
const locationId = '10000000-0000-4000-8000-000000000002';
const otherLocationId = '10000000-0000-4000-8000-000000000003';
const serviceId = '10000000-0000-4000-8000-000000000004';
type MasterPrice = {
  serviceId: string;
  locationId: string;
  priceType: 'FIXED' | 'FREE' | 'RANGE' | 'UNFIXED';
  priceMinMinor: bigint | null;
  priceMaxMinor: bigint | null;
  durationMinutes: number | null;
  currency: string;
};
function fixture(prices: MasterPrice[] = [], currency = 'KZT', branchPrice: bigint | null = 6500n) {
  const db = {
    $queryRaw: vi.fn().mockResolvedValue([{ employee_id: employeeId, organization_id: '20000000-0000-4000-8000-000000000001' }]),
    employeePublicProfile: {
      findFirst: vi.fn().mockResolvedValue({
        slug: 'synthetic-specialist', headline: '', biography: '', practiceSinceYear: null,
        employee: {
          id: employeeId, name: 'Synthetic specialist', email: 'private@example.invalid',
          business: { name: 'Synthetic salon', vertical: 'BEAUTY', organization: { status: 'ACTIVE', trialEndsAt: null } },
          locations: [{ location: { id: locationId, name: 'Synthetic centre', currency } }],
          portalMedia: [], portfolio: [], servicePrices: prices,
          services: [{ service: { id: serviceId, name: 'Synthetic service', price: 5000n, currency: 'KZT', durationMinutes: 45,
            locations: [{ locationId, priceOverride: branchPrice, durationOverride: 60 }] } }],
        },
      }),
    },
    marketingSite: { findUnique: vi.fn().mockResolvedValue(null) },
    // рейтинг карточки (28.10.2026): без отзывов
    beautyAppointmentReview: {
      aggregate: vi.fn().mockResolvedValue({ _avg: { stars: null }, _count: { _all: 0 } }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  return { db, portal: new EmployeePortalService({ db } as unknown as PrismaService, null) };
}
const price = (over: Partial<MasterPrice> = {}): MasterPrice => ({
  serviceId, locationId, priceType: 'FIXED', priceMinMinor: 12345n, priceMaxMinor: null,
  durationMinutes: 75, currency: 'KZT', ...over,
});

describe('public specialist advertises the approved selected-master terms', () => {
  it('uses the master fixed price and duration rather than the branch or catalog', async () => {
    const { portal, db } = fixture([price()]);
    const dto = await portal.publicProfile('synthetic-specialist', locationId);
    expect(dto.services).toEqual([expect.objectContaining({ id: serviceId, priceMinor: '12345', durationMinutes: 75, currency: 'KZT', priceType: 'FIXED' })]);
    expect(db.employeePublicProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ employee: expect.objectContaining({ select: expect.objectContaining({ servicePrices: expect.any(Object) }) }) }),
    }));
    expect(JSON.stringify(dto)).not.toMatch(/private@example|priceMinMinor|servicePrices|userId|payroll/);
  });
  it('represents FREE as zero while preserving inherited branch duration', async () => {
    const { portal } = fixture([price({ priceType: 'FREE', priceMinMinor: null, durationMinutes: null })]);
    expect((await portal.publicProfile('synthetic-specialist', locationId)).services[0]).toMatchObject({ priceMinor: '0', durationMinutes: 60, priceType: 'FREE' });
  });
  it('represents an existing RANGE honestly instead of a fixed catalog amount', async () => {
    const { portal } = fixture([price({ priceType: 'RANGE', priceMinMinor: 10000n, priceMaxMinor: 20000n })]);
    expect((await portal.publicProfile('synthetic-specialist', locationId)).services[0]).toMatchObject({ priceType: 'RANGE', priceMinor: '10000', priceMaxMinor: '20000', durationMinutes: 75 });
  });
  it('does not invent a final amount for UNFIXED pricing', async () => {
    const { portal } = fixture([price({ priceType: 'UNFIXED', priceMinMinor: null })]);
    expect((await portal.publicProfile('synthetic-specialist', locationId)).services[0]).toMatchObject({ priceType: 'UNFIXED', priceMinor: null, durationMinutes: 75 });
  });
  it('uses a master price in branch currency even when catalog currency differs and there is no branch price', async () => {
    const { portal } = fixture([price({ currency: 'USD' })], 'USD', null);
    expect((await portal.publicProfile('synthetic-specialist', locationId)).services[0]).toMatchObject({ priceMinor: '12345', currency: 'USD', durationMinutes: 75 });
  });
  it('does not replace a wrong-currency master price with a misleading branch amount', async () => {
    const { portal } = fixture([price({ currency: 'USD' })]);
    expect((await portal.publicProfile('synthetic-specialist', locationId)).services).toEqual([]);
  });
  it('does not borrow another branch master price', async () => {
    const { portal } = fixture([price({ locationId: otherLocationId })]);
    expect((await portal.publicProfile('synthetic-specialist', locationId)).services[0]).toMatchObject({ priceMinor: '6500', durationMinutes: 60 });
  });
  it('preserves the existing branch fallback without a master override', async () => {
    const { portal } = fixture();
    expect((await portal.publicProfile('synthetic-specialist', locationId)).services[0]).toMatchObject({ priceMinor: '6500', durationMinutes: 60, currency: 'KZT' });
  });
});
