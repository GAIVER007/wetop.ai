import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  buildSiteFacts,
  siteSpecHash,
  siteTemplatesFor,
  templateSiteSpec,
  type PublicEmployeeDto,
} from '@pms/domain';
import type { Db, Prisma } from '@pms/database';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { BeautyAppointmentsService } from '../../apps/api/src/beauty/appointments';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { EmployeePortalModule } from '../../apps/api/src/employee-portal/employee-portal.module';
import { EmployeePortalService } from '../../apps/api/src/employee-portal/employee-portal.service';
import { SITE_ASSET_STORAGE } from '../../apps/api/src/marketing-site/asset-storage';
import { SiteFormsModule } from '../../apps/api/src/site-forms/site-forms.module';
import {
  SiteFormsService,
  type BeautyBookResult,
  type BeautySlotsResult,
} from '../../apps/api/src/site-forms/site-forms.service';
import { TurnstileService } from '../../apps/api/src/web-booking/turnstile';
import { makeClients, nextMonday } from './core-security/harness';

import { assertPortalDatabase } from '../employee-portal-ui/fixture-support';

// Shared fail-closed contract, with the separate owned public-booking runner preserved.
assertPortalDatabase('public-booking');

describe('public specialist → ordinary Beauty booking → same persisted Employee/calendar', () => {
  let admin: Db;
  let tenant: Db;
  let app: INestApplication;
  let base: string;
  let portal: EmployeePortalService;
  let calendar: BeautyAppointmentsService;
  let f: Awaited<ReturnType<typeof seed>>;
  const tokens = new Set<string>();

  // Only the external CAPTCHA boundary is substituted. Profile resolution,
  // domain lookup, availability, booking, RLS, idempotency and calendar are real.
  const captcha = {
    enabled: () => true,
    verify: async (token: unknown) => {
      if (typeof token !== 'string' || tokens.has(token)) return { ok: false, reason: 'invalid' };
      tokens.add(token);
      return { ok: true };
    },
  };

  async function seed() {
    const tag = randomUUID();
    const organization = await admin.organization.create({
      data: { name: `Synthetic public booking ${tag}`, status: 'ACTIVE' },
    });
    const business = await admin.business.create({
      data: { organizationId: organization.id, name: 'Synthetic salon', vertical: 'BEAUTY' },
    });
    const location = await admin.location.create({
      data: {
        businessId: business.id,
        name: 'Synthetic centre',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
      },
    });
    const branch = await admin.location.create({
      data: {
        businessId: business.id,
        name: 'Synthetic park',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
      },
    });
    const user = await admin.user.create({
      data: {
        name: 'Synthetic owner',
        email: `${tag}@example.invalid`,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });
    await admin.membership.create({
      data: { userId: user.id, organizationId: organization.id, role: 'OWNER' },
    });
    const actor = {
      userId: user.id,
      organizationId: organization.id,
      role: 'OWNER' as const,
      scope: 'LOCATION' as const,
      businessId: business.id,
      locationId: location.id,
      vertical: 'BEAUTY' as const,
    };
    const service = await admin.beautyService.create({
      data: {
        businessId: business.id,
        name: 'Synthetic haircut',
        durationMinutes: 45,
        price: 5000n,
        currency: 'KZT',
      },
    });
    await admin.locationService.create({
      data: {
        locationId: location.id,
        serviceId: service.id,
        priceOverride: 6500n,
        durationOverride: 60,
      },
    });
    const selected = await admin.employee.create({
      data: { businessId: business.id, name: 'Z selected specialist' },
    });
    const alternate = await admin.employee.create({
      data: { businessId: business.id, name: 'A unselected specialist' },
    });
    for (const employee of [selected, alternate]) {
      await admin.employeeLocation.create({
        data: { employeeId: employee.id, locationId: location.id },
      });
      await admin.employeeService.create({
        data: { employeeId: employee.id, serviceId: service.id },
      });
      await admin.workingHours.create({
        data: {
          employeeId: employee.id,
          locationId: location.id,
          weekday: 1,
          timeFrom: new Date('1970-01-01T09:00:00Z'),
          timeTo: new Date('1970-01-01T18:00:00Z'),
        },
      });
    }
    const host = `public-booking-${tag}.example`;
    const tracked = await admin.trackedSite.create({
      data: {
        locationId: location.id,
        publicKey: `pms_${tag.replaceAll('-', '').slice(0, 12)}`,
        name: 'Synthetic existing public Beauty site',
        hosts: [host],
        status: 'ACTIVE',
      },
    });
    const facts = buildSiteFacts({
      vertical: 'BEAUTY',
      location: {
        id: location.id,
        name: location.name,
        address: 'Synthetic address',
        phone: null,
        whatsapp: null,
        city: null,
      },
      catalog: {
        kind: 'services',
        items: [
          {
            code: service.id,
            name: service.name,
            durationMin: 60,
            price: { minor: '6500', currency: 'KZT' },
          },
        ],
      },
      staff: [{ id: selected.id, name: selected.name, specialization: null }],
      hours: {
        days: [{ weekday: 1, open: '09:00', close: '18:00' }],
        checkInTime: null,
        checkOutTime: null,
      },
      photosCount: 0,
      reviews: null,
    });
    const spec = templateSiteSpec(facts, siteTemplatesFor('BEAUTY')[0]!.id)!;
    const site = await admin.marketingSite.create({
      data: {
        locationId: location.id,
        trackedSiteId: tracked.id,
        name: 'Synthetic published site',
        slug: `proof-${tag.slice(0, 12)}`,
      },
    });
    const version = await admin.marketingSiteVersion.create({
      data: {
        siteId: site.id,
        revision: 1,
        schemaVersion: 'site-spec/0',
        spec: spec as Prisma.InputJsonObject,
        specHash: siteSpecHash(spec),
        source: 'MANUAL',
      },
    });
    const domain = await admin.siteDomain.create({
      data: {
        siteId: site.id,
        host,
        kind: 'PLATFORM_SUBDOMAIN',
        isPrimary: true,
        status: 'PENDING',
      },
    });
    await admin.siteDomain.update({
      where: { id: domain.id },
      data: { status: 'ACTIVE', activatedAt: new Date() },
    });
    await admin.marketingSite.update({
      where: { id: site.id },
      data: { state: 'PUBLISHED', publishedVersionId: version.id, latestVersionId: version.id },
    });
    const profile = await withSignedInUser(actor, async () => {
      const dto = await portal.get(selected.id, {});
      return portal.mutate(selected.id, 'publication', {
        published: true,
        publicationConsent: true,
        expectedRevision: dto.profile.revision,
      });
    });
    return {
      organization,
      business,
      location,
      branch,
      service,
      selected,
      alternate,
      actor,
      host,
      tracked,
      site,
      slug: profile.profile.slug,
      date: nextMonday(4),
    };
  }

  beforeAll(async () => {
    ({ admin, tenant } = makeClients());
    const prisma = { db: tenant } as PrismaService;
    const mod = await Test.createTestingModule({ imports: [EmployeePortalModule, SiteFormsModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(SITE_ASSET_STORAGE)
      .useValue(null)
      .overrideProvider(TurnstileService)
      .useValue(captcha)
      .compile();
    app = mod.createNestApplication();
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor(prisma));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    portal = app.get(EmployeePortalService);
    calendar = new BeautyAppointmentsService(prisma);
  });
  beforeEach(async () => {
    app.get(SiteFormsService).resetLimits();
    f = await seed();
  });
  afterAll(async () => {
    await app?.close();
    await tenant?.$disconnect();
    await admin?.$disconnect();
  });

  async function publicJourney(expected = { priceMinor: '6500', durationMinutes: 60 }) {
    // No auth cookie/header: the published public controller supplies the link.
    const response = await fetch(
      `${base}/employee-portal/public/${f.slug}?locationId=${f.location.id}`,
    );
    expect(response.status, await response.clone().text()).toBe(200);
    const profile = (await response.json()) as PublicEmployeeDto;
    expect(profile.bookingUrl).not.toBeNull();
    const link = new URL(profile.bookingUrl!);
    expect(link.origin).toBe(`https://${f.host}`);
    expect(link.hash).not.toBe('');
    const employeeId = link.searchParams.get('employeeId');
    expect(employeeId).toBe(f.selected.id);
    const serviceId = profile.services[0]!.id;
    expect(profile.services[0]).toMatchObject(expected);
    const query = new URLSearchParams({
      k: f.tracked.publicKey,
      service: serviceId,
      employee: employeeId!,
      date: f.date,
    });
    const slotsResponse = await fetch(`${base}/w/beauty/slots?${query}`, {
      headers: { origin: link.origin },
    });
    expect(slotsResponse.status, await slotsResponse.clone().text()).toBe(200);
    const availability = (await slotsResponse.json()) as BeautySlotsResult;
    expect(availability.employees.map((e) => e.id)).toEqual([f.selected.id]);
    expect(availability.service).toMatchObject({
      id: serviceId,
      priceMinor: expected.priceMinor,
      durationMinutes: expected.durationMinutes,
    });
    expect(availability.slots.length).toBeGreaterThan(0);
    expect(
      availability.slots.every(
        (slot) => slot.employeeIds.length === 1 && slot.employeeIds[0] === employeeId,
      ),
    ).toBe(true);
    return { link, employeeId, serviceId, availability, query };
  }

  async function book(body: Record<string, unknown>, origin: string) {
    const response = await fetch(`${base}/w/beauty/book`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify(body),
    });
    return { status: response.status, json: (await response.json()) as BeautyBookResult };
  }
  function body(journey: Awaited<ReturnType<typeof publicJourney>>) {
    return {
      k: f.tracked.publicKey,
      employeeId: journey.employeeId,
      serviceId: journey.serviceId,
      startsAt: journey.availability.slots[0]!.startsAt,
      requestKey: randomUUID(),
      name: 'Synthetic booking customer',
      phone: '+77010000001',
      turnstileToken: randomUUID(),
    };
  }

  it('persists the exact linked employee and shows the same appointment in the ordinary branch calendar; replay creates no duplicate', async () => {
    const journey = await publicJourney();
    const request = body(journey);
    const created = await book(request, journey.link.origin);
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    expect(created.json).toMatchObject({
      status: 'BOOKED',
      employee: { id: f.selected.id },
      service: { id: f.service.id },
      startsAt: request.startsAt,
      priceMinor: '6500',
      currency: 'KZT',
    });
    const persisted = await admin.appointment.findUniqueOrThrow({
      where: { id: created.json.appointmentId },
      include: { customer: true },
    });
    expect(persisted).toMatchObject({
      employeeId: f.selected.id,
      locationId: f.location.id,
      serviceId: f.service.id,
      source: 'WEBSITE',
      status: 'BOOKED',
      price: 6500n,
      createdById: null,
      creationKey: `site:${f.tracked.id}:${request.requestKey}`,
    });
    expect(persisted.startsAt.toISOString()).toBe(created.json.startsAt);
    expect(persisted.endsAt.toISOString()).toBe(created.json.endsAt);
    expect(persisted.customer).toMatchObject({
      organizationId: f.organization.id,
      phone: request.phone,
    });
    const day = await withSignedInUser(f.actor, () => calendar.day(f.date));
    expect(day.appointments).toEqual([
      expect.objectContaining({
        id: persisted.id,
        employeeId: f.selected.id,
        serviceId: f.service.id,
        startsAt: created.json.startsAt,
        endsAt: created.json.endsAt,
        status: 'BOOKED',
        priceMinor: '6500',
      }),
    ]);
    expect(day.columns.some((column) => column.id === persisted.employeeId)).toBe(true);
    const replay = await book(request, journey.link.origin); // same now-used CAPTCHA token
    expect(replay.status, JSON.stringify(replay.json)).toBe(201);
    expect(replay.json.appointmentId).toBe(persisted.id);
    expect(await admin.appointment.count({ where: { locationId: f.location.id } })).toBe(1);
    const after = await fetch(`${base}/w/beauty/slots?${journey.query}`, {
      headers: { origin: journey.link.origin },
    });
    expect(after.status).toBe(200);
    expect(
      ((await after.json()) as BeautySlotsResult).slots.map((slot) => slot.startsAt),
    ).not.toContain(request.startsAt);
    // This alphabetically earlier master really was available. A dropped employee
    // selector would pick it and fail both the persisted row and calendar checks.
    expect(await admin.appointment.count({ where: { employeeId: f.alternate.id } })).toBe(0);
  });

  it.each([
    { priceType: 'FIXED' as const, amount: 12345n },
    { priceType: 'FREE' as const, amount: 0n },
  ])('keeps selected-master $priceType price and duration identical from profile through slots to persisted booking', async ({ priceType, amount }) => {
    await admin.employeeServicePrice.create({ data: {
      employeeId: f.selected.id, serviceId: f.service.id, locationId: f.location.id,
      priceType, priceMinMinor: priceType === 'FREE' ? null : amount,
      durationMinutes: 75, currency: 'KZT',
    } });
    const journey = await publicJourney({ priceMinor: amount.toString(), durationMinutes: 75 });
    expect(journey.availability.slots.every(slot =>
      Date.parse(slot.endsAt) - Date.parse(slot.startsAt) === 75 * 60_000,
    )).toBe(true);
    const request = body(journey);
    const created = await book(request, journey.link.origin);
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    expect(created.json).toMatchObject({ employee: { id: f.selected.id }, priceMinor: amount.toString() });
    const persisted = await admin.appointment.findUniqueOrThrow({ where: { id: created.json.appointmentId } });
    expect(persisted.price).toBe(amount);
    expect(persisted.endsAt.getTime() - persisted.startsAt.getTime()).toBe(75 * 60_000);
    const replay = await book(request, journey.link.origin);
    expect(replay.status).toBe(201);
    expect(replay.json.appointmentId).toBe(persisted.id);
    expect(await admin.appointment.count({ where: { locationId: f.location.id } })).toBe(1);
  });

  it.each(['RANGE', 'UNFIXED'] as const)('does not advertise fixed public slots when the selected master requires a final $priceType price', async priceType => {
    await admin.employeeServicePrice.create({ data: {
      employeeId: f.selected.id, serviceId: f.service.id, locationId: f.location.id,
      priceType, priceMinMinor: priceType === 'RANGE' ? 10000n : null,
      priceMaxMinor: priceType === 'RANGE' ? 20000n : null,
      durationMinutes: 75, currency: 'KZT',
    } });
    const query = new URLSearchParams({ k: f.tracked.publicKey, service: f.service.id, employee: f.selected.id, date: f.date });
    const response = await fetch(`${base}/w/beauty/slots?${query}`, { headers: { origin: `https://${f.host}` } });
    expect(response.status, await response.clone().text()).toBe(409);
    expect(await admin.appointment.count({ where: { locationId: f.location.id } })).toBe(0);
    const profile = await portal.publicProfile(f.slug, f.location.id);
    expect(profile.bookingUrl).toBeNull();
  });

  it('rejects a now-busy selected specialist instead of silently booking the available alternate', async () => {
    const journey = await publicJourney();
    const request = body(journey);
    expect((await book(request, journey.link.origin)).status).toBe(201);
    const collision = await book(
      { ...request, requestKey: randomUUID(), turnstileToken: randomUUID() },
      journey.link.origin,
    );
    expect(collision.status, JSON.stringify(collision.json)).toBe(409);
    const alternateQuery = new URLSearchParams(journey.query);
    alternateQuery.set('employee', f.alternate.id);
    const alternate = await fetch(`${base}/w/beauty/slots?${alternateQuery}`, {
      headers: { origin: journey.link.origin },
    });
    expect(alternate.status).toBe(200);
    expect(
      ((await alternate.json()) as BeautySlotsResult).slots.some(
        (slot) => slot.startsAt === request.startsAt,
      ),
    ).toBe(true);
    expect(await admin.appointment.count({ where: { locationId: f.location.id } })).toBe(1);
    expect(await admin.appointment.count({ where: { employeeId: f.alternate.id } })).toBe(0);
  });

  it('rejects another origin and unavailable service without persisting an appointment', async () => {
    const journey = await publicJourney();
    const request = body(journey);
    expect((await book(request, 'https://unrelated.example')).status).toBe(403);
    await admin.employeeService.deleteMany({
      where: { employeeId: f.selected.id, serviceId: f.service.id },
    });
    const unavailable = await book(
      { ...request, turnstileToken: randomUUID() },
      journey.link.origin,
    );
    expect(unavailable.status, JSON.stringify(unavailable.json)).toBe(409); // canonical desk planning conflict
    expect(await admin.appointment.count({ where: { locationId: f.location.id } })).toBe(0);
    const publicResponse = await fetch(
      `${base}/employee-portal/public/${f.slug}?locationId=${f.location.id}`,
    );
    expect(publicResponse.status).toBe(200);
    expect(await publicResponse.json()).toMatchObject({ services: [], bookingUrl: null });
  });
});
