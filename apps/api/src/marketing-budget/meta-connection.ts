import 'reflect-metadata';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  Post,
  ServiceUnavailableException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { meta } from '@pms/integrations';
import { decryptPii, encryptPii } from '@pms/shared';
import { auditUserId } from '../accounts/actor';
import { Access } from '../auth/access.decorator';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { MARKETING_BUDGET_REPOSITORY, type MarketingBudgetRepository } from './marketing-budget.repository';

/**
 * Рекламный кабинет Meta филиала (DATA_MODEL §55, ADR-MKT-META, план `plans/marketing-meta-ads-integration-2026-10-16.md`):
 * вход через Facebook Login for Business, ключ SUAT только шифром, сверка кампаний по дням в §53 (источник `META`) ночью
 * и по кнопке. Код площадки только в `@pms/integrations` (ADR-004); здесь шлюз, который тесты подменяют.
 */
export const META_GATEWAY = Symbol('META_GATEWAY');

export interface MetaGateway {
  /** null: приложение Meta не настроено (владелец не вписал ключи в .env) */
  config(): meta.MetaAppConfig | null;
  exchangeCode(code: string): Promise<string>;
  adAccount(token: string, adAccountId: string): Promise<meta.MetaAdAccount>;
  /** Кабинеты, отмеченные клиентом в окне входа */
  assignedAdAccounts(token: string): Promise<meta.MetaAdAccount[]>;
  campaignDays(token: string, q: { adAccountId: string; since: string; until: string }): Promise<meta.MetaCampaignDay[]>;
}

/** Настоящий шлюз: ключи приложения из окружения (SECURITY.md §3) */
export class EnvMetaGateway implements MetaGateway {
  config() {
    return meta.metaAppConfigFromEnv(process.env);
  }
  exchangeCode(code: string) {
    const c = this.config();
    if (!c) throw new ServiceUnavailableException('Приложение Meta не настроено');
    return meta.exchangeMetaCode({ ...c, code });
  }
  adAccount(token: string, adAccountId: string) {
    return new meta.MetaAdsClient({ accessToken: token }).adAccount(adAccountId);
  }
  assignedAdAccounts(token: string) {
    return new meta.MetaAdsClient({ accessToken: token }).assignedAdAccounts();
  }
  campaignDays(token: string, q: { adAccountId: string; since: string; until: string }) {
    return new meta.MetaAdsClient({ accessToken: token }).campaignDays(q);
  }
}

const STATE_TTL_MS = 10 * 60_000;
const ACCOUNT = /^(?:act_)?(\d{5,40})$/;
const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const dayIn = (timezone: string, now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
const shiftDay = (day: string, days: number) => new Date(asDate(day).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

interface StatePayload {
  o: string;
  l: string;
  u: string;
  a: string;
  e: number;
  n: string;
}

/** state окна входа: кто, откуда и какой кабинет подключает; подпись секретом приложения, живёт 10 минут */
export function signMetaState(p: Omit<StatePayload, 'e' | 'n'>, secret: string, now = Date.now()): string {
  const body = b64(JSON.stringify({ ...p, e: now + STATE_TTL_MS, n: randomBytes(8).toString('hex') }));
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

export function verifyMetaState(state: string, secret: string, now = Date.now()): StatePayload | null {
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('base64url'));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
    return typeof p.e === 'number' && p.e > now ? p : null;
  } catch {
    return null;
  }
}

export interface ConnectionView {
  configured: boolean;
  connection: {
    adAccountId: string;
    accountName: string | null;
    currency: string;
    timezone: string;
    status: string;
    lastSyncedAt: string | null;
    lastError: string | null;
  } | null;
}

export type CompleteResult =
  | { connected: true; accountName: string }
  | { connected: false; pending: string; accounts: Array<{ adAccountId: string; name: string; currency: string }> };

type ConnectionRow = { id: string; locationId: string; adAccountId: string; timezone: string; currency: string; tokenCiphertext: string };

@Injectable()
export class MarketingMetaService {
  private readonly log = new Logger(MarketingMetaService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MARKETING_BUDGET_REPOSITORY) private readonly repo: MarketingBudgetRepository,
    @Inject(META_GATEWAY) private readonly gateway: MetaGateway,
  ) {}

  private requireConfig() {
    const c = this.gateway.config();
    if (!c)
      throw new ServiceUnavailableException(
        'Приложение Meta ещё не настроено: владельцу платформы нужно вписать ключи приложения',
      );
    return c;
  }

  async view(): Promise<ConnectionView> {
    const scope = await this.repo.scope();
    const c = await this.prisma.db.marketingAdConnection.findUnique({
      where: { locationId_platform: { locationId: scope.locationId, platform: 'META' } },
    });
    return {
      configured: this.gateway.config() !== null,
      connection:
        c && c.status !== 'DISCONNECTED'
          ? {
              adAccountId: c.adAccountId,
              accountName: c.accountName,
              currency: c.currency,
              timezone: c.timezone,
              status: c.status,
              lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
              lastError: c.lastError,
            }
          : null,
    };
  }

  /**
   * Шаг 1: адрес окна входа Facebook с подписанным state. Кабинет человек отмечает в самом окне Facebook; номер
   * передаётся, только если его назвали заранее (тогда подключится именно он).
   */
  async start(dto: Record<string, unknown>): Promise<{ url: string }> {
    const config = this.requireConfig();
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    const raw = String(dto.adAccountId ?? '').trim();
    const m = raw === '' ? null : ACCOUNT.exec(raw);
    if (raw !== '' && !m) throw new BadRequestException('Номер рекламного кабинета: цифры из Ads Manager, например 1234567890');
    const user = currentUserId();
    if (!user) throw new ForbiddenException('Войдите, чтобы подключить кабинет');
    const state = signMetaState({ o: scope.organizationId, l: scope.locationId, u: user, a: m?.[1] ?? '' }, config.appSecret);
    return { url: meta.metaLoginUrl({ ...config, state }) };
  }

  /**
   * Шаг 2: код из адреса возврата → ключ → кабинеты, отмеченные в окне Facebook. Один действующий подключается сразу;
   * несколько: ответ со списком и шифрованной заготовкой входа на 10 минут (ключ внутри шифра, привязан к человеку и
   * филиалу), выбор завершает `choose`.
   */
  async complete(dto: Record<string, unknown>): Promise<CompleteResult> {
    const config = this.requireConfig();
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    const state = verifyMetaState(String(dto.state ?? ''), config.appSecret);
    // state чужого человека, филиала или просроченный: подключение не принимается (защита от подделки запроса)
    if (!state || state.o !== scope.organizationId || state.l !== scope.locationId || state.u !== currentUserId())
      throw new ForbiddenException('Подключение устарело или начато не здесь: начните заново');
    const code = String(dto.code ?? '').trim();
    if (!code) throw new BadRequestException('Facebook не вернул код входа: начните заново');
    const token = await this.gateway.exchangeCode(code).catch((e: unknown) => {
      throw new BadRequestException(errorText(e));
    });
    if (state.a) return this.connect(scope.locationId, token, state.a);
    const accounts = (
      await this.gateway.assignedAdAccounts(token).catch((e: unknown) => {
        throw new ConflictException(`Meta не отдала список кабинетов: ${errorText(e)}`);
      })
    ).filter((a) => a.active);
    if (accounts.length === 0)
      throw new ConflictException(
        'В окне Facebook не отмечен ни один действующий рекламный кабинет: подключите заново и отметьте кабинет',
      );
    if (accounts.length === 1) return this.connect(scope.locationId, token, accounts[0]!.accountId);
    const pending = encryptPii(
      JSON.stringify({ t: token, o: scope.organizationId, l: scope.locationId, u: currentUserId(), e: Date.now() + STATE_TTL_MS }),
    );
    return {
      connected: false,
      pending,
      accounts: accounts.map((a) => ({ adAccountId: a.accountId, name: a.name, currency: a.currency })),
    };
  }

  /** Выбор кабинета из нескольких отмеченных: заготовка того же человека и филиала, не старше 10 минут */
  async choose(dto: Record<string, unknown>): Promise<CompleteResult> {
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    let p: { t?: string; o?: string; l?: string; u?: string; e?: number } = {};
    try {
      p = JSON.parse(decryptPii(String(dto.pending ?? ''))) as typeof p;
    } catch {
      p = {};
    }
    if (!p.t || p.o !== scope.organizationId || p.l !== scope.locationId || p.u !== currentUserId() || !p.e || p.e < Date.now())
      throw new ForbiddenException('Выбор кабинета устарел или начат не здесь: подключите заново');
    const m = ACCOUNT.exec(String(dto.adAccountId ?? '').trim());
    if (!m) throw new BadRequestException('Выберите кабинет из списка');
    return this.connect(scope.locationId, p.t, m[1]!);
  }

  /** Кабинет проверяется ключом (доступ и статус), ключ шифруется, первая сверка за 28 дней */
  private async connect(locationId: string, token: string, adAccountId: string): Promise<CompleteResult> {
    const account = await this.gateway.adAccount(token, adAccountId).catch((e: unknown) => {
      throw new ConflictException(`Кабинет ${adAccountId} недоступен этому входу: ${errorText(e)}`);
    });
    if (!account.active) throw new ConflictException('Кабинет закрыт или отключён в Meta: подключите действующий');
    const data = {
      adAccountId: account.accountId,
      accountName: account.name || null,
      currency: account.currency,
      timezone: account.timezone,
      tokenCiphertext: encryptPii(token),
      status: 'ACTIVE' as const,
      lastError: null,
      connectedById: auditUserId(),
    };
    const conn = await this.prisma.db.$transaction(async (tx) => {
      const c = await tx.marketingAdConnection.upsert({
        where: { locationId_platform: { locationId, platform: 'META' } },
        create: { locationId, platform: 'META', ...data },
        update: data,
      });
      await tx.auditLog.create({
        data: {
          userId: auditUserId(),
          entityType: 'marketing_ad_connection',
          entityId: c.id,
          action: 'marketing_ad_connection.connected',
          after: { platform: 'META', adAccountId: account.accountId, currency: account.currency, timezone: account.timezone },
        },
      });
      return c;
    });
    await this.syncConnection(conn, 28, 'MANUAL').catch((e: unknown) => this.log.warn(`первая сверка не прошла: ${errorText(e)}`));
    return { connected: true, accountName: account.name };
  }

  async syncNow(): Promise<{ ok: boolean; days: number; campaigns: number; error: string | null }> {
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    const conn = await this.prisma.db.marketingAdConnection.findUnique({
      where: { locationId_platform: { locationId: scope.locationId, platform: 'META' } },
    });
    if (!conn || conn.status === 'DISCONNECTED') throw new NotFoundException('Кабинет Meta не подключён');
    return this.syncConnection(conn, 7, 'MANUAL');
  }

  async disconnect(): Promise<{ disconnected: true }> {
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    await this.prisma.db.$transaction(async (tx) => {
      const c = await tx.marketingAdConnection.findUnique({
        where: { locationId_platform: { locationId: scope.locationId, platform: 'META' } },
        select: { id: true, status: true },
      });
      if (!c || c.status === 'DISCONNECTED') throw new NotFoundException('Кабинет Meta не подключён');
      // ключ стирается; кампании и дни остаются (история)
      await tx.marketingAdConnection.update({ where: { id: c.id }, data: { status: 'DISCONNECTED', tokenCiphertext: '' } });
      await tx.auditLog.create({
        data: { userId: auditUserId(), entityType: 'marketing_ad_connection', entityId: c.id, action: 'marketing_ad_connection.disconnected', after: {} },
      });
    });
    return { disconnected: true };
  }

  /**
   * Сверка одного кабинета за последние `days` дней (в поясе кабинета, включая сегодня): кампании по внешнему номеру,
   * дни заменяются по паре (кампания, день), повтор ничего не дублирует. Каждая сверка оставляет след (ADR-007).
   */
  async syncConnection(
    conn: ConnectionRow,
    days: number,
    trigger: 'NIGHTLY' | 'MANUAL',
    now: Date = new Date(),
  ): Promise<{ ok: boolean; days: number; campaigns: number; error: string | null }> {
    const until = dayIn(conn.timezone, now);
    const since = shiftDay(until, -(days - 1));
    const run = await this.prisma.db.marketingSyncRun.create({
      data: { connectionId: conn.id, trigger, since: asDate(since), until: asDate(until), status: 'RUNNING' },
      select: { id: true },
    });
    try {
      const rows = await this.gateway.campaignDays(decryptPii(conn.tokenCiphertext), { adAccountId: conn.adAccountId, since, until });
      const campaignIds = new Map<string, string>();
      await this.prisma.db.$transaction(async (tx) => {
        for (const r of rows) {
          let id = campaignIds.get(r.externalCampaignId);
          if (!id) {
            const name = r.campaignName.slice(0, 200);
            id = (
              await tx.marketingCampaign.upsert({
                where: { locationId_platform_externalId: { locationId: conn.locationId, platform: 'META', externalId: r.externalCampaignId } },
                create: { locationId: conn.locationId, platform: 'META', externalId: r.externalCampaignId, name },
                update: { name },
                select: { id: true },
              })
            ).id;
            campaignIds.set(r.externalCampaignId, id);
          }
          const data = {
            impressions: r.impressions,
            clicks: Math.min(r.clicks, r.impressions),
            leads: r.leads,
            source: 'META' as const,
            spendMinor: r.spendMinor,
            spendCurrency: r.currency || conn.currency,
          };
          await tx.marketingCampaignStat.upsert({
            where: { campaignId_date: { campaignId: id, date: asDate(r.date) } },
            create: { campaignId: id, date: asDate(r.date), ...data },
            update: data,
          });
        }
        await tx.marketingSyncRun.update({
          where: { id: run.id },
          data: { status: 'OK', campaigns: campaignIds.size, days: rows.length, finishedAt: new Date() },
        });
        await tx.marketingAdConnection.update({
          where: { id: conn.id },
          data: { status: 'ACTIVE', lastSyncedAt: new Date(), lastError: null },
        });
      });
      return { ok: true, days: rows.length, campaigns: campaignIds.size, error: null };
    } catch (e) {
      const retryable = e instanceof meta.MetaApiError ? e.retryable : true;
      const text = retryable
        ? `Сверка не прошла, повторим позже: ${errorText(e)}`
        : `Доступ к кабинету потерян, подключите заново: ${errorText(e)}`;
      await this.prisma.db.marketingSyncRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', error: text.slice(0, 500), finishedAt: new Date() },
      });
      await this.prisma.db.marketingAdConnection.update({
        where: { id: conn.id },
        data: { lastError: text.slice(0, 500), ...(retryable ? {} : { status: 'FAILED' }) },
      });
      return { ok: false, days: 0, campaigns: 0, error: text };
    }
  }

  /** Ночной проход по всем действующим кабинетам: 7 дней, по воскресеньям 28 (дальше Meta цифры не меняет) */
  async syncAll(now: Date = new Date()): Promise<{ connections: number; failed: number }> {
    const conns = await this.prisma.db.marketingAdConnection.findMany({ where: { status: 'ACTIVE' } });
    let failed = 0;
    for (const c of conns) {
      const days = new Date(dayIn(c.timezone, now)).getUTCDay() === 0 ? 28 : 7;
      const r = await this.syncConnection(c, days, 'NIGHTLY', now);
      if (!r.ok) failed += 1;
    }
    return { connections: conns.length, failed };
  }
}

/** Как часто проверяем, не пора ли (сама сверка раз в сутки UTC, с 00:00 UTC) */
const CHECK_MS = 60 * 60_000;

/** Ночная сверка кабинетов; выключатель `MARKETING_META_SYNC=off`, в тестах таймера нет */
@Injectable()
export class MarketingMetaNightly implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MarketingMetaNightly.name);
  private timer: NodeJS.Timeout | null = null;
  private lastDay: string | null = null;
  private running = false;

  constructor(@Optional() @Inject(MarketingMetaService) private readonly service: MarketingMetaService | null = null) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.MARKETING_META_SYNC === 'off' || !this.service) return;
    this.timer = setInterval(() => void this.tick(), CHECK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now: Date = new Date()): Promise<void> {
    // раз в сутки UTC: 00:00 UTC это прежние 05:00 Алматы (UTC+5); день каждого кабинета считается по его поясу (dayIn)
    const day = now.toISOString().slice(0, 10);
    if (this.running || !this.service || this.lastDay === day) return;
    this.running = true;
    try {
      const r = await this.service.syncAll(now);
      this.lastDay = day;
      if (r.connections > 0) this.log.log(`кабинеты Meta: сверено ${r.connections}, с ошибкой ${r.failed}`);
    } catch (e) {
      this.log.warn(`ночная сверка кабинетов не прошла: ${errorText(e)}`);
    } finally {
      this.running = false;
    }
  }
}

/** Право раздела «Маркетинг» (ADR-MKT-B7) */
@Access('marketing')
@Controller('marketing/ad-connections/meta')
export class MarketingMetaController {
  constructor(@Inject(MarketingMetaService) private readonly service: MarketingMetaService) {}

  @Get()
  view() {
    return this.service.view();
  }

  @Post('start')
  @HttpCode(200)
  start(@Body() dto: Record<string, unknown>) {
    return this.service.start(dto ?? {});
  }

  @Post('complete')
  @HttpCode(200)
  complete(@Body() dto: Record<string, unknown>) {
    return this.service.complete(dto ?? {});
  }

  @Post('choose')
  @HttpCode(200)
  choose(@Body() dto: Record<string, unknown>) {
    return this.service.choose(dto ?? {});
  }

  @Post('sync')
  @HttpCode(200)
  sync() {
    return this.service.syncNow();
  }

  @Post('disconnect')
  @HttpCode(200)
  disconnect() {
    return this.service.disconnect();
  }
}
