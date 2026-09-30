import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import { BusinessAgentsService } from './business-agents.service';
import { FakeBusinessAgents, FakeSellerExtensions } from './fakes';

/**
 * Область запроса вошедшего не шире выбора (Platform P2, ADR-120): выбран филиал — агента не создать и не увидеть на другом,
 * выбран Business — на чужом Business. Проверяется на службе: указатель scope на HTTP-уровне ставит `AuthorInterceptor`,
 * а здесь важно, что служба его уважает.
 */

const ORG = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const USER = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const BIZ_1 = 'aaaa0000-0000-4000-8000-00000000000a';
const BIZ_2 = 'aaaa0000-0000-4000-8000-00000000000b';
const LOC_1 = 'aaaa1111-0000-4000-8000-0000000000a1';
const LOC_2 = 'aaaa2222-0000-4000-8000-0000000000a2';
const LOC_3 = 'aaaa3333-0000-4000-8000-0000000000a3';
const KEY = '11111111-aaaa-4aaa-8aaa-111111111111';

let repo: FakeBusinessAgents;
let service: BusinessAgentsService;

beforeEach(() => {
  repo = new FakeBusinessAgents();
  repo.businesses.set(ORG, [
    {
      id: BIZ_1,
      name: 'Сеть 1',
      locations: [
        { id: LOC_1, name: 'Алматы' },
        { id: LOC_2, name: 'Астана' },
      ],
    },
    { id: BIZ_2, name: 'Сеть 2', locations: [{ id: LOC_3, name: 'Шымкент' }] },
  ]);
  service = new BusinessAgentsService(repo, new FakeSellerExtensions() as never);
});

const actor = (scope: 'ORGANIZATION' | 'BUSINESS' | 'LOCATION', ids: { businessId?: string; locationId?: string } = {}) => ({
  userId: USER,
  organizationId: ORG,
  role: 'OWNER' as const,
  scope,
  ...ids,
});
const body = (locationId: string, businessId = BIZ_1) => ({ name: 'Агент', businessId, locationId });

describe('scope запроса', () => {
  it('организация: видны все филиалы всех Business', async () => {
    const options = await withSignedInUser(actor('ORGANIZATION'), () => service.options());
    expect(options.businesses.flatMap((b) => b.locations.map((l) => l.id))).toEqual([LOC_1, LOC_2, LOC_3]);
  });

  it('выбран филиал: варианты — только он; создать на другом — 404, на выбранном — можно', async () => {
    const scoped = actor('LOCATION', { businessId: BIZ_1, locationId: LOC_2 });
    const options = await withSignedInUser(scoped, () => service.options());
    expect(options.businesses.flatMap((b) => b.locations.map((l) => l.id))).toEqual([LOC_2]);
    await expect(withSignedInUser(scoped, () => service.create(KEY, body(LOC_1)))).rejects.toBeInstanceOf(NotFoundException);
    await expect(withSignedInUser(scoped, () => service.create(KEY, body(LOC_3, BIZ_2)))).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.agents.size).toBe(0);
    const created = await withSignedInUser(scoped, () => service.create(KEY, body(LOC_2)));
    expect(created.location.id).toBe(LOC_2);
  });

  it('выбран Business: филиалы других Business недоступны', async () => {
    const scoped = actor('BUSINESS', { businessId: BIZ_2 });
    const options = await withSignedInUser(scoped, () => service.options());
    expect(options.businesses.map((b) => b.id)).toEqual([BIZ_2]);
    await expect(withSignedInUser(scoped, () => service.create(KEY, body(LOC_1)))).rejects.toBeInstanceOf(NotFoundException);
    await withSignedInUser(scoped, () => service.create(KEY, body(LOC_3, BIZ_2)));
    expect(repo.agents.size).toBe(1);
  });

  it('агента на филиале вне выбора страница не открывает', async () => {
    await withSignedInUser(actor('ORGANIZATION'), () => service.create(KEY, body(LOC_1)));
    const other = actor('LOCATION', { businessId: BIZ_1, locationId: LOC_2 });
    await expect(withSignedInUser(other, () => service.get(KEY))).rejects.toBeInstanceOf(NotFoundException);
    const same = actor('LOCATION', { businessId: BIZ_1, locationId: LOC_1 });
    expect((await withSignedInUser(same, () => service.get(KEY))).id).toBe(KEY);
  });
});
