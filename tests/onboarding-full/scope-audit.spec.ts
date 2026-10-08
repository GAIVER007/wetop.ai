import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createPrismaClient, createPropertyInChain, NEW_PROPERTY_DEFAULTS } from '@pms/database';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { fullQaPorts } from './ports';
import { isLocalDatabase } from '../tools/seed-local';
if (!isLocalDatabase(process.env.DATABASE_URL ?? ''))
  throw new Error('Synthetic localhost required');
const db = createPrismaClient(process.env.DATABASE_URL!, 'pms_test');
const qa = fullQaPorts.url;
async function fixture(request: APIRequestContext, vertical: string) {
  const response = await request.post(`${qa}/__qa/reset`, { data: { vertical } });
  expect(response.status()).toBe(200);
  return response.json() as Promise<{
    organizationId: string;
    userId: string;
    email: string;
    password: string;
    businessId: string;
    locationId: string;
  }>;
}
async function session(request: APIRequestContext, f: Awaited<ReturnType<typeof fixture>>) {
  const response = await request.post(`${qa}/auth/login`, {
    data: { email: f.email, password: f.password },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).token as string;
}
test.afterAll(async ({ request }) => {
  expect((await request.post(`${qa}/__qa/cleanup`)).status()).toBe(200);
  await db.$disconnect();
});
test('T04 Website and direct report guards across three verticals and real membership roles', async ({
  request,
}, info) => {
  const evidence: object[] = [];
  for (const vertical of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE']) {
    const f = await fixture(request, vertical);
    const other = await fixture(request, vertical);
    const token = await session(request, f);
    const pointer = `business=${f.businessId};location=${f.locationId}`;
    const report =
      vertical === 'HOSPITALITY'
        ? '/desk/today?date=2030-01-01'
        : vertical === 'BEAUTY'
          ? '/beauty/appointments?date=2030-01-01'
          : '/food-service/reservations?date=2030-01-01&limit=100';
    for (const role of ['OWNER', 'MANAGER', 'STAFF'] as const) {
      await db.membership.update({
        where: { userId_organizationId: { userId: f.userId, organizationId: f.organizationId } },
        data: { role },
      });
      const headers = { 'x-wetop-session': token, 'x-wetop-scope': pointer };
      const own = await request.get(`${qa}/marketing/site`, { headers });
      const expected = vertical === 'HOSPITALITY' && role !== 'STAFF' ? 200 : 403;
      expect(own.status(), `${vertical}/${role} Website`).toBe(expected);
      const day = await request.get(`${qa}${report}`, { headers });
      expect(day.status(), `${vertical}/${role} report`).toBe(200);
      for (const invalid of [
        `business=${other.businessId};location=${other.locationId}`,
        'invalid-pointer',
      ]) {
        const denied = await request.get(`${qa}/marketing/site`, {
          headers: { ...headers, 'x-wetop-scope': invalid },
        });
        expect(denied.status(), `${vertical}/${role} invalid Website scope`).toBe(403);
      }
      evidence.push({
        vertical,
        role,
        website: own.status(),
        report: day.status(),
        invalidWebsite: '403',
        status: 'PASS',
      });
    }
    await db.membership.update({
      where: { userId_organizationId: { userId: f.userId, organizationId: f.organizationId } },
      data: { role: 'OWNER' },
    });
    await db.organization.update({
      where: { id: f.organizationId },
      data: { status: 'READ_ONLY' },
    });
    const deniedWrite = await request.post(`${qa}/marketing/site`, {
      headers: { 'x-wetop-session': token, 'x-wetop-scope': pointer },
      data: { slug: `synthetic-${randomUUID()}` },
    });
    expect(deniedWrite.status()).toBe(403);
    expect(
      await db.marketingSite.count({
        where: { location: { business: { organizationId: f.organizationId } } },
      }),
    ).toBe(0);
    evidence.push({ vertical, role: 'OWNER', readOnlyWrite: deniedWrite.status(), status: 'PASS' });
  }
  await writeFile(info.outputPath('scope-matrix.json'), JSON.stringify(evidence, null, 2));
});

test('T04 A4b observation: warm organization/business cache before archiving first Location', async ({
  request,
}, info) => {
  const f = await fixture(request, 'HOSPITALITY');
  const token = await session(request, f);
  const first = await db.property.findUniqueOrThrow({ where: { locationId: f.locationId } });
  const second = await db.$transaction((tx) =>
    createPropertyInChain(tx, f.organizationId, {
      name: 'Synthetic alternative active branch',
      ...NEW_PROPERTY_DEFAULTS,
    }),
  );
  const marker = await db.barProduct.create({
    data: {
      propertyId: first.id,
      code: `CACHE-${randomUUID()}`,
      name: 'Synthetic archived cache marker',
      salePrice: 1n,
      unitsPerPackage: 1,
      minimumStockUnits: 0n,
    },
  });
  const observations: object[] = [];
  try {
    for (const [scope, pointer] of [
      ['ORGANIZATION', undefined],
      ['BUSINESS', `business=${f.businessId}`],
    ] as const) {
      const headers = {
        'x-wetop-session': token,
        ...(pointer ? { 'x-wetop-scope': pointer } : {}),
      };
      const warm = await request.get(`${qa}/bar/products`, { headers });
      expect(warm.status()).toBe(200);
      expect((await warm.json()).some((row: { id: string }) => row.id === marker.id)).toBe(true);
      observations.push({ scope, phase: 'warm', status: warm.status() });
    }
    await db.location.update({ where: { id: f.locationId }, data: { status: 'ARCHIVED' } });
    for (const [scope, pointer] of [
      ['ORGANIZATION', undefined],
      ['BUSINESS', `business=${f.businessId}`],
    ] as const) {
      const headers = {
        'x-wetop-session': token,
        ...(pointer ? { 'x-wetop-scope': pointer } : {}),
      };
      const response = await request.get(`${qa}/bar/products`, { headers });
      const body = await response.json();
      const archivedVisible =
        Array.isArray(body) && body.some((row: { id: string }) => row.id === marker.id);
      observations.push({
        scope,
        phase: 'after_archive',
        http: response.status(),
        archivedVisible,
        activeAlternative: second.locationId,
        result: archivedVisible ? 'RISK_CONFIRMED' : 'POLICY_REVIEW_REQUIRED',
      });
    }
    expect((await db.location.findUniqueOrThrow({ where: { id: second.locationId } })).status).toBe(
      'ACTIVE',
    );
    await writeFile(
      info.outputPath('a4b-observation.json'),
      JSON.stringify({ acceptance: 'NOT_ACCEPTED', observations }, null, 2),
    );
  } finally {
    await db.barProduct.delete({ where: { id: marker.id } });
    await db.location.update({ where: { id: f.locationId }, data: { status: 'ACTIVE' } });
  }
});
