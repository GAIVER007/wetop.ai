import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationsService, clearOrganizationsCache } from './organizations.service';
import type {
  AuditRow,
  CreatedOrganization,
  OrganizationsRepository,
  RawMetrics,
  TreeOrganization,
} from './organizations.repository';
import { withSignedInUser } from '../auth/request-context';

const ORG = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const ADMIN = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const body = {
  id: ORG,
  name: 'Luxx Group',
  brand: 'Luxx',
  vertical: 'HOSPITALITY',
  ownerName: 'Вячеслав Пример',
  ownerEmail: 'owner@example.invalid',
  phoneCountry: 'KZ',
  ownerPhone: '+7 700 123 45 67',
  country: 'KZ',
  city: 'Алматы',
  timezone: 'Asia/Almaty',
  currency: 'KZT',
};

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const tree: TreeOrganization[] = [
  {
    id: 'o1',
    name: 'Luxx',
    status: 'ACTIVE',
    createdAt: day('2026-08-01'),
    owners: ['a@example.invalid'],
    businesses: [
      { id: 'b-h', name: 'Luxx Aparts', vertical: 'HOSPITALITY' },
      { id: 'b-s', name: 'Aiva', vertical: 'BEAUTY' },
      { id: 'b-r', name: 'Mondo', vertical: 'FOOD_SERVICE' },
    ],
    locations: [
      { id: 'l-h', businessId: 'b-h', propertyId: 'p1', name: 'Luxx Центр', address: null, currency: 'KZT', timezone: 'Asia/Almaty', vertical: 'HOSPITALITY' },
      { id: 'l-s', businessId: 'b-s', propertyId: null, name: 'Aiva Центр', address: null, currency: 'KZT', timezone: 'Asia/Almaty', vertical: 'BEAUTY' },
      { id: 'l-r', businessId: 'b-r', propertyId: null, name: 'Mondo', address: null, currency: 'USD', timezone: 'Asia/Almaty', vertical: 'FOOD_SERVICE' },
    ],
  },
];

class FakeRepo {
  created: unknown[] = [];
  next: CreatedOrganization = { organizationId: ORG, replay: false, newOwner: { email: 'owner@example.invalid' }, ownerOtherOrganizations: 0 };
  salonCalls: Array<{ from: string; to: string }> = [];
  async create(input: unknown) {
    this.created.push(input);
    return this.next;
  }
  async tree() {
    return tree;
  }
  async salonMonths(ids: string[], range: { from: string; to: string }): Promise<RawMetrics[]> {
    this.salonCalls.push(range);
    if (!ids.length) return [];
    // текущее окно: 5 000 000 минорных за 12 записей; прошлое: 2 500 000
    return range.from === '2026-10-01'
      ? [{ locationId: 'l-s', month: '2026-10', revenueMinor: 5_000_000, bookings: 12, guests: 9 }]
      : [{ locationId: 'l-s', month: '2026-09', revenueMinor: 2_500_000, bookings: 6, guests: 5 }];
  }
  async restaurantMonths(ids: string[], range: { from: string; to: string }): Promise<RawMetrics[]> {
    if (!ids.length) return [];
    return range.from === '2026-10-01'
      ? [{ locationId: 'l-r', month: '2026-10', revenueMinor: 0, bookings: 20, guests: 64 }]
      : [];
  }
  async activity(): Promise<AuditRow[]> {
    return [
      { id: 'a1', action: 'user.login', after: {}, createdAt: day('2026-10-09'), organizationId: 'o1', organizationName: 'Luxx' },
      { id: 'a2', action: 'organization.created', after: { name: 'Luxx' }, createdAt: day('2026-10-08'), organizationId: 'o1', organizationName: 'Luxx' },
    ];
  }
}

const period = (revenue: string, occupied: number, units: number, guests: number) => ({
  revenue: { totalMinor: revenue },
  occupancy: { occupiedNights: occupied, unitNights: units },
  arrivals: { guests, count: guests },
});

let repo: FakeRepo;
const access = { sendAccess: vi.fn(async () => true) };
const dashboard = {
  dashboard: vi.fn(async () => ({ current: period('9000000', 30, 100, 40), previous: period('6000000', 20, 100, 30) })),
};
const service = () =>
  new OrganizationsService(repo as unknown as OrganizationsRepository, dashboard as never, access as never);
const asAdmin = <T>(fn: () => Promise<T>) =>
  withSignedInUser({ userId: ADMIN, organizationId: null, platformAdmin: true }, fn);

beforeEach(() => {
  repo = new FakeRepo();
  clearOrganizationsCache();
  access.sendAccess.mockClear();
  dashboard.dashboard.mockClear();
});

describe('создание организации', () => {
  it('новому владельцу уходит письмо со ссылкой, организация создаётся без пробного периода', async () => {
    const out = await asAdmin(() => service().create(body));
    expect(out).toEqual({ organizationId: ORG, replay: false, mailSent: true, ownerOtherOrganizations: 0 });
    expect(access.sendAccess).toHaveBeenCalledWith('owner@example.invalid', 'Вячеслав Пример');
    expect(JSON.stringify(repo.created)).not.toMatch(/trial/i);
  });

  it('учётная запись уже есть: письма нет, доступ открыт членством', async () => {
    repo.next = { organizationId: ORG, replay: false, newOwner: null, ownerOtherOrganizations: 1 };
    const out = await asAdmin(() => service().create(body));
    expect(out.mailSent).toBeNull();
    // главный администратор узнаёт, что у этой почты уже есть другая организация
    expect(out.ownerOtherOrganizations).toBe(1);
    expect(access.sendAccess).not.toHaveBeenCalled();
  });

  it('повтор запроса письмо второй раз не шлёт', async () => {
    repo.next = { organizationId: ORG, replay: true, newOwner: null, ownerOtherOrganizations: 0 };
    expect((await asAdmin(() => service().create(body))).replay).toBe(true);
    expect(access.sendAccess).not.toHaveBeenCalled();
  });

  it('письмо не ушло: организация создана, ответ говорит об этом', async () => {
    access.sendAccess.mockResolvedValueOnce(false);
    expect((await asAdmin(() => service().create(body))).mailSent).toBe(false);
  });

  it('плохой ввод: 400 со всеми ошибками, в базу ничего не пишется', async () => {
    await expect(asAdmin(() => service().create({ ...body, ownerEmail: 'x', currency: 'XXX' }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.created).toHaveLength(0);
  });
});

describe('сквозной обзор', () => {
  const run = () => asAdmin(() => service().overview('2026-10', new Date('2026-10-09T08:00:00Z')));

  it('каждое направление считается своим источником, ресторан без дохода это null, а не ноль', async () => {
    const [org] = (await run()).organizations;
    const by = Object.fromEntries(org!.branches.map((b) => [b.id, b]));
    expect(by['l-h']!.metrics).toMatchObject({ revenueMinor: 9_000_000, occupiedNights: 30, unitNights: 100, guests: 40 });
    expect(by['l-h']!.previous.revenueMinor).toBe(6_000_000);
    expect(by['l-s']!.metrics).toMatchObject({ revenueMinor: 5_000_000, bookings: 12, guests: 9, occupiedNights: null });
    expect(by['l-s']!.previous.revenueMinor).toBe(2_500_000);
    expect(by['l-r']!.metrics).toMatchObject({ revenueMinor: null, bookings: 20, guests: 64 });
  });

  it('отчёт гостиницы берётся тем же дашбордом за те же даты, что и у остальных', async () => {
    await run();
    expect(dashboard.dashboard).toHaveBeenCalledWith('2026-10-01', '2026-10-09');
  });

  it('в журнал попадают только известные действия, организации новее 30 дней считаются новыми', async () => {
    const out = await run();
    expect(out.activity.map((a) => a.label)).toEqual(['Новая организация']);
    expect(out.newOrganizations).toBe(0);
  });

  it('без администратора платформы сквозной отчёт не открывается вовсе', async () => {
    await expect(
      withSignedInUser({ userId: ADMIN, organizationId: null }, () =>
        service().overview('2026-10', new Date('2026-10-09T08:00:00Z')),
      ),
    ).rejects.toThrow(/только для главного администратора/);
  });
});
