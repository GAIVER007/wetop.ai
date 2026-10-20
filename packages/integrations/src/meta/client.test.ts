import { describe, expect, it } from 'vitest';
import { MetaAdsClient, MetaApiError, metaSpendMinor } from './client';

/**
 * Клиент Meta Marketing API по docs/meta/README.md на записанных ответах (сети нет). Кабинет, кампании и числа
 * вымышленные (ADR-010).
 */
const TOKEN = 'test-token-not-real';

type Call = { url: URL };
function fakeFetch(pages: Array<{ status?: number; body: unknown; headers?: Record<string, string> }>) {
  const calls: Call[] = [];
  const fn = (async (input: string | URL) => {
    calls.push({ url: new URL(String(input)) });
    const page = pages.shift();
    if (!page) throw new Error('лишний запрос');
    return new Response(JSON.stringify(page.body), { status: page.status ?? 200, headers: page.headers ?? {} });
  }) as typeof fetch;
  return { fn, calls };
}

const row = (over: Record<string, unknown> = {}) => ({
  campaign_id: '120200000000001',
  campaign_name: 'Осень: лиды',
  date_start: '2026-10-05',
  date_stop: '2026-10-05',
  spend: '5339.5',
  impressions: '25000',
  clicks: '300',
  account_currency: 'USD',
  actions: [
    { action_type: 'link_click', value: '280' },
    { action_type: 'lead', value: '9' },
    { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '3' },
    { action_type: 'onsite_conversion.messaging_first_reply', value: '2' },
  ],
  ...over,
});

describe('клиент Meta: отчёт по кампаниям по дням', () => {
  it('один запрос на страницу: версия в пути, уровень кампаний, по дням, период, ключ параметром', async () => {
    const { fn, calls } = fakeFetch([{ body: { data: [row()], paging: {} } }]);
    const client = new MetaAdsClient({ accessToken: TOKEN, fetch: fn });
    const rows = await client.campaignDays({ adAccountId: '1234567890', since: '2026-10-01', until: '2026-10-07' });
    const url = calls[0]!.url;
    expect(url.origin + url.pathname).toBe('https://graph.facebook.com/v25.0/act_1234567890/insights');
    expect(url.searchParams.get('level')).toBe('campaign');
    expect(url.searchParams.get('time_increment')).toBe('1');
    expect(JSON.parse(url.searchParams.get('time_range')!)).toEqual({ since: '2026-10-01', until: '2026-10-07' });
    expect(url.searchParams.get('fields')).toBe(
      'campaign_id,campaign_name,date_start,date_stop,spend,impressions,clicks,actions,account_currency',
    );
    expect(url.searchParams.get('access_token')).toBe(TOKEN);
    // лиды: заявки и начатые переписки (решение владельца 16.10), прочие действия не считаются
    expect(rows).toEqual([
      {
        externalCampaignId: '120200000000001',
        campaignName: 'Осень: лиды',
        date: '2026-10-05',
        impressions: 25000,
        clicks: 300,
        leads: 12,
        spendMinor: 533950n,
        currency: 'USD',
      },
    ]);
  });

  it('страницы читаются, пока есть paging.next, даже пустые', async () => {
    const next = (n: number) => `https://graph.facebook.com/v25.0/act_1/insights?after=c${n}&access_token=${TOKEN}`;
    const { fn, calls } = fakeFetch([
      { body: { data: [row()], paging: { next: next(1) } } },
      { body: { data: [], paging: { next: next(2) } } },
      { body: { data: [row({ date_start: '2026-10-06', actions: undefined, spend: '0' })], paging: { cursors: {} } } },
    ]);
    const rows = await new MetaAdsClient({ accessToken: TOKEN, fetch: fn }).campaignDays({ adAccountId: 'act_1', since: '2026-10-05', until: '2026-10-06' });
    expect(calls.map((c) => c.url.searchParams.get('after'))).toEqual([null, 'c1', 'c2']);
    expect(calls[0]!.url.pathname).toBe('/v25.0/act_1/insights'); // приставка act_ не удваивается
    expect(rows.map((r) => [r.date, r.leads, r.spendMinor])).toEqual([
      ['2026-10-05', 12, 533950n],
      ['2026-10-06', 0, 0n],
    ]);
  });

  it('предел вызовов: ждёт и повторяет; ключ истёк или нет права: отказ сразу и без ключа в тексте', async () => {
    const waits: number[] = [];
    const sleep = async (ms: number) => {
      waits.push(ms);
    };
    const limited = { status: 400, body: { error: { message: 'User request limit reached', type: 'OAuthException', code: 17 } } };
    const ok = { body: { data: [row()], paging: {} } };
    const retry = fakeFetch([limited, ok]);
    await new MetaAdsClient({ accessToken: TOKEN, fetch: retry.fn, sleep }).campaignDays({ adAccountId: '1', since: '2026-10-05', until: '2026-10-05' });
    expect(waits.length).toBe(1);

    for (const code of [190, 200]) {
      const failed = fakeFetch([{ status: 400, body: { error: { message: `bad ${TOKEN}`, type: 'OAuthException', code } } }]);
      const err = await new MetaAdsClient({ accessToken: TOKEN, fetch: failed.fn, sleep })
        .campaignDays({ adAccountId: '1', since: '2026-10-05', until: '2026-10-05' })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(MetaApiError);
      expect((err as MetaApiError).code).toBe(code);
      expect((err as MetaApiError).retryable).toBe(false);
      expect((err as Error).message).not.toContain(TOKEN);
      expect(failed.calls).toHaveLength(1);
    }
  });

  it('предел держится дольше попыток: отказ с признаком «повторить позже»', async () => {
    const limited = { status: 400, body: { error: { message: 'limit', code: 4 } } };
    const { fn, calls } = fakeFetch([limited, limited, limited]);
    const err = await new MetaAdsClient({ accessToken: TOKEN, fetch: fn, sleep: async () => undefined })
      .campaignDays({ adAccountId: '1', since: '2026-10-05', until: '2026-10-05' })
      .catch((e: unknown) => e);
    expect(calls).toHaveLength(3);
    expect((err as MetaApiError).retryable).toBe(true);
  });
});

describe('расход Meta в тиынах', () => {
  it.each([
    ['5339.5', 533950n],
    ['0', 0n],
    ['12.345', 1235n], // дробь длиннее двух знаков округляется к ближайшему
    ['7.004', 700n],
  ])('%s → %s', (spend, minor) => {
    expect(metaSpendMinor(spend)).toBe(minor);
  });

  it('не число: отказ, а не ноль', () => {
    expect(() => metaSpendMinor('abc')).toThrow(MetaApiError);
  });
});
