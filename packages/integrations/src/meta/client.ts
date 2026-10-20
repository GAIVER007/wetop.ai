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
const FIELDS =
  'campaign_id,campaign_name,date_start,date_stop,spend,impressions,clicks,actions,account_currency';
/** Предел вызовов и временный сбой: ждать и повторить (docs/meta/README.md, «Ошибки») */
const RETRYABLE = new Set([1, 2, 4, 17, 613]);

export class MetaApiError extends Error {
  constructor(
    message: string,
    /** Код ошибки Graph API; 0: ответ не от Graph API (сеть, не JSON) */
    readonly code: number,
    /** Есть смысл повторить позже (предел, временный сбой); false: нужен новый ключ или право */
    readonly retryable: boolean,
    /** `error_subcode` Graph API; 0: не пришёл (docs/meta/create.md §13) */
    readonly subcode = 0,
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

/** Рекламный кабинет по номеру (docs/meta/README.md, «Кабинет по номеру») */
export interface MetaAdAccount {
  /** Номер без приставки act_ */
  accountId: string;
  name: string;
  currency: string;
  /** Пояс кабинета: в нём Meta считает дни */
  timezone: string;
  /** account_status = 1 (ACTIVE) */
  active: boolean;
}

const ACCOUNT_FIELDS = 'account_id,name,currency,timezone_name,account_status';
interface AccountRow {
  account_id?: string;
  name?: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
}
const toAccount = (r: AccountRow, fallbackId: string): MetaAdAccount => ({
  accountId: String(r.account_id ?? fallbackId),
  name: String(r.name ?? '').trim(),
  currency: String(r.currency ?? '').toUpperCase(),
  timezone: String(r.timezone_name ?? ''),
  active: r.account_status === 1,
});

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
  if (!Number.isInteger(n) || n < 0)
    throw new MetaApiError('Meta вернула счётчик не целым числом', 0, false);
  return n;
};

const toDay = (r: InsightsRow): MetaCampaignDay => ({
  externalCampaignId: String(r.campaign_id ?? ''),
  campaignName: String(r.campaign_name ?? '').trim() || `Кампания ${r.campaign_id ?? ''}`,
  date: String(r.date_start ?? ''),
  impressions: count(r.impressions),
  clicks: count(r.clicks),
  leads: (r.actions ?? [])
    .filter((a) => LEAD_ACTIONS.has(a.action_type ?? ''))
    .reduce((s, a) => s + count(a.value), 0),
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

  /**
   * Кабинеты, которые клиент отметил в окне входа: ключ SUAT видит только их (docs/meta/README.md, «Какие кабинеты
   * выбрал клиент»). Сначала `/me` даёт системного пользователя интеграции, затем его `assigned_ad_accounts`, все страницы.
   */
  async assignedAdAccounts(): Promise<MetaAdAccount[]> {
    const me = new URL(`${BASE}/${META_API_VERSION}/me`);
    me.searchParams.set('fields', 'id,client_business_id');
    me.searchParams.set('access_token', this.options.accessToken);
    const who = await this.get<{ id?: string }>(me.toString());
    if (!who.id) throw new MetaApiError('Meta не назвала системного пользователя входа', 0, false);
    const first = new URL(
      `${BASE}/${META_API_VERSION}/${encodeURIComponent(who.id)}/assigned_ad_accounts`,
    );
    first.searchParams.set('fields', ACCOUNT_FIELDS);
    first.searchParams.set('access_token', this.options.accessToken);
    const out: MetaAdAccount[] = [];
    let next: string | undefined = first.toString();
    while (next) {
      const page: { data?: AccountRow[]; paging?: { next?: string } } = await this.get(next);
      for (const r of page.data ?? []) out.push(toAccount(r, ''));
      next = page.paging?.next;
    }
    return out;
  }

  /** Кабинет по номеру: проверка доступа ключа и его валюта, пояс, статус */
  async adAccount(adAccountId: string): Promise<MetaAdAccount> {
    const account = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const url = new URL(`${BASE}/${META_API_VERSION}/${encodeURIComponent(account)}`);
    url.searchParams.set('fields', ACCOUNT_FIELDS);
    url.searchParams.set('access_token', this.options.accessToken);
    return toAccount(await this.get<AccountRow>(url.toString()), account.slice(4));
  }

  /** Кампании кабинета по дням за период [since, until] в часовом поясе кабинета; все страницы */
  async campaignDays(q: {
    adAccountId: string;
    since: string;
    until: string;
  }): Promise<MetaCampaignDay[]> {
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
      const page: InsightsPage = await this.get<InsightsPage>(next);
      for (const r of page.data ?? []) out.push(toDay(r));
      next = page.paging?.next;
    }
    return out;
  }

  private get<T>(url: string): Promise<T> {
    return graphCall<T>(
      { accessToken: this.options.accessToken, fetch: this.fetchFn, sleep: this.sleep },
      url,
    );
  }
}

export interface GraphTransport {
  accessToken: string;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

interface GraphError {
  message?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  is_transient?: boolean;
}

/**
 * Один вызов Graph API с повтором (docs/meta/README.md, «Ошибки»; create.md §0). Повтор при пределе вызовов и
 * временном сбое (`is_transient`): Meta отказала, объект не создан. Обрыв сети или таймаут повторяется только при
 * `retryNoAnswer`: на создании ответа нет, а объект мог появиться, и повтор дал бы вторую кампанию.
 * Текст ошибки для человека (`error_user_msg`, иначе `message`), ключ из него вырезается.
 */
export async function graphCall<T>(
  t: GraphTransport,
  url: string,
  init: RequestInit = {},
  retryNoAnswer = true,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    let status = 0;
    type Body = T & { error?: GraphError };
    let body: Body | null = null;
    try {
      const res = await t.fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
      status = res.status;
      body = (await res.json().catch(() => null)) as Body | null;
    } catch {
      // сеть или таймаут: ответа нет, ниже это код 0
    }
    if (status === 200 && body && !body.error) return body;
    const error = body?.error;
    const code = error?.code ?? 0;
    const retryable =
      code === 0 ? retryNoAnswer : RETRYABLE.has(code) || error?.is_transient === true;
    if (retryable && attempt < ATTEMPTS) {
      await t.sleep(BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!);
      continue;
    }
    const raw = error?.error_user_msg || error?.message || `HTTP ${status || 'нет ответа'}`;
    throw new MetaApiError(
      `Meta: ${raw.split(t.accessToken).join('***')}`,
      code,
      retryable,
      error?.error_subcode ?? 0,
    );
  }
}
