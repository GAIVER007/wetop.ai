import { describe, expect, it } from 'vitest';
import { MetaApiError } from './client';
import { MetaAdsWriter, metaBudgetUnits } from './writer';

/**
 * Создание рекламы в Meta по docs/meta/create.md на записанных ответах (сети нет). Кабинет, страница и тексты
 * вымышленные (ADR-010).
 */
const TOKEN = 'test-token-not-real';
const ACCOUNT = '1234567890';

type Call = { method: string; url: URL; form: Record<string, string> };
function fakeFetch(answers: Array<{ status?: number; body: unknown } | 'network'>) {
  const calls: Call[] = [];
  const fn = (async (input: string | URL, init?: RequestInit) => {
    const form: Record<string, string> = {};
    if (init?.body instanceof FormData)
      for (const [k, v] of init.body.entries())
        form[k] = typeof v === 'string' ? v : `file:${(v as File).name}`;
    calls.push({ method: init?.method ?? 'GET', url: new URL(String(input)), form });
    const a = answers.shift();
    if (!a) throw new Error('лишний запрос');
    if (a === 'network') throw new TypeError('fetch failed');
    return new Response(JSON.stringify(a.body), { status: a.status ?? 200 });
  }) as typeof fetch;
  return { fn, calls };
}
const writer = (fn: typeof fetch) =>
  new MetaAdsWriter({ accessToken: TOKEN, fetch: fn, sleep: async () => {} });
const path = (c: Call) => c.url.origin + c.url.pathname;

describe('Meta: единицы бюджета', () => {
  it('USD, EUR, RUB: смещение 100, наши minor units как есть', () => {
    expect(metaBudgetUnits(500n, 'USD')).toBe(500);
    expect(metaBudgetUnits(250000n, 'rub')).toBe(250000);
  });

  it('тенге и прочие валюты вне подтверждённого списка: отказ словами (Q-MKT-KZT), без запроса', () => {
    expect(() => metaBudgetUnits(500000n, 'KZT')).toThrow(/Q-MKT-KZT/);
    expect(() => metaBudgetUnits(500n, 'JPY')).toThrow(MetaApiError);
  });
});

describe('Meta: запуск по шагам', () => {
  it('кампания: цель по назначению, сразу ACTIVE, обязательные special_ad_categories и бюджет на группе', async () => {
    const { fn, calls } = fakeFetch([{ body: { id: '120000000000001', success: true } }]);
    const id = await writer(fn).createCampaign(ACCOUNT, {
      name: 'WETOP: осень',
      destination: 'WHATSAPP',
    });
    expect(id).toBe('120000000000001');
    const c = calls[0]!;
    expect(c.method).toBe('POST');
    expect(path(c)).toBe('https://graph.facebook.com/v25.0/act_1234567890/campaigns');
    expect(c.url.searchParams.get('access_token')).toBe(TOKEN);
    expect(c.form).toEqual({
      name: 'WETOP: осень',
      objective: 'OUTCOME_ENGAGEMENT',
      status: 'ACTIVE',
      special_ad_categories: '[]',
      is_adset_budget_sharing_enabled: 'false',
    });
  });

  it('цель по назначению: форма заявок OUTCOME_LEADS, сайт OUTCOME_TRAFFIC', async () => {
    const { fn, calls } = fakeFetch([{ body: { id: '1' } }, { body: { id: '2' } }]);
    await writer(fn).createCampaign(ACCOUNT, { name: 'a', destination: 'LEAD_FORM' });
    await writer(fn).createCampaign(ACCOUNT, { name: 'b', destination: 'WEBSITE' });
    expect(calls.map((c) => c.form.objective)).toEqual(['OUTCOME_LEADS', 'OUTCOME_TRAFFIC']);
  });

  it('группа WhatsApp: переписки, страница, бюджет в единицах Meta, города, точный возраст без Advantage+', async () => {
    const { fn, calls } = fakeFetch([{ body: { id: '120000000000002' } }]);
    const id = await writer(fn).createAdSet(ACCOUNT, {
      name: 'WETOP: осень, группа',
      campaignId: '120000000000001',
      destination: 'WHATSAPP',
      dailyBudgetMinor: 500n,
      currency: 'USD',
      pageId: '555',
      countryCode: 'KZ',
      cityKeys: ['1234567'],
      ageMin: 25,
      ageMax: 54,
      genders: [],
      advantageAudience: false,
    });
    expect(id).toBe('120000000000002');
    const f = calls[0]!.form;
    expect(path(calls[0]!)).toBe('https://graph.facebook.com/v25.0/act_1234567890/adsets');
    expect(f.destination_type).toBe('WHATSAPP');
    expect(f.optimization_goal).toBe('CONVERSATIONS');
    expect(f.billing_event).toBe('IMPRESSIONS');
    expect(f.daily_budget).toBe('500');
    expect(f.status).toBe('ACTIVE');
    expect(JSON.parse(f.promoted_object!)).toEqual({ page_id: '555' });
    expect(JSON.parse(f.targeting!)).toEqual({
      geo_locations: { cities: [{ key: '1234567' }] },
      age_min: 25,
      age_max: 54,
      targeting_automation: { advantage_audience: 0 },
    });
  });

  it('группа: без городов страна; Advantage+ без age_max; форма заявок ON_AD, сайт без назначения и страницы', async () => {
    const { fn, calls } = fakeFetch([{ body: { id: '3' } }, { body: { id: '4' } }]);
    const base = {
      name: 'g',
      campaignId: '1',
      dailyBudgetMinor: 1000n,
      currency: 'USD',
      pageId: '555',
      countryCode: 'KZ',
      cityKeys: [],
      ageMin: 21,
      ageMax: 65,
      genders: [2],
      advantageAudience: true,
    };
    await writer(fn).createAdSet(ACCOUNT, { ...base, destination: 'LEAD_FORM' });
    await writer(fn).createAdSet(ACCOUNT, { ...base, destination: 'WEBSITE' });
    const [lead, site] = calls.map((c) => c.form);
    expect(lead!.destination_type).toBe('ON_AD');
    expect(lead!.optimization_goal).toBe('LEAD_GENERATION');
    expect(JSON.parse(lead!.targeting!)).toEqual({
      geo_locations: { countries: ['KZ'] },
      age_min: 21,
      genders: [2],
      targeting_automation: { advantage_audience: 1 },
    });
    expect(site!.destination_type).toBeUndefined();
    expect(site!.promoted_object).toBeUndefined();
    expect(site!.optimization_goal).toBe('LANDING_PAGE_VIEWS');
  });

  it('Advantage+ и минимальный возраст старше 25: отказ до запроса (docs §4.4)', async () => {
    const { fn, calls } = fakeFetch([]);
    await expect(
      writer(fn).createAdSet(ACCOUNT, {
        name: 'g',
        campaignId: '1',
        destination: 'WHATSAPP',
        dailyBudgetMinor: 500n,
        currency: 'USD',
        pageId: '555',
        countryCode: 'KZ',
        cityKeys: [],
        ageMin: 30,
        ageMax: 65,
        genders: [],
        advantageAudience: true,
      }),
    ).rejects.toThrow(/18–25/);
    expect(calls).toHaveLength(0);
  });

  it('креатив WhatsApp с картинкой: Instagram, кнопка WhatsApp, приветствие, UTM, улучшения Meta выключены', async () => {
    const { fn, calls } = fakeFetch([{ body: { id: '120000000000003' } }]);
    const id = await writer(fn).createCreative(ACCOUNT, {
      name: 'WETOP: осень, креатив',
      destination: 'WHATSAPP',
      pageId: '555',
      instagramUserId: '777',
      media: { kind: 'IMAGE', imageHash: 'abc123' },
      message: 'Номер у моря, завтрак включён',
      headline: 'Осень у моря',
      description: null,
      link: null,
      leadFormId: null,
      welcome: { text: 'Здравствуйте! Подберём номер', autofill: 'Хочу узнать цены' },
      urlTags: 'utm_source=meta&utm_content={{ad.id}}',
    });
    expect(id).toBe('120000000000003');
    const f = calls[0]!.form;
    expect(path(calls[0]!)).toBe('https://graph.facebook.com/v25.0/act_1234567890/adcreatives');
    expect(f.url_tags).toBe('utm_source=meta&utm_content={{ad.id}}');
    const spec = JSON.parse(f.object_story_spec!);
    expect(spec.page_id).toBe('555');
    expect(spec.instagram_user_id).toBe('777');
    expect(spec.instagram_actor_id).toBeUndefined();
    expect(spec.link_data).toMatchObject({
      image_hash: 'abc123',
      link: 'https://api.whatsapp.com/send',
      message: 'Номер у моря, завтрак включён',
      name: 'Осень у моря',
      call_to_action: { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } },
    });
    expect(JSON.parse(spec.link_data.page_welcome_message)).toEqual({
      type: 'VISUAL_EDITOR',
      version: 2,
      landing_screen_type: 'welcome_message',
      media_type: 'text',
      text_format: {
        customer_action_type: 'autofill_message',
        message: {
          text: 'Здравствуйте! Подберём номер',
          autofill_message: { content: 'Хочу узнать цены' },
        },
      },
    });
    const dof = JSON.parse(f.degrees_of_freedom_spec!).creative_features_spec;
    expect(dof.text_optimizations).toEqual({ enroll_status: 'OPT_OUT' });
    expect(dof.image_touchups).toEqual({ enroll_status: 'OPT_OUT' });
    expect(dof.standard_enhancements).toBeUndefined();
  });

  it('креатив формы заявок: ссылка fb.me и форма в кнопке; видео: номер видео и превью', async () => {
    const { fn, calls } = fakeFetch([{ body: { id: '5' } }]);
    await writer(fn).createCreative(ACCOUNT, {
      name: 'c',
      destination: 'LEAD_FORM',
      pageId: '555',
      instagramUserId: null,
      media: { kind: 'VIDEO', videoId: '888', thumbnailUrl: 'https://example.test/thumb.jpg' },
      message: 'Текст',
      headline: 'Заголовок',
      description: null,
      link: null,
      leadFormId: '999',
      welcome: null,
      urlTags: '',
    });
    const spec = JSON.parse(calls[0]!.form.object_story_spec!);
    expect(spec.instagram_user_id).toBeUndefined();
    expect(spec.video_data).toEqual({
      video_id: '888',
      image_url: 'https://example.test/thumb.jpg',
      title: 'Заголовок',
      message: 'Текст',
      call_to_action: {
        type: 'SIGN_UP',
        value: { link: 'https://fb.me/', lead_gen_form_id: '999' },
      },
    });
    expect(calls[0]!.form.url_tags).toBeUndefined();
  });

  it('Messenger и Instagram Direct: отказ до запроса, ссылка креатива для них в документации не описана', async () => {
    const { fn, calls } = fakeFetch([]);
    await expect(
      writer(fn).createCampaign(ACCOUNT, { name: 'm', destination: 'MESSENGER' }),
    ).rejects.toThrow(/Messenger/);
    expect(calls).toHaveLength(0);
  });

  it('объявление: группа, креатив, сразу ACTIVE', async () => {
    const { fn, calls } = fakeFetch([{ body: { id: '120000000000004' } }]);
    const id = await writer(fn).createAd(ACCOUNT, { name: 'a', adSetId: '2', creativeId: '3' });
    expect(id).toBe('120000000000004');
    expect(path(calls[0]!)).toBe('https://graph.facebook.com/v25.0/act_1234567890/ads');
    expect(calls[0]!.form).toEqual({
      name: 'a',
      adset_id: '2',
      creative: '{"creative_id":"3"}',
      status: 'ACTIVE',
    });
  });

  it('пауза и включение: POST /{id} со статусом', async () => {
    const { fn, calls } = fakeFetch([{ body: { success: true } }]);
    await writer(fn).setStatus('120000000000001', 'PAUSED');
    expect(path(calls[0]!)).toBe('https://graph.facebook.com/v25.0/120000000000001');
    expect(calls[0]!.form).toEqual({ status: 'PAUSED' });
  });
});

describe('Meta: медиа и поиск города', () => {
  it('картинка: bytes в Base64, ответ images → hash', async () => {
    const { fn, calls } = fakeFetch([
      { body: { images: { 'offer.jpg': { hash: 'abc123', url: 'https://x' } } } },
    ]);
    const hash = await writer(fn).uploadImage(ACCOUNT, {
      fileName: 'offer.jpg',
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(hash).toBe('abc123');
    expect(path(calls[0]!)).toBe('https://graph.facebook.com/v25.0/act_1234567890/adimages');
    expect(calls[0]!.form.bytes).toBe('AQID');
  });

  it('видео: файл формой source, затем готовность и превью', async () => {
    const { fn, calls } = fakeFetch([
      { body: { id: '888' } },
      { body: { status: { video_status: 'processing' } } },
      { body: { status: { video_status: 'ready' }, picture: 'https://example.test/p.jpg' } },
    ]);
    const w = writer(fn);
    const id = await w.uploadVideo(ACCOUNT, {
      fileName: 'offer.mp4',
      bytes: new Uint8Array([1]),
      mimeType: 'video/mp4',
    });
    expect(id).toBe('888');
    expect(calls[0]!.form.source).toBe('file:offer.mp4');
    expect(await w.video('888')).toEqual({ status: 'processing', picture: null });
    expect(await w.video('888')).toEqual({
      status: 'ready',
      picture: 'https://example.test/p.jpg',
    });
    expect(calls[2]!.url.searchParams.get('fields')).toBe('status,picture');
  });

  it('город: поиск adgeolocation в стране филиала', async () => {
    const { fn, calls } = fakeFetch([
      {
        body: {
          data: [
            { key: '1234567', name: 'Алматы', type: 'city', country_code: 'KZ', region: 'Алматы' },
          ],
        },
      },
    ]);
    const cities = await writer(fn).searchCities('Алма', 'KZ');
    expect(cities).toEqual([{ key: '1234567', name: 'Алматы', region: 'Алматы' }]);
    const u = calls[0]!.url;
    expect(u.pathname).toBe('/v25.0/search');
    expect(u.searchParams.get('type')).toBe('adgeolocation');
    expect(u.searchParams.get('location_types')).toBe('["city"]');
    expect(u.searchParams.get('country_code')).toBe('KZ');
  });
});

describe('Meta: отказы при создании', () => {
  it('сеть оборвалась на создании: не повторяет (объект мог создаться), ошибка не к повтору', async () => {
    const { fn, calls } = fakeFetch(['network']);
    const err = await writer(fn)
      .createCampaign(ACCOUNT, { name: 'x', destination: 'WHATSAPP' })
      .catch((e: unknown) => e);
    expect(calls).toHaveLength(1);
    expect(err).toBeInstanceOf(MetaApiError);
    expect((err as MetaApiError).retryable).toBe(false);
  });

  it('предел вызовов на создании: Meta отказала, объекта нет, повтор безопасен', async () => {
    const { fn, calls } = fakeFetch([
      { status: 400, body: { error: { code: 4, message: 'limit' } } },
      { body: { id: '9' } },
    ]);
    expect(await writer(fn).createAd(ACCOUNT, { name: 'a', adSetId: '2', creativeId: '3' })).toBe(
      '9',
    );
    expect(calls).toHaveLength(2);
  });

  it('пауза: сеть повторяется (статус идемпотентен)', async () => {
    const { fn, calls } = fakeFetch(['network', { body: { success: true } }]);
    await writer(fn).setStatus('1', 'PAUSED');
    expect(calls).toHaveLength(2);
  });

  it('текст для человека из error_user_msg, подкод сохраняется, ключа в тексте нет', async () => {
    const { fn } = fakeFetch([
      {
        status: 400,
        body: {
          error: {
            code: 100,
            error_subcode: 1885272,
            message: `Invalid parameter ${TOKEN}`,
            error_user_msg: 'Бюджет слишком мал',
          },
        },
      },
    ]);
    const err = (await writer(fn)
      .createAd(ACCOUNT, { name: 'a', adSetId: '2', creativeId: '3' })
      .catch((e: unknown) => e)) as MetaApiError;
    expect(err.message).toBe('Meta: Бюджет слишком мал');
    expect(err.code).toBe(100);
    expect(err.subcode).toBe(1885272);
    expect(err.message).not.toContain(TOKEN);
  });
});

describe('Meta: страницы ключа для мастера', () => {
  it('системный пользователь, его страницы с задачами и Instagram, все страницы', async () => {
    const { fn, calls } = fakeFetch([
      { body: { id: '9001' } },
      {
        body: {
          data: [
            { id: '555', name: 'Отель на Абая', tasks: ['ADVERTISE', 'ANALYZE'], instagram_business_account: { id: '777' } },
          ],
          paging: { next: 'https://graph.facebook.com/v25.0/9001/assigned_pages?after=x' },
        },
      },
      { body: { data: [{ id: '556', name: 'Без рекламы', tasks: ['ANALYZE'] }], paging: {} } },
    ]);
    const pages = await writer(fn).assignedPages();
    expect(pages).toEqual([
      { id: '555', name: 'Отель на Абая', canAdvertise: true, instagramUserId: '777' },
      { id: '556', name: 'Без рекламы', canAdvertise: false, instagramUserId: null },
    ]);
    expect(path(calls[1]!)).toBe('https://graph.facebook.com/v25.0/9001/assigned_pages');
    expect(calls[1]!.url.searchParams.get('fields')).toBe('id,name,tasks,instagram_business_account');
  });
});
