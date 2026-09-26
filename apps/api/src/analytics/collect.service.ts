import 'reflect-metadata';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
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
import { AttemptWindows } from '../auth/attempt-limits';

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
  /**
   * Поисков сайта в базе в минуту на весь приёмник. Настоящих сайтов единицы, их ключи живут в кэше; поток случайных
   * ключей иначе занимал общий пул базы (аудит 26.09, С-34). Сверх предела — отказ без базы или прежний ответ из кэша.
   */
  unknownLookupsPerMinute: 300,
  /** Сколько ключей держит кэш: прежний хранил каждый присланный ключ вечно */
  siteCacheSize: 5_000,
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
  private lookups = new AttemptWindows(COLLECT_LIMITS.unknownLookupsPerMinute, WINDOW_MS);
  private perVisitor = new AttemptWindows(COLLECT_LIMITS.perVisitorPerMinute, WINDOW_MS);
  private perSite = new AttemptWindows(COLLECT_LIMITS.perSitePerMinute, WINDOW_MS);

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

    if (!this.perVisitor.allow(`${site.id}:${hit.visitorKey}`, now.getTime())) {
      return 'rejected:visitor limit';
    }
    if (!this.perSite.allow(site.id, now.getTime())) {
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
    this.lookups = new AttemptWindows(COLLECT_LIMITS.unknownLookupsPerMinute, WINDOW_MS);
    this.perVisitor = new AttemptWindows(COLLECT_LIMITS.perVisitorPerMinute, WINDOW_MS);
    this.perSite = new AttemptWindows(COLLECT_LIMITS.perSitePerMinute, WINDOW_MS);
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
    // предел поисков исчерпан — база не трогается; известный сайт живёт на прежнем ответе, пока поток не схлынет
    if (!this.lookups.allow('all', nowMs)) return cached?.site ?? null;
    const site = await this.repo.siteByKey(key);
    this.siteCache.delete(key);
    this.siteCache.set(key, { site, at: nowMs });
    if (this.siteCache.size > COLLECT_LIMITS.siteCacheSize) this.evict(nowMs);
    return site;
  }

  /** Сначала протухшие, потом самые старые записи: порядок вставки в Map — порядок записи */
  private evict(nowMs: number): void {
    for (const [key, entry] of this.siteCache) {
      if (nowMs - entry.at >= COLLECT_LIMITS.siteCacheMs) this.siteCache.delete(key);
    }
    for (const key of this.siteCache.keys()) {
      if (this.siteCache.size <= COLLECT_LIMITS.siteCacheSize) break;
      this.siteCache.delete(key);
    }
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
