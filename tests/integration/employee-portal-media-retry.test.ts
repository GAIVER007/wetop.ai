import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { EmployeePortalService } from '../../apps/api/src/employee-portal/employee-portal.service';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { assertPortalDatabase, seedPortalFixture } from '../employee-portal-ui/fixture-support';
import { DiskPortalStorage } from '../employee-portal-ui/disk-storage';

const db = createPrismaClient(assertPortalDatabase(), 'pms_test');
const storage = new DiskPortalStorage();
const service = new EmployeePortalService({ db } as PrismaService, storage);
const buffer = readFileSync(new URL('../employee-portal-ui/fixtures/avatar.png', import.meta.url));
const input = { title: 'Retry-safe work', description: 'Synthetic owned upload', publicationConsent: true, published: true };
let f: Awaited<ReturnType<typeof seedPortalFixture>>;
const as = <T>(actor: 'staffA' | 'ownerA' | 'ownerB', run: () => Promise<T>) => withSignedInUser({ ...f.actors[actor], ...(actor === 'ownerB' ? {} : { scope: 'LOCATION' as const, locationId: f.locationA }) }, run);
beforeEach(async () => { f = await seedPortalFixture(db); });
afterAll(async () => { await db.$disconnect(); });

describe('processed employee image retries are employee-scoped and durable', () => {
  it('repeating a portfolio upload returns one work, one media and the existing bytes', async () => {
    const first = await as('staffA', () => service.upload(null, 'PORTFOLIO', { buffer }, input));
    const second = await as('staffA', () => service.upload(null, 'PORTFOLIO', { buffer }, input));
    expect(second.portfolio).toHaveLength(1);
    expect(second.portfolio[0]!.id).toBe(first.portfolio[0]!.id);
    expect(second.profile.revision).toBe(first.profile.revision);
    expect(await db.employeeMedia.count({ where: { employeeId: f.employeeA, kind: 'PORTFOLIO' } })).toBe(1);
    expect(await storage.existsByUrl(first.portfolio[0]!.image.url)).toBe(true);
  });
  it('concurrent identical requests cannot create two works', async () => {
    const [a, b] = await Promise.all([
      as('staffA', () => service.upload(null, 'PORTFOLIO', { buffer }, input)),
      as('staffA', () => service.upload(null, 'PORTFOLIO', { buffer }, input)),
    ]);
    expect(a.portfolio).toHaveLength(1); expect(b.portfolio).toHaveLength(1);
    expect(a.portfolio[0]!.id).toBe(b.portfolio[0]!.id);
    expect(await db.employeePortfolioItem.count({ where: { employeeId: f.employeeA } })).toBe(1);
  });
  it('a retry cannot revoke the approval made after the first upload', async () => {
    let dto = await as('staffA', () => service.upload(null, 'PORTFOLIO', { buffer }, input));
    const id = dto.portfolio[0]!.id;
    dto = await as('ownerA', () => service.mutate(f.employeeA, 'work', input, id));
    dto = await as('ownerA', () => service.mutate(f.employeeA, 'publication', { published: true, publicationConsent: true, expectedRevision: dto.profile.revision }));
    const retry = await as('staffA', () => service.upload(null, 'PORTFOLIO', { buffer }, input));
    expect(retry.portfolio).toHaveLength(1); expect(retry.portfolio[0]!.published).toBe(true);
    expect(retry.profile.published).toBe(true); expect(retry.profile.revision).toBe(dto.profile.revision);
  });
  it('keeps distinct metadata and other employees independent', async () => {
    await as('staffA', () => service.upload(null, 'PORTFOLIO', { buffer }, input));
    const otherTitle = await as('staffA', () => service.upload(null, 'PORTFOLIO', { buffer }, { ...input, title: 'Different work' }));
    expect(otherTitle.portfolio).toHaveLength(2);
    const otherEmployee = await withSignedInUser(f.actors.ownerA, () => service.upload(f.employeeB, 'PORTFOLIO', { buffer }, input));
    expect(otherEmployee.portfolio).toHaveLength(1);
    expect(otherEmployee.portfolio[0]!.image.id).not.toBe(otherTitle.portfolio[0]!.image.id);
  });
  it('an identical avatar retry preserves media identity and publication revision', async () => {
    const first = await as('staffA', () => service.upload(null, 'AVATAR', { buffer }, {}));
    const retry = await as('staffA', () => service.upload(null, 'AVATAR', { buffer }, {}));
    expect(retry.avatar!.id).toBe(first.avatar!.id);
    expect(retry.profile.revision).toBe(first.profile.revision);
    expect(await storage.existsByUrl(first.avatar!.url)).toBe(true);
  });
});
