import type { PrismaService } from '../database/prisma.provider';
import type { ExtensionsService } from '../platform/extensions.service';
import { beforeEach, expect, it, vi } from 'vitest';
import { VerticalToolsService } from './vertical-tools.service';
const id = '11111111-1111-4111-8111-111111111111';
interface FakeAgent { id: string; organizationId: string; lifecycle: string; scenario: string; organization: { status: string }; location: { id: string; businessId: string; status: string; timezone: string; currency: string; business: { id: string; organizationId: string; vertical: string; status: string } } }
let agent: FakeAgent;
let missing = false;
const db = {
  sellerAgent: { findFirst: vi.fn(async () => missing ? null : agent) },
  beautyService: { findMany: vi.fn(async () => [
    { name: 'Услуга', category: null, active: true, price: 10000n, currency: 'KZT', durationMinutes: 30,
      locations: [{ enabled: true, priceOverride: 12000n, durationOverride: 45 }] },
    { name: 'Выключена', category: null, active: true, price: 100n, currency: 'KZT', durationMinutes: 30,
      locations: [{ enabled: false, priceOverride: null, durationOverride: null }] },
  ]) },
  servicePeriod: { findMany: vi.fn(async () => [{ name: 'Ужин', weekday: 2,
    timeFrom: new Date('1970-01-01T18:00:00Z'), timeTo: new Date('1970-01-01T23:00:00Z'),
    endsNextDay: false, defaultDurationMinutes: 90 }]) },
};
const extensions = { aiSeller: vi.fn(async () => ({ access: 'active' })) };
const service = () => new VerticalToolsService({ db } as unknown as PrismaService, extensions as unknown as ExtensionsService);
beforeEach(() => {
  vi.clearAllMocks();
  missing = false;
  agent = { id, organizationId: 'org', lifecycle: 'active', scenario: 'sales',
    organization: { status: 'ACTIVE' }, location: { id: 'loc', businessId: 'biz', status: 'ACTIVE',
      timezone: 'Asia/Almaty', currency: 'KZT', business: { id: 'biz', organizationId: 'org',
        vertical: 'BEAUTY', status: 'ACTIVE' } } };
  extensions.aiSeller.mockResolvedValue({ access: 'active' });
});
it('context uses verified chain and only Beauty capabilities', async () => {
  expect(await service().context(id)).toEqual({ agentId: id, organizationId: 'org', businessId: 'biz',
    locationId: 'loc', vertical: 'BEAUTY', timezone: 'Asia/Almaty', currency: 'KZT',
    capabilities: ['beauty.services'] });
  expect(db.beautyService.findMany).not.toHaveBeenCalled();
});
it.each(['missing', 'foreign', 'archivedBusiness', 'archivedLocation', 'paused', 'draft', 'suspended', 'unknownVertical'])('%s binding rejects before domain reads', async (kind) => {
  if (kind === 'missing') missing = true;
  if (kind === 'foreign') agent.location.business.organizationId = 'other';
  if (kind === 'archivedBusiness') agent.location.business.status = 'ARCHIVED';
  if (kind === 'archivedLocation') agent.location.status = 'ARCHIVED';
  if (kind === 'paused') agent.lifecycle = 'paused';
  if (kind === 'draft') agent.lifecycle = 'draft';
  if (kind === 'suspended') agent.organization.status = 'SUSPENDED';
  if (kind === 'unknownVertical') agent.location.business.vertical = 'INVALID';
  await expect(service().beauty(id)).rejects.toMatchObject({ status: 404 });
  expect(db.beautyService.findMany).not.toHaveBeenCalled();
  expect(db.servicePeriod.findMany).not.toHaveBeenCalled();
});
it('expired entitlement rejects before catalogs', async () => {
  extensions.aiSeller.mockResolvedValue({ access: 'expired' });
  await expect(service().beauty(id)).rejects.toMatchObject({ status: 404 });
  expect(db.beautyService.findMany).not.toHaveBeenCalled();
});
it('Beauty projects enabled effective prices without PII', async () => {
  const result = await service().beauty(id);
  expect(result.items).toEqual([{ name: 'Услуга', category: null, durationMinutes: 45,
    priceMinor: '12000', currency: 'KZT' }]);
  expect(db.beautyService.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz', active: true } }));
});
it('cross vertical denies before domain calls', async () => {
  await expect(service().food(id)).rejects.toMatchObject({ status: 403 });
  expect(db.servicePeriod.findMany).not.toHaveBeenCalled();
});
it('Food projects saved service periods only', async () => {
  agent.location.business.vertical = 'FOOD_SERVICE';
  const result = await service().food(id);
  expect(result.context.capabilities).toEqual(['food.servicePeriods']);
  expect(result.items).toEqual([{ name: 'Ужин', weekday: 2, timeFrom: '18:00', timeTo: '23:00',
    endsNextDay: false, defaultDurationMinutes: 90 }]);
  expect(db.servicePeriod.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { locationId: 'loc', active: true } }));
});
it('each tool revalidates binding after context lookup', async () => {
  const s = service(); await s.context(id); agent.location.status = 'ARCHIVED';
  await expect(s.beauty(id)).rejects.toMatchObject({ status: 404 });
  expect(db.beautyService.findMany).not.toHaveBeenCalled();
});
