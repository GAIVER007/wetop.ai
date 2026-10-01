import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { CallHandler, ExecutionContext, INestApplication, NestInterceptor } from '@nestjs/common';
import { from, lastValueFrom } from 'rxjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BranchInput, DashboardPeriod } from '@pms/domain';
import { buildDashboard } from '@pms/domain';
import { currentLocationId, withSignedInUser } from '../auth/request-context';
import { DashboardService } from '../dashboard/dashboard.service';
import { PrismaService } from '../database/prisma.provider';
import { forgetPropertyRef } from '../database/property-ref';
import { OrganizationController } from './organization.controller';
import {
  ORGANIZATION_REPOSITORY,
  type BranchRow,
  type OrganizationRepository,
  type OrganizationStructure,
} from './organization.repository';
import {
  BRANCH_NAMESAKE_MESSAGE,
  BRANCH_OWNER_ONLY_MESSAGE,
  OrganizationService,
} from './organization.service';

/**
 * Компания и филиалы (Platform P3, ADR-130; план `plans/platform-p3-branches-2026-10-01.md` §3): структура с текущим
 * филиалом, новый филиал одной транзакцией с умолчаниями первого, тёзка — 409, не владелец — 403, сводка по филиалам
 * в scope каждого и итог. Замок ролей на маршрутах стоит в приложении отдельно (`route-access.test.ts`); здесь роль
 * вошедшего подставляется контекстом, как её ставит `AuthorInterceptor` в приложении.
 */
const ORG = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const BUSINESS = '11111111-1111-4111-8111-111111111111';
const L1 = '22222222-2222-4222-8222-222222222222';
const L2 = '33333333-3333-4333-8333-333333333333';
const P1 = '44444444-4444-4444-8444-444444444444';
const P2 = '55555555-5555-4555-8555-555555555555';

const branch = (id: string, name: string, propertyId: string, currency = 'KZT'): BranchRow => ({
  id,
  businessId: BUSINESS,
  name,
  address: null,
  phone: null,
  email: null,
  timezone: 'Asia/Almaty',
  currency,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  property: { id: propertyId, name },
});

class FakeOrganizationRepository implements OrganizationRepository {
  structureRow: OrganizationStructure | null = null;
  created: Array<{ organizationId: string; input: BranchInput }> = [];
  async structure(organizationId: string) {
    return this.structureRow && this.structureRow.id === organizationId ? this.structureRow : null;
  }
  async namesake(_organizationId: string, name: string) {
    return (
      this.structureRow?.businesses.some((b) =>
        b.locations.some((l) => l.name.toLowerCase() === name.toLowerCase()),
      ) ?? false
    );
  }
  async createBranch(organizationId: string, input: BranchInput) {
    this.created.push({ organizationId, input });
    const row = branch('66666666-6666-4666-8666-666666666666', input.name, '77777777-7777-4777-8777-777777777777', input.currency);
    row.timezone = input.timezone;
    row.address = input.address;
    this.structureRow!.businesses[0]!.locations.push(row);
    return row;
  }
}

/** Показатели «объекта» по scope: подставной дашборд отвечает по филиалу текущего контекста */
const periodFor = (locationId: string | null): DashboardPeriod => {
  const units = locationId === L2 ? 20 : 10;
  const occupied = locationId === L2 ? 20 : 5;
  return buildDashboard({
    from: '2026-10-01',
    to: '2026-10-02',
    categories: [{ code: 'STD', name: 'Стандарт', units, kind: 'ROOM' }],
    days: ['2026-10-01', '2026-10-02'].map((date) => ({
      date,
      occupied,
      free: units - occupied,
      blocked: 0,
      byCategory: { STD: { units, occupied, free: units - occupied, blocked: 0 } },
    })),
    unassignedByCategory: {},
    stays: [],
    charges: [
      {
        kind: 'ACCOMMODATION',
        amountMinor: locationId === L2 ? 400_000n : 100_000n,
        categoryCode: 'STD',
        serviceDate: '2026-10-01',
      },
    ],
    payments: [],
    refundsMinor: 0n,
  });
};

class ActorInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return from(withSignedInUser(signedIn, () => lastValueFrom(next.handle())));
  }
}

let app: INestApplication;
let repo: FakeOrganizationRepository;
const scopes: Array<string | null> = [];
const actor = { userId: 'u-1', organizationId: ORG, role: 'OWNER' as const };
let signedIn: typeof actor | null = actor;

beforeAll(async () => {
  repo = new FakeOrganizationRepository();
  // объект при scope ORGANIZATION — самый ранний объект организации, как в `property-ref.ts`
  const prisma = {
    db: {
      property: {
        findFirst: vi.fn(async (args: { where: { locationId?: string } }) =>
          args.where.locationId === L2
            ? { id: P2, name: 'Astana', organizationId: ORG, timezone: 'Asia/Almaty' }
            : { id: P1, name: 'Almaty', organizationId: ORG, timezone: 'Asia/Almaty' },
        ),
      },
    },
  };
  const dashboard = {
    checkPeriod: new DashboardService({} as never).checkPeriod,
    period: vi.fn(async () => {
      const locationId = currentLocationId();
      scopes.push(locationId);
      return periodFor(locationId);
    }),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [OrganizationController],
    providers: [
      OrganizationService,
      { provide: ORGANIZATION_REPOSITORY, useValue: repo },
      { provide: PrismaService, useValue: prisma },
      { provide: DashboardService, useValue: dashboard },
    ],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  // контекст запроса — как его ставит `AuthorInterceptor` в приложении: кто вошёл и его роль
  app.useGlobalInterceptors(new ActorInterceptor());
  await app.init();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  forgetPropertyRef();
  scopes.length = 0;
  signedIn = actor;
  repo.created = [];
  repo.structureRow = {
    id: ORG,
    name: 'Luxx Group',
    reportingCurrency: 'KZT',
    businesses: [
      {
        id: BUSINESS,
        name: 'Luxx Hotels',
        vertical: 'HOSPITALITY',
        locations: [branch(L1, 'Almaty', P1), branch(L2, 'Astana', P2)],
      },
    ],
  };
});

const api = () => request(app.getHttpServer());

describe('GET /organization — структура и текущий филиал', () => {
  it('без указателя текущий — филиал самого раннего объекта; владельцу можно добавлять', async () => {
    const res = await api().get('/organization').expect(200);
    expect(res.body.name).toBe('Luxx Group');
    expect(res.body.businesses[0].locations.map((l: { name: string }) => l.name)).toEqual(['Almaty', 'Astana']);
    expect(res.body.current).toEqual({
      business: { id: BUSINESS, name: 'Luxx Hotels' },
      location: { id: L1, name: 'Almaty' },
      options: [
        { businessId: BUSINESS, businessName: 'Luxx Hotels', locationId: L1, locationName: 'Almaty' },
        { businessId: BUSINESS, businessName: 'Luxx Hotels', locationId: L2, locationName: 'Astana' },
      ],
    });
    expect(res.body.canAddBranch).toEqual({ ok: true });
  });

  it('управляющему структура видна, а добавлять нельзя — причина словами', async () => {
    signedIn = { ...actor, role: 'MANAGER' as never };
    const res = await api().get('/organization').expect(200);
    expect(res.body.canAddBranch).toEqual({ ok: false, reason: BRANCH_OWNER_ONLY_MESSAGE });
  });

  it('служебный ходок без организации структуры не получает', async () => {
    signedIn = null;
    await api().get('/organization').expect(403);
  });
});

describe('POST /organization/locations — новый филиал', () => {
  it('создаётся в цепочке с умолчаниями первого филиала, ответ — филиал с объектом', async () => {
    const res = await api().post('/organization/locations').send({ name: '  Luxx  Shymkent ' }).expect(201);
    expect(repo.created).toEqual([
      {
        organizationId: ORG,
        input: {
          name: 'Luxx Shymkent',
          address: null,
          phone: null,
          email: null,
          timezone: 'Asia/Almaty',
          currency: 'KZT',
        },
      },
    ]);
    expect(res.body).toMatchObject({ name: 'Luxx Shymkent', currency: 'KZT', propertyName: 'Luxx Shymkent' });
    expect(typeof res.body.id).toBe('string');
  });

  it('тёзка без учёта регистра — 409 с полем', async () => {
    const res = await api().post('/organization/locations').send({ name: 'astana' }).expect(409);
    expect(res.body).toMatchObject({ message: BRANCH_NAMESAKE_MESSAGE, field: 'name' });
    expect(repo.created).toHaveLength(0);
  });

  it('ошибка разбора — 400 с полем, ничего не создано', async () => {
    const res = await api()
      .post('/organization/locations')
      .send({ name: 'Marina', timezone: 'Mars/Olympus' })
      .expect(400);
    expect(res.body).toMatchObject({ field: 'timezone' });
    expect(repo.created).toHaveLength(0);
  });

  it('не владелец — 403, даже если замок маршрута обошли', async () => {
    signedIn = { ...actor, role: 'MANAGER' as never };
    const res = await api().post('/organization/locations').send({ name: 'Marina' }).expect(403);
    expect(res.body.message).toBe(BRANCH_OWNER_ONLY_MESSAGE);
    expect(repo.created).toHaveLength(0);
  });
});

describe('GET /organization/summary — по филиалам и итог', () => {
  it('каждый филиал считается в своём scope, итог — по правилу домена', async () => {
    const res = await api().get('/organization/summary?from=2026-10-01&to=2026-10-02').expect(200);
    expect(scopes).toEqual([L1, L2]);
    expect(res.body.branches.map((b: { name: string; current: boolean }) => [b.name, b.current])).toEqual([
      ['Almaty', true],
      ['Astana', false],
    ]);
    expect(res.body.branches[0].period.occupancy.percent).toBe(50);
    expect(res.body.branches[1].period.occupancy.percent).toBe(100);
    expect(res.body.total).toEqual({
      branches: 2,
      occupancy: { unitNights: 60, occupiedNights: 50, blockedNights: 0, freeNights: 10, percent: 83.3 },
      arrivals: 0,
      bookings: 0,
      money: [
        {
          currency: 'KZT',
          revenueMinor: '500000',
          paymentsMinor: '0',
          refundsMinor: '0',
          adrMinor: '10000',
          revparMinor: '8333',
        },
      ],
    });
  });

  it('период проверяется как у «Обзора»', async () => {
    await api().get('/organization/summary?from=2026-10-02&to=2026-10-01').expect(400);
    await api().get('/organization/summary').expect(400);
  });
});
