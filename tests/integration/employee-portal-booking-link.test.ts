import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildSiteFacts, siteSpecHash, siteTemplatesFor, templateSiteSpec, validateSiteSpec } from '@pms/domain';
import { createPrismaClient, type Prisma } from '@pms/database';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { EmployeePortalService } from '../../apps/api/src/employee-portal/employee-portal.service';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { assertPortalDatabase, seedPortalFixture } from '../employee-portal-ui/fixture-support';

const db = createPrismaClient(assertPortalDatabase(), 'pms_test');
const portal = new EmployeePortalService({ db } as PrismaService, null);
let host: string;
let f: Awaited<ReturnType<typeof seedPortalFixture>>;
let siteId: string;
let trackedId: string;
let slug: string;
beforeEach(async () => {
  f = await seedPortalFixture(db);
  host = `salon-${randomUUID()}.portal-fixture.example`;
  const facts = buildSiteFacts({
    vertical: 'BEAUTY',
    location: { id: f.locationA, name: 'Owned salon', address: 'Synthetic fixture address', phone: '+77000000001', whatsapp: null, city: 'Алматы' },
    catalog: { kind: 'services', items: [{ code: f.serviceId!, name: 'Fixture service', price: { minor: '5000', currency: 'KZT' }, durationMin: 45 }] },
    staff: [{ id: f.employeeA, name: 'Fixture professional', specialization: null }],
    hours: { days: [{ weekday: 1, open: '09:00', close: '18:00' }], checkInTime: null, checkOutTime: null },
    photosCount: 0, reviews: null,
  });
  const spec = templateSiteSpec(facts, siteTemplatesFor('BEAUTY')[0]!.id)!;
  expect(validateSiteSpec(spec).ok).toBe(true);
  const tracked = await db.trackedSite.create({ data: { locationId: f.locationA, name: 'Owned public Beauty contour', publicKey: `pms_${randomUUID().replaceAll('-', '').slice(0, 12)}`, hosts: [host], status: 'ACTIVE' } });
  trackedId = tracked.id;
  const site = await db.marketingSite.create({ data: { locationId: f.locationA, trackedSiteId: tracked.id, name: 'Owned linked salon', slug: `fixture-${randomUUID().slice(0, 8)}` } });
  siteId = site.id;
  const version = await db.marketingSiteVersion.create({ data: { siteId, revision: 1, schemaVersion: 'site-spec/0', spec: spec as Prisma.InputJsonObject, specHash: siteSpecHash(spec), source: 'MANUAL' } });
  const domain = await db.siteDomain.create({ data: { siteId, host, kind: 'PLATFORM_SUBDOMAIN', isPrimary: true, status: 'PENDING' } });
  await db.siteDomain.update({ where: { id: domain.id }, data: { status: 'ACTIVE', activatedAt: new Date() } });
  await db.marketingSite.update({ where: { id: siteId }, data: { publishedVersionId: version.id, latestVersionId: version.id, state: 'PUBLISHED' } });
  await withSignedInUser({ ...f.actors.ownerA, scope: 'LOCATION', locationId: f.locationA }, async () => {
    const dto = await portal.get(f.employeeA, {});
    const published = await portal.mutate(f.employeeA, 'publication', { published: true, publicationConsent: true, expectedRevision: dto.profile.revision });
    slug = published.profile.slug;
  });
});
afterAll(async () => { await db.$disconnect(); });

describe('published specialist hooks only into its existing public Beauty site', () => {
  it('returns the actual primary-domain form URL, preserving the exact master', async () => {
    const result = await portal.publicProfile(slug, f.locationA);
    expect(result.bookingUrl).not.toBeNull();
    const url = new URL(result.bookingUrl!);
    expect(url.origin).toBe(`https://${host}`);
    expect(url.searchParams.get('employeeId')).toBe(f.employeeA);
    expect(url.hash).not.toBe('');
    expect(result.services.some(s => s.id === f.serviceId)).toBe(true);
  });
  it('does not invent a site or use another branch when no site is connected', async () => {
    const count = await db.marketingSite.count();
    const result = await portal.publicProfile(slug, f.locationB);
    expect(result.bookingUrl).toBeNull();
    expect(await db.marketingSite.count()).toBe(count);
  });
  it('does not route to a paused site or an origin outside the tracked host set', async () => {
    await db.marketingSite.update({ where: { id: siteId }, data: { state: 'PAUSED' } });
    expect((await portal.publicProfile(slug, f.locationA)).bookingUrl).toBeNull();
    await db.marketingSite.update({ where: { id: siteId }, data: { state: 'PUBLISHED' } });
    await db.trackedSite.update({ where: { id: trackedId }, data: { hosts: ['other.portal-fixture.example'] } });
    expect((await portal.publicProfile(slug, f.locationA)).bookingUrl).toBeNull();
  });
  it('does not offer a booking action when the employee has no available service', async () => {
    await db.employeeService.deleteMany({ where: { employeeId: f.employeeA } });
    const result = await portal.publicProfile(slug, f.locationA);
    expect(result.services).toHaveLength(0); expect(result.bookingUrl).toBeNull();
  });
  it('does not silently choose a branch on a multi-branch public card', async () => {
    const result = await portal.publicProfile(slug);
    expect(result.locationId).toBeNull(); expect(result.bookingUrl).toBeNull(); expect(result.services).toHaveLength(0);
  });
  // карточка мастера для клиента (владелец 28.10.2026): рейтинг и последние отзывы, без имён клиентов
  it('публичная карточка отдаёт рейтинг и три последних отзыва без имён и без чужого филиала', async () => {
    // стенд уже кладёт мастеру A один отзыв 5★ («Synthetic own review»)
    const before = await portal.publicProfile(slug, f.locationA);
    expect(before.reviews).toMatchObject({ averageStars: 5, count: 1 });
    const customer = await db.customer.create({ data: { organizationId: f.organizationA, firstName: 'Synthetic reviewer name' } });
    const visit = async (stars: number, comment: string | null, day: number, location = f.locationA) => {
      const at = new Date(Date.now() - (10 - day) * 86400000); // по дню на отзыв, позже идёт свежее
      const a = await db.appointment.create({ data: { locationId: location, customerId: customer.id, employeeId: f.employeeA, serviceId: f.serviceId!, startsAt: at, endsAt: new Date(at.getTime() + 3600000), status: 'DONE', price: 5000n, currency: 'KZT', createdById: f.actors.ownerA.id } });
      await db.beautyAppointmentReview.create({ data: { appointmentId: a.id, employeeId: f.employeeA, stars, comment, submittedAt: new Date(Date.now() + day * 60000) } });
    };
    await visit(5, 'Очень аккуратно', 1);
    await visit(4, null, 2);
    await visit(5, 'Приду ещё', 3);
    await visit(3, 'Ждала долго', 4);
    await visit(1, 'Другой филиал', 5, f.locationB);
    const r = await portal.publicProfile(slug, f.locationA);
    expect(r.reviews.count).toBe(5);
    expect(r.reviews.averageStars).toBeCloseTo(4.4, 5);
    expect(r.reviews.items.map((i) => [i.stars, i.comment])).toEqual([[3, 'Ждала долго'], [5, 'Приду ещё'], [4, null]]);
    expect(JSON.stringify(r)).not.toContain('Synthetic reviewer name');
    expect(r.reviews.items[0]).not.toHaveProperty('appointmentId');
  });
});
