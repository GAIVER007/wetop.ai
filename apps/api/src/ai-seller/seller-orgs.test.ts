import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SELLER_PROFILE, type SellerFactsSource } from '@pms/domain';
import { withSignedInUser } from '../auth/request-context';
import {
  FakeAudit,
  FakeConnection,
  FakeFacts,
  FakeOrgs,
  FakeProfiles,
  FakeSellerExtensions,
  unavailable,
} from './fakes';
import type { SellerConfig } from './seller.connection';
import { SellerService } from './seller.service';

/**
 * Э4 (ADR-083, Q-181 (б)): один продавец обслуживает все гостиницы. Сверка обходит организации со строкой расширения:
 * гостиница (имя, active, домены, публичный ключ) уходит продавцу всегда — упавший бот догонит; профиль и факты —
 * только действующим. `SELLER_ORGANIZATION_ID` снят: клиент панели зовётся с организацией вызова.
 */

const ORG_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const KEY = 'seller-service-key-for-run-0123456789';

const config = (): SellerConfig => ({
  baseUrl: 'http://seller:8000/panel-x',
  serviceKey: KEY,
  publicUrl: 'https://prodavets.wetop.ai',
  syncEnabled: true,
});

const source = (): SellerFactsSource => ({
  property: {
    name: 'Тестовый хостел',
    address: null,
    timezone: 'Asia/Almaty',
    currency: 'KZT',
    checkInTime: '14:00',
    checkOutTime: '12:00',
  },
  categories: [
    { code: 'DBL', name: 'Двухместная', kind: 'PRIVATE_ROOM', capacityAdults: 2, units: 4 },
  ],
  ratePlan: { code: 'BASE', name: 'Базовый тариф', currency: 'KZT' },
  rates: [{ categoryCode: 'DBL', date: '2026-09-25', occupancy: 2, priceMinor: 1_500_000n }],
  window: { from: '2026-09-24', to: '2026-11-22' },
});

const orgKey = (org: string): string =>
  'sk_' + createHmac('sha256', KEY).update(`seller-widget|${org}`).digest('hex').slice(0, 24);

let connection: FakeConnection;
let profiles: FakeProfiles;
let facts: FakeFacts;
let extensions: FakeSellerExtensions;
let orgs: FakeOrgs;
let service: SellerService;

const now = new Date('2026-09-25T09:00:00Z');

beforeEach(() => {
  connection = new FakeConnection(config());
  profiles = new FakeProfiles();
  facts = new FakeFacts();
  facts.source = source();
  extensions = new FakeSellerExtensions();
  orgs = new FakeOrgs();
  orgs.rows = [
    { organizationId: ORG_A, name: 'Гостиница А' },
    { organizationId: ORG_B, name: 'Гостиница Б' },
  ];
  orgs.siteHosts.set(ORG_A, ['hotel-a.example.test']);
  service = new SellerService(
    connection,
    profiles,
    facts,
    new FakeAudit(),
    extensions as never,
    orgs,
  );
});

const putOrgs = () =>
  connection.seller.calls
    .filter((c) => c.op === 'putOrganization')
    .map((c) => ({ id: c.args[0], body: c.args[1] }));

describe('SellerService.syncOnce — обход организаций (Э4)', () => {
  it('гостиница уходит каждой организации со строкой расширения: имя, active, домены, ключ', async () => {
    await profiles.save(ORG_A, DEFAULT_SELLER_PROFILE, null, now);
    const result = await service.syncOnce(now);
    expect(result).toEqual({ organizations: 2, profile: 1, facts: 1, failed: [] });
    expect(putOrgs()).toEqual([
      {
        id: ORG_A,
        body: {
          name: 'Гостиница А',
          publicKey: orgKey(ORG_A),
          active: true,
          hosts: ['hotel-a.example.test'],
        },
      },
      { id: ORG_B, body: { name: 'Гостиница Б', publicKey: orgKey(ORG_B), active: true, hosts: [] } },
    ]);
    // профиль и факты — только там, где он сохранён (у Б профиля нет)
    expect(connection.seller.ops().filter((op) => op === 'putProfile')).toHaveLength(1);
    // клиент каждой отправки зовётся с её организацией
    expect(connection.requestedOrgs).toEqual([ORG_A, ORG_B]);
  });

  it('расширение кончилось — гостиница уходит с active=false, профиль не шлётся (Q-183)', async () => {
    await profiles.save(ORG_A, DEFAULT_SELLER_PROFILE, null, now);
    extensions.access = 'expired';
    const result = await service.syncOnce(now);
    expect(result).toEqual({ organizations: 2, profile: 0, facts: 0, failed: [] });
    expect(putOrgs().map((c) => (c.body as { active: boolean }).active)).toEqual([false, false]);
    expect(connection.seller.ops()).not.toContain('putProfile');
  });

  it('отказ одной гостиницы не останавливает остальные', async () => {
    await profiles.save(ORG_A, DEFAULT_SELLER_PROFILE, null, now);
    await profiles.save(ORG_B, DEFAULT_SELLER_PROFILE, null, now);
    connection.seller.failOn.putProfile = unavailable();
    const result = await service.syncOnce(now);
    if ('skipped' in result) throw new Error('сверка не должна была пропустить проход');
    expect(result.organizations).toBe(2);
    expect(result.failed).toHaveLength(2); // у обеих упал putProfile, но обе прошли обход
    expect(putOrgs()).toHaveLength(2);
    expect((await profiles.get(ORG_A))!.lastError).toContain('ИИ-продавец');
  });

  it('без адреса и ключа — ничего не делает, как раньше', async () => {
    connection.settings = { ...config(), baseUrl: null };
    expect(await service.syncOnce(now)).toEqual({ skipped: 'not-configured' });
    expect(connection.seller.ops()).toEqual([]);
  });
});

describe('SellerService.pushOrganization — смена расширения (Э4)', () => {
  it('гостиница уходит продавцу сразу, лучшим усилием', async () => {
    expect(await service.pushOrganization(ORG_A, now)).toBe(true);
    expect(putOrgs()).toEqual([
      {
        id: ORG_A,
        body: {
          name: 'Гостиница А',
          publicKey: orgKey(ORG_A),
          active: true,
          hosts: ['hotel-a.example.test'],
        },
      },
    ]);
  });

  it('продавец недоступен — false, не исключение: сверка догонит', async () => {
    connection.seller.failOn.putOrganization = unavailable();
    expect(await service.pushOrganization(ORG_A, now)).toBe(false);
  });
});

describe('SellerService.embed — код для сайта с ключом гостиницы (Э4)', () => {
  const asOwner = <T>(fn: () => Promise<T>): Promise<T> =>
    withSignedInUser({ userId: 'u-1', organizationId: ORG_A, role: 'OWNER' }, fn);

  it('тег несёт data-key своей организации и список её доменов', async () => {
    const embed = await asOwner(() => service.embed(now));
    expect(embed.snippet).toBe(
      `<script async src="https://prodavets.wetop.ai/widget/widget.js" data-key="${orgKey(ORG_A)}"></script>`,
    );
    expect(embed.hosts).toEqual(['hotel-a.example.test']);
  });

  it('публичного адреса нет — тега нет', async () => {
    connection.settings = { ...config(), publicUrl: null };
    const embed = await asOwner(() => service.embed(now));
    expect(embed.snippet).toBeNull();
  });
});
