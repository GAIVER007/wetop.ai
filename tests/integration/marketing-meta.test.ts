import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { meta } from '@pms/integrations';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { MarketingCampaignsService } from '../../apps/api/src/marketing-budget/campaigns';
import { PrismaMarketingBudgetRepository } from '../../apps/api/src/marketing-budget/marketing-budget.repository';
import {
  MarketingMetaService,
  signMetaState,
  verifyMetaState,
  type MetaGateway,
} from '../../apps/api/src/marketing-budget/meta-connection';
import { purgeAuditRows } from '../tools/audit-purge';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Кабинет Meta (DATA_MODEL §55, ADR-MKT-META) на настоящей базе с поддельным шлюзом (сети нет): вход, ключ шифром,
 * сверка в §53 без дублей, след сверок, потеря доступа и предел площадки, отключение. Данные вымышленные (ADR-010).
 */
process.env.PII_ENCRYPTION_KEY ||= 'test-key-for-meta-integration-only';
const SECRET = 'app-secret-not-real';

class FakeGateway implements MetaGateway {
  days: meta.MetaCampaignDay[] = [];
  fail: meta.MetaApiError | null = null;
  tokens: string[] = [];
  config() {
    return { appId: '1', appSecret: SECRET, configId: '2', redirectUri: 'https://app.example.test/cb' };
  }
  async exchangeCode(code: string) {
    return `suat-for-${code}`;
  }
  assigned: meta.MetaAdAccount[] = [];
  async adAccount(token: string, id: string) {
    this.tokens.push(token);
    return { accountId: id, name: 'Отель на Абая', currency: 'USD', timezone: 'Asia/Almaty', active: true };
  }
  async assignedAdAccounts(token: string) {
    this.tokens.push(token);
    return this.assigned;
  }
  async campaignDays(token: string) {
    this.tokens.push(token);
    if (this.fail) throw this.fail;
    return this.days;
  }
}

describe('кабинет Meta (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Кабинет проверяется только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const db = prisma.db;
  const repo = new PrismaMarketingBudgetRepository(prisma);
  const gateway = new FakeGateway();
  const service = new MarketingMetaService(prisma, repo, gateway);
  const campaigns = new MarketingCampaignsService(prisma, repo);
  const tag = randomUUID().slice(0, 8);
  const user = randomUUID();
  const org = randomUUID();
  const branch = { own: { business: randomUUID(), location: randomUUID() }, other: { business: randomUUID(), location: randomUUID() } };
  const as = <T>(b: keyof typeof branch, fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: user, organizationId: org, scope: 'LOCATION', businessId: branch[b].business, locationId: branch[b].location, vertical: 'HOSPITALITY' },
      fn,
    );
  const day = (date: string, over: Partial<meta.MetaCampaignDay> = {}): meta.MetaCampaignDay => ({
    externalCampaignId: '120200000000001',
    campaignName: 'Осень: лиды',
    date,
    impressions: 25000,
    clicks: 300,
    leads: 12,
    spendMinor: 533950n,
    currency: 'USD',
    ...over,
  });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());

  beforeAll(async () => {
    await db.user.create({ data: { id: user, email: `mkt-meta-${tag}@example.invalid` } });
    await db.organization.create({ data: { id: org, name: `Кабинет ${tag}`, status: 'ACTIVE' } });
    for (const b of ['own', 'other'] as const) {
      await db.business.create({ data: { id: branch[b].business, organizationId: org, name: `${b} ${tag}`, vertical: 'HOSPITALITY' } });
      await db.location.create({ data: { id: branch[b].location, businessId: branch[b].business, name: `${b} ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
    }
  });

  afterAll(async () => {
    const locs = [branch.own.location, branch.other.location];
    const conns = await db.marketingAdConnection.findMany({ where: { locationId: { in: locs } }, select: { id: true } });
    await purgeAuditRows(db, { entityId: { in: conns.map((c) => c.id) } });
    await db.$transaction([
      db.marketingSyncRun.deleteMany({ where: { connectionId: { in: conns.map((c) => c.id) } } }),
      db.marketingAdConnection.deleteMany({ where: { locationId: { in: locs } } }),
      db.marketingCampaignStat.deleteMany({ where: { campaign: { locationId: { in: locs } } } }),
      db.marketingCampaign.deleteMany({ where: { locationId: { in: locs } } }),
    ]);
    await db.location.deleteMany({ where: { business: { organizationId: org } } });
    await db.business.deleteMany({ where: { organizationId: org } });
    await db.organization.deleteMany({ where: { id: org } });
    await db.user.deleteMany({ where: { id: user } });
    await prisma.onModuleDestroy();
  });

  it('state: подпись, срок, подмена отклоняются', () => {
    const s = signMetaState({ o: 'o', l: 'l', u: 'u', a: '1' }, SECRET, 1_000);
    expect(verifyMetaState(s, SECRET, 2_000)).toMatchObject({ o: 'o', l: 'l', u: 'u', a: '1' });
    expect(verifyMetaState(s, SECRET, 1_000 + 11 * 60_000)).toBeNull(); // просрочен
    expect(verifyMetaState(s, 'другой секрет', 2_000)).toBeNull();
    const [body, sig] = s.split('.');
    const forged = Buffer.from(JSON.stringify({ o: 'x', l: 'l', u: 'u', a: '1', e: 9e15, n: '0' })).toString('base64url');
    expect(verifyMetaState(`${forged}.${sig}`, SECRET, 2_000)).toBeNull();
    expect(verifyMetaState(`${body}`, SECRET, 2_000)).toBeNull();
  });

  it('вход: state другого филиала не принимается; свой подключает кабинет, ключ шифром, первая сверка', async () => {
    gateway.days = [day(today), day(today, { externalCampaignId: '120200000000002', campaignName: 'Осень: лиды', leads: 0, spendMinor: 0n })];
    const { url: dialog } = await as('own', () => service.start({ adAccountId: 'act_1234567890' }));
    const state = new URL(dialog).searchParams.get('state')!;
    await expect(as('other', () => service.complete({ code: 'c1', state }))).rejects.toMatchObject({ status: 403 });

    await as('own', () => service.complete({ code: 'c1', state }));
    const conn = await db.marketingAdConnection.findFirstOrThrow({ where: { locationId: branch.own.location } });
    expect(conn).toMatchObject({ adAccountId: '1234567890', currency: 'USD', status: 'ACTIVE' });
    expect(conn.tokenCiphertext.startsWith('v1:')).toBe(true);
    expect(conn.tokenCiphertext).not.toContain('suat-for-c1');
    expect(gateway.tokens.at(-1)).toBe('suat-for-c1'); // сверка расшифровала тот же ключ

    // две кампании с одинаковым именем из кабинета: разрешено, у каждой свой номер
    const list = await as('own', () => campaigns.list(today.slice(0, 7)));
    expect(list.campaigns.map((c) => [c.name, c.fromCabinet, c.cabinetSpend, c.cabinetCurrency, c.leads]).sort()).toEqual([
      ['Осень: лиды', true, '0', 'USD', 0],
      ['Осень: лиды', true, '533950', 'USD', 12],
    ]);
    const view = await as('own', () => service.view());
    expect(view.connection).toMatchObject({ accountName: 'Отель на Абая', lastError: null });
    expect(JSON.stringify(view)).not.toContain('v1:');
  });

  it('повтор сверки не дублирует; потеря доступа: сбой и «подключите заново»; предел: повторим позже', async () => {
    gateway.days = [day(today, { impressions: 30000, clicks: 330 })];
    expect((await as('own', () => service.syncNow())).ok).toBe(true);
    expect((await as('own', () => service.syncNow())).ok).toBe(true);
    const stats = await db.marketingCampaignStat.findMany({ where: { campaign: { locationId: branch.own.location, externalId: '120200000000001' } } });
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ impressions: 30000, clicks: 330, source: 'META' });

    gateway.fail = new meta.MetaApiError('Meta: limit', 4, true);
    const limited = await as('own', () => service.syncNow());
    expect(limited.error).toContain('повторим позже');
    expect(await db.marketingAdConnection.findFirstOrThrow({ where: { locationId: branch.own.location } })).toMatchObject({ status: 'ACTIVE' });

    gateway.fail = new meta.MetaApiError('Meta: token expired', 190, false);
    const lost = await as('own', () => service.syncNow());
    expect(lost.error).toContain('подключите заново');
    expect(await db.marketingAdConnection.findFirstOrThrow({ where: { locationId: branch.own.location } })).toMatchObject({ status: 'FAILED' });
    // ночной проход берёт только действующие кабинеты
    expect((await service.syncAll()).connections).toBe(0);
    gateway.fail = null;

    const runs = await db.marketingSyncRun.findMany({ where: { connection: { locationId: branch.own.location } }, orderBy: { startedAt: 'asc' } });
    expect(runs.map((r) => r.status)).toEqual(['OK', 'OK', 'OK', 'FAILED', 'FAILED']);
    expect(runs.every((r) => r.finishedAt !== null)).toBe(true);
  });

  it('отключение стирает ключ, кампании и дни остаются; ручная правка кабинетной кампании закрыта', async () => {
    await as('own', () => service.disconnect());
    const conn = await db.marketingAdConnection.findFirstOrThrow({ where: { locationId: branch.own.location } });
    expect(conn).toMatchObject({ status: 'DISCONNECTED', tokenCiphertext: '' });
    expect((await as('own', () => service.view())).connection).toBeNull();
    expect(await db.marketingCampaign.count({ where: { locationId: branch.own.location, externalId: { not: null } } })).toBe(2);
    await expect(as('own', () => service.syncNow())).rejects.toMatchObject({ status: 404 });
  });

  it('простой вход (без номера): один отмеченный кабинет сразу, несколько на выбор, ни одного: отказ словами', async () => {
    const account = (id: string, active = true): meta.MetaAdAccount => ({ accountId: id, name: `Кабинет ${id}`, currency: 'KZT', timezone: 'Asia/Almaty', active });
    const login = async () => new URL((await as('own', () => service.start({}))).url).searchParams.get('state')!;

    gateway.assigned = [account('5550001', false)];
    await expect(as('own', async () => service.complete({ code: 'c2', state: await login() }))).rejects.toMatchObject({ status: 409 });

    gateway.assigned = [account('5550001'), account('5550002', false)];
    expect(await as('own', async () => service.complete({ code: 'c3', state: await login() }))).toMatchObject({ connected: true });
    expect(await db.marketingAdConnection.findFirstOrThrow({ where: { locationId: branch.own.location } })).toMatchObject({
      adAccountId: '5550001',
      status: 'ACTIVE',
    });

    gateway.assigned = [account('5550001'), account('5550003')];
    const r = await as('own', async () => service.complete({ code: 'c4', state: await login() }));
    expect(r.connected).toBe(false);
    if (r.connected) return;
    expect(r.accounts.map((a) => a.adAccountId)).toEqual(['5550001', '5550003']);
    expect(r.pending).not.toContain('suat-for-c4'); // ключ только внутри шифра
    // заготовка другого филиала и подделка не принимаются
    await expect(as('other', () => service.choose({ pending: r.pending, adAccountId: '5550003' }))).rejects.toMatchObject({ status: 403 });
    await expect(as('own', () => service.choose({ pending: 'v1:a:b:c', adAccountId: '5550003' }))).rejects.toMatchObject({ status: 403 });
    expect(await as('own', () => service.choose({ pending: r.pending, adAccountId: '5550003' }))).toMatchObject({ connected: true });
    expect(await db.marketingAdConnection.findFirstOrThrow({ where: { locationId: branch.own.location } })).toMatchObject({
      adAccountId: '5550003',
    });
    expect(gateway.tokens.at(-1)).toBe('suat-for-c4');
  });
});

