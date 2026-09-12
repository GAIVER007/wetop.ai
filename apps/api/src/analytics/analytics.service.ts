import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  dailyBreakdown,
  demandCalendar,
  devicesBreakdown,
  eventsBreakdown,
  isIsoDate,
  localDate,
  monthPeriod,
  normalizeHost,
  periodBoundsUtc,
  sourcesBreakdown,
  summarize,
  topPages,
  zonedStartOfDay,
  type DailyRow,
  type DemandRow,
  type DevicesBreakdown,
  type EventRow,
  type PageRow,
  type SourceRow,
  type Summary,
} from '@pms/domain';
import {
  ANALYTICS_REPOSITORY,
  type AnalyticsRepository,
  type SiteRecord,
  type SiteStatus,
} from './analytics.repository';

export interface Snippet {
  key: string;
  scriptUrl: string;
  code: string;
  /** Страница со счётчиком на адресе API — проверить с телефона, ничего не вставляя на сайт */
  demoUrl: string;
  /** Код виджета бронирования (срез 9) */
  bookingCode: string;
  bookingDemoUrl: string;
}

export interface SiteCard {
  site: SiteRecord;
  status: SiteStatus;
  snippet: Snippet;
}

export interface SiteReport {
  site: { id: string; name: string };
  period: { from: string; to: string; timezone: string };
  summary: Summary;
  daily: DailyRow[];
  sources: SourceRow[];
  pages: PageRow[];
  demand: DemandRow[];
  events: EventRow[];
  devices: DevicesBreakdown;
}

const HOST_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/;

/** Публичный адрес API для кода счётчика; без него — локальный (разработка и e2e). */
export function publicApiUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.PUBLIC_API_URL ?? '').replace(/\/+$/, '') || 'http://127.0.0.1:3001';
}

export function newSiteKey(): string {
  return `pms_${randomBytes(6).toString('hex')}`;
}

/** Домены: по одному в строке или через запятую, без схемы и пути, нормализованные, без дублей. */
export function parseHosts(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[\s,]+/) : [];
  const hosts = new Set<string>();
  for (const item of list) {
    if (typeof item !== 'string') throw new BadRequestException('домен должен быть строкой');
    const h = normalizeHost(item);
    if (!h) continue;
    if (!HOST_RE.test(h)) throw new BadRequestException(`не похоже на домен: «${item.trim()}»`);
    hosts.add(h);
  }
  if (!hosts.size) throw new BadRequestException('нужен хотя бы один домен сайта');
  return [...hosts];
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly repo: AnalyticsRepository) {}

  sites(): Promise<SiteRecord[]> {
    return this.repo.sites();
  }

  async card(id: string, now = new Date()): Promise<SiteCard> {
    const site = await this.mustSite(id);
    const status = await this.repo.status(
      site.id,
      zonedStartOfDay(localDate(now, site.timezone), site.timezone),
    );
    return { site, status, snippet: this.snippet(site) };
  }

  snippet(site: SiteRecord): Snippet {
    const scriptUrl = `${publicApiUrl()}/a/pms.js`;
    return {
      key: site.publicKey,
      scriptUrl,
      demoUrl: `${publicApiUrl()}/a/demo?k=${site.publicKey}`,
      bookingCode: `<!-- PMS: виджет бронирования -->\n<div id="pms-booking"></div>\n<script async src="${publicApiUrl()}/w/widget.js" data-site="${site.publicKey}"></script>`,
      bookingDemoUrl: `${publicApiUrl()}/w/demo?k=${site.publicKey}`,
      code: `<!-- PMS: счётчик посещений -->\n<script async src="${scriptUrl}" data-site="${site.publicKey}"></script>`,
    };
  }

  async create(dto: { name?: unknown; hosts?: unknown }): Promise<SiteCard> {
    const name = typeof dto.name === 'string' ? dto.name.trim() : '';
    if (!name) throw new BadRequestException('нужно название сайта');
    const hosts = parseHosts(dto.hosts);
    const site = await this.repo.createSite({ name, hosts, publicKey: newSiteKey() });
    await this.repo.audit('analytics.site.create', site.id, {
      name,
      hosts,
      publicKey: site.publicKey,
    });
    return this.card(site.id);
  }

  async update(
    id: string,
    dto: {
      name?: unknown;
      hosts?: unknown;
      status?: unknown;
      bookingEnabled?: unknown;
      bookingRatePlanCode?: unknown;
    },
  ): Promise<SiteCard> {
    const site = await this.mustSite(id);
    const patch: {
      name?: string;
      hosts?: string[];
      status?: 'ACTIVE' | 'PAUSED';
      bookingEnabled?: boolean;
      bookingRatePlanId?: string | null;
    } = {};
    if (dto.name !== undefined) {
      const name = typeof dto.name === 'string' ? dto.name.trim() : '';
      if (!name) throw new BadRequestException('название не может быть пустым');
      patch.name = name;
    }
    if (dto.hosts !== undefined) patch.hosts = parseHosts(dto.hosts);
    if (dto.status !== undefined) {
      if (dto.status !== 'ACTIVE' && dto.status !== 'PAUSED') {
        throw new BadRequestException('статус: ACTIVE или PAUSED');
      }
      patch.status = dto.status;
    }
    // Виджет бронирования (срез 9): тариф по коду; при включении без тарифа — тариф сайта по умолчанию
    if (dto.bookingRatePlanCode !== undefined) {
      if (dto.bookingRatePlanCode === null || dto.bookingRatePlanCode === '') {
        patch.bookingRatePlanId = null;
      } else {
        if (typeof dto.bookingRatePlanCode !== 'string') {
          throw new BadRequestException('bookingRatePlanCode — код тарифа');
        }
        const plan = await this.repo.ratePlanByCode(dto.bookingRatePlanCode);
        if (!plan || !plan.active) {
          throw new BadRequestException(`тариф ${dto.bookingRatePlanCode} не найден или неактивен`);
        }
        patch.bookingRatePlanId = plan.id;
      }
    }
    if (dto.bookingEnabled !== undefined) {
      if (typeof dto.bookingEnabled !== 'boolean') {
        throw new BadRequestException('bookingEnabled — true или false');
      }
      patch.bookingEnabled = dto.bookingEnabled;
      if (dto.bookingEnabled && patch.bookingRatePlanId === undefined && !site.bookingRatePlan) {
        const plan = await this.repo.defaultBookingRatePlan();
        if (!plan) throw new BadRequestException('нет активного тарифа для бронирования с сайта');
        patch.bookingRatePlanId = plan.id;
      }
      if (dto.bookingEnabled && patch.bookingRatePlanId === null) {
        throw new BadRequestException('для включения бронирования нужен тариф');
      }
    }
    if (!Object.keys(patch).length) throw new BadRequestException('нечего менять');
    await this.repo.updateSite(id, patch);
    await this.repo.audit('analytics.site.update', id, patch);
    return this.card(id);
  }

  async delete(id: string): Promise<{ deleted: true }> {
    const site = await this.mustSite(id);
    await this.repo.deleteSite(id);
    await this.repo.audit('analytics.site.delete', id, {
      name: site.name,
      publicKey: site.publicKey,
    });
    return { deleted: true };
  }

  /** Отчёт за период [from, to] по датам объекта; без дат — текущий месяц. */
  async report(id: string, from?: string, to?: string, now = new Date()): Promise<SiteReport> {
    const site = await this.mustSite(id);
    const tz = site.timezone;
    let period: { from: string; to: string };
    if (!from && !to) period = monthPeriod(localDate(now, tz).slice(0, 7));
    else {
      if (!isIsoDate(from) || !isIsoDate(to)) throw new BadRequestException('даты: YYYY-MM-DD');
      if (from > to) throw new BadRequestException('начало периода позже конца');
      period = { from, to };
    }
    const { startUtc, endUtcExclusive } = periodBoundsUtc(period.from, period.to, tz);
    const [sessions, pageviews, events] = await Promise.all([
      this.repo.sessions(site.id, startUtc, endUtcExclusive),
      this.repo.pageviews(site.id, startUtc, endUtcExclusive),
      this.repo.events(site.id, startUtc, endUtcExclusive),
    ]);
    return {
      site: { id: site.id, name: site.name },
      period: { ...period, timezone: tz },
      summary: summarize(sessions),
      daily: dailyBreakdown(sessions, period.from, period.to, tz),
      sources: sourcesBreakdown(sessions),
      pages: topPages(pageviews),
      demand: demandCalendar(events.filter((e) => e.name === 'search')),
      events: eventsBreakdown(events),
      devices: devicesBreakdown(sessions),
    };
  }

  private async mustSite(id: string): Promise<SiteRecord> {
    const site = await this.repo.site(id);
    if (!site) throw new NotFoundException('сайт не найден');
    return site;
  }
}
