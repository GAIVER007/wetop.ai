/**
 * Meta Marketing API: отчёт по кампаниям рекламного кабинета по дням (МКТ-В3, интеграция; ADR-004: код площадки
 * только здесь). Документация: docs/meta/README.md (снято с developers.facebook.com 16.10.2026).
 *
 * Ключ уходит только параметром `access_token` и никогда не попадает в текст ошибки. Лиды площадки: действия `lead` и
 * `onsite_conversion.messaging_conversation_started_7d` (решение владельца 16.10.2026), поле `value` (окно атрибуции
 * кабинета по умолчанию: при нескольких окнах смысл `value` в документации не описан, окно не задаём).
 */

export const META_API_VERSION = 'v25.0';
const BASE = 'https://graph.facebook.com';
const TIMEOUT_MS = 30_000;
/** Попыток на один запрос при пределе вызовов и временном сбое */
const ATTEMPTS = 3;
const BACKOFF_MS = [5_000, 30_000];

const LEAD_ACTIONS = new Set(['lead', 'onsite_conversion.messaging_conversation_started_7d']);
const FIELDS = 'campaign_id,campaign_name,date_start,date_stop,spend,impressions,clicks,actions,account_currency';
/** Предел вызовов и временный сбой: ждать и повторить (docs/meta/README.md, «Ошибки») */
const RETRYABLE = new Set([1, 2, 4, 17, 613]);

export class MetaApiError extends Error {
  constructor(
    message: string,
    /** Код ошибки Graph API; 0: ответ не от Graph API (сеть, не JSON) */
    readonly code: number,
    /** Есть смысл повторить позже (предел, временный сбой); false: нужен новый ключ или право */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'MetaApiError';
  }
}

/** День кампании из кабинета, без слов Meta: в таком виде он ложится в статистику кампании (§53) */
export interface MetaCampaignDay {
  externalCampaignId: string;
  campaignName: string;
  date: string;
  impressions: number;
  clicks: number;
  leads: number;
  /** Расход дня в minor units валюты кабинета */
  spendMinor: bigint;
  currency: string;
}

export interface MetaAdsClientOptions {
  accessToken: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

interface InsightsRow {
  campaign_id?: string;
  campaign_name?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  account_currency?: string;
  actions?: Array<{ action_type?: string; value?: string }>;
}

interface InsightsPage {
  data?: InsightsRow[];
  paging?: { next?: string };
  error?: { message?: string; code?: number };
}

/** «5339.5» → 533950n; дробь длиннее двух знаков округляется к ближайшему; не число: отказ */
export function metaSpendMinor(spend: string): bigint {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(spend.trim());
  if (!m) throw new MetaApiError('Meta вернула расход не числом', 0, false);
  const frac = (m[2] ?? '').padEnd(3, '0');
  const minor = BigInt(m[1]!) * 100n + BigInt(frac.slice(0, 2));
  return Number(frac[2]) >= 5 ? minor + 1n : minor;
}

const count = (v: string | undefined): number => {
  const n = Number(v ?? '0');
  if (!Number.isInteger(n) || n < 0) throw new MetaApiError('Meta вернула счётчик не целым числом', 0, false);
  return n;
};

const toDay = (r: InsightsRow): MetaCampaignDay => ({
  externalCampaignId: String(r.campaign_id ?? ''),
  campaignName: String(r.campaign_name ?? '').trim() || `Кампания ${r.campaign_id ?? ''}`,
  date: String(r.date_start ?? ''),
  impressions: count(r.impressions),
  clicks: count(r.clicks),
  leads: (r.actions ?? []).filter((a) => LEAD_ACTIONS.has(a.action_type ?? '')).reduce((s, a) => s + count(a.value), 0),
  spendMinor: metaSpendMinor(r.spend ?? '0'),
  currency: String(r.account_currency ?? '').toUpperCase(),
});

export class MetaAdsClient {
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: MetaAdsClientOptions) {
    this.fetchFn = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Кампании кабинета по дням за период [since, until] в часовом поясе кабинета; все страницы */
  async campaignDays(q: { adAccountId: string; since: string; until: string }): Promise<MetaCampaignDay[]> {
    const account = q.adAccountId.startsWith('act_') ? q.adAccountId : `act_${q.adAccountId}`;
    const first = new URL(`${BASE}/${META_API_VERSION}/${encodeURIComponent(account)}/insights`);
    first.searchParams.set('level', 'campaign');
    first.searchParams.set('time_increment', '1');
    first.searchParams.set('time_range', JSON.stringify({ since: q.since, until: q.until }));
    first.searchParams.set('fields', FIELDS);
    first.searchParams.set('limit', '500');
    first.searchParams.set('access_token', this.options.accessToken);
    const out: MetaCampaignDay[] = [];
    let next: string | undefined = first.toString();
    while (next) {
      const page: InsightsPage = await this.get(next);
      for (const r of page.data ?? []) out.push(toDay(r));
      next = page.paging?.next;
    }
    return out;
  }

  private async get(url: string): Promise<InsightsPage> {
    for (let attempt = 1; ; attempt += 1) {
      let status = 0;
      let body: InsightsPage | null = null;
      try {
        const res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        status = res.status;
        body = (await res.json().catch(() => null)) as InsightsPage | null;
      } catch {
        // сеть или таймаут: ответа нет, ниже это повтор с кодом 0
      }
      if (status === 200 && body && !body.error) return body;
      const code = body?.error?.code ?? 0;
      const retryable = code === 0 || RETRYABLE.has(code);
      if (retryable && attempt < ATTEMPTS) {
        await this.sleep(BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!);
        continue;
      }
      const text = (body?.error?.message ?? `HTTP ${status || 'нет ответа'}`).split(this.options.accessToken).join('***');
      throw new MetaApiError(`Meta: ${text}`, code, retryable);
    }
  }
}
