import 'reflect-metadata';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { RateWindows } from '../rate-window';
import {
  classifySource,
  deviceFromUserAgent,
  hostMatches,
  isBotUserAgent,
  normalizeHost,
  parseHit,
  HIT_LIMITS,
  type ParsedHit,
} from '@pms/domain';
import {
  ANALYTICS_REPOSITORY,
  type AnalyticsRepository,
  type SiteRecord,
  type StoredHit,
} from './analytics.repository';

export interface HitHeaders {
  userAgent?: string | null | undefined;
  origin?: string | null | undefined;
  referer?: string | null | undefined;
  /** Заголовок Host запроса: страница со своего же адреса API (демо) принимается без домена сайта */
  host?: string | null | undefined;
}

export type AcceptResult = 'queued' | `rejected:${string}`;

/** Лимиты приёмника (план среза 8 §5). В памяти процесса; Redis — когда появится (ADR-011). */
export const COLLECT_LIMITS = {
  perVisitorPerMinute: 60,
  perSitePerMinute: 600,
  siteCacheMs: 30_000,
  flushIntervalMs: 1000,
  flushBatch: 100,
} as const;

const WINDOW_MS = 60_000;

/**
 * Публичный приёмник событий счётчика: разбор → сайт по ключу → домен → бот → лимиты → очередь.
 * Отвечает сразу; в БД события уходят пачкой раз в секунду или по 100 штук. IP не читается и не хранится.
 */
@Injectable()
export class CollectService implements OnModuleDestroy {
  private queue: StoredHit[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushing: Promise<number> | null = null;
  private readonly siteCache = new Map<string, { site: SiteRecord | null; at: number }>();
  private windows = new RateWindows(WINDOW_MS, 50_000);

  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly repo: AnalyticsRepository) {}

  async accept(body: unknown, headers: HitHeaders, now = new Date()): Promise<AcceptResult> {
    if (typeof body !== 'string' && JSON.stringify(body ?? null).length > HIT_LIMITS.body) {
      return 'rejected:body too large';
    }
    const parsed = parseHit(body);
    if (!parsed.ok) return `rejected:${parsed.reason}`;
    const hit = parsed.hit;

    const ua = headers.userAgent ?? null;
    if (isBotUserAgent(ua)) return 'rejected:bot';

    const site = await this.siteFor(hit.siteKey, now.getTime());
    if (!site) return 'rejected:unknown site';
    if (site.status !== 'ACTIVE') return 'rejected:site paused';

    const originHost = hostOf(headers.origin) ?? hostOf(headers.referer);
    const ownHost = headers.host ? normalizeHost(headers.host) : null;
    const fromOwnPage = !!originHost && !!ownHost && originHost === ownHost;
    if (!fromOwnPage && !hostMatches(site.hosts, originHost)) return 'rejected:origin';

    if (!this.allow(`v:${site.id}:${hit.visitorKey}`, COLLECT_LIMITS.perVisitorPerMinute, now)) {
      return 'rejected:visitor limit';
    }
    if (!this.allow(`s:${site.id}`, COLLECT_LIMITS.perSitePerMinute, now)) {
      return 'rejected:site limit';
    }

    this.queue.push(toStored(site, hit, ua, now));
    if (this.queue.length >= COLLECT_LIMITS.flushBatch) void this.flush();
    else this.schedule();
    return 'queued';
  }

  /** Записать всё, что накопилось. Возвращает число записанных. */
  flush(): Promise<number> {
    if (this.flushing) return this.flushing;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const batch = this.queue;
    this.queue = [];
    if (!batch.length) return Promise.resolve(0);
    this.flushing = this.repo
      .record(batch)
      .then(() => batch.length)
      .catch((e: unknown) => {
        console.warn(`[analytics] пачка не записана: ${(e as Error).message}`);
        return 0;
      })
      .finally(() => {
        this.flushing = null;
        if (this.queue.length) this.schedule();
      });
    return this.flushing;
  }

  /** Для тестов: обнулить окна лимитов и кэш сайтов. */
  resetLimits(): void {
    this.windows.reset();
    this.siteCache.clear();
  }

  async onModuleDestroy(): Promise<void> {
    await this.flush();
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, COLLECT_LIMITS.flushIntervalMs);
    this.timer.unref?.();
  }

  /** Сайт по ключу для демо-страницы (тот же кэш, что у приёмника). */
  siteByKey(key: string): Promise<SiteRecord | null> {
    return this.siteFor(key, Date.now());
  }

  private async siteFor(key: string, nowMs: number): Promise<SiteRecord | null> {
    const cached = this.siteCache.get(key);
    if (cached && nowMs - cached.at < COLLECT_LIMITS.siteCacheMs) return cached.site;
    const site = await this.repo.siteByKey(key);
    this.siteCache.set(key, { site, at: nowMs });
    return site;
  }

  private allow(key: string, limit: number, now: Date): boolean {
    // С-6 (ТЗ аудита 25.09.2026): вытеснение только протухших окон — общий класс, не clear()
    return this.windows.allow(key, limit, now);
  }
}

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return normalizeHost(new URL(value).hostname);
  } catch {
    return null;
  }
}

function toStored(site: SiteRecord, hit: ParsedHit, ua: string | null, now: Date): StoredHit {
  return {
    siteId: site.id,
    at: now,
    type: hit.type,
    visitorKey: hit.visitorKey,
    sessionKey: hit.sessionKey,
    path: hit.url.pathname || '/',
    title: hit.title,
    source: classifySource({
      url: hit.url.toString(),
      referrer: hit.referrer,
      siteHosts: site.hosts,
    }),
    device: deviceFromUserAgent(ua, hit.width),
    language: hit.language,
    eventName: hit.eventName,
    props: hit.props,
  };
}
