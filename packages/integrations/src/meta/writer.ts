/**
 * Meta Marketing API: создание рекламы и смена её статуса (ИИ-таргетолог, DATA_MODEL §57, ADR-MKT-LAUNCH; ADR-004: код
 * площадки только здесь). Документация: docs/meta/create.md (снято с developers.facebook.com 16.10.2026).
 *
 * Снаружи слова WETOP (куда ведёт реклама, бюджет в minor units), внутри слова Meta (objective, destination_type,
 * optimization_goal, CTA) по таблице create.md §4.5. Объекты создаются сразу ACTIVE (решение владельца 16.10.2026);
 * остановка: `setStatus(id, 'PAUSED')`. Создание при обрыве сети не повторяется: объект мог появиться (graphCall).
 */
import { graphCall, META_API_VERSION, MetaApiError, type GraphTransport } from './client';

const BASE = 'https://graph.facebook.com';

export type MetaDestination =
  'LEAD_FORM' | 'WHATSAPP' | 'MESSENGER' | 'INSTAGRAM_DIRECT' | 'WEBSITE';
type Supported = 'LEAD_FORM' | 'WHATSAPP' | 'WEBSITE';

/** create.md §4.5: цель, назначение, оптимизация, оплата и кнопка по сценарию */
const PLAN: Record<
  Supported,
  {
    objective: string;
    destinationType: string | null;
    optimization: string;
    cta: string;
    link: string | null;
  }
> = {
  LEAD_FORM: {
    objective: 'OUTCOME_LEADS',
    destinationType: 'ON_AD',
    optimization: 'LEAD_GENERATION',
    cta: 'SIGN_UP',
    link: 'https://fb.me/',
  },
  WHATSAPP: {
    objective: 'OUTCOME_ENGAGEMENT',
    destinationType: 'WHATSAPP',
    optimization: 'CONVERSATIONS',
    cta: 'WHATSAPP_MESSAGE',
    link: 'https://api.whatsapp.com/send',
  },
  // трафик на сайт; конверсии по пикселю (pixel_id, conversion_domain) позже
  WEBSITE: {
    objective: 'OUTCOME_TRAFFIC',
    destinationType: null,
    optimization: 'LANDING_PAGE_VIEWS',
    cta: 'LEARN_MORE',
    link: null,
  },
};

function plan(destination: MetaDestination) {
  if (destination === 'MESSENGER' || destination === 'INSTAGRAM_DIRECT')
    // ponytail: для Messenger и Direct ссылка link_data в документации не описана (create.md §5.2); открыть после validate_only на живом кабинете
    throw new MetaApiError(
      'Реклама в Messenger и Instagram Direct из WETOP пока не запускается',
      0,
      false,
    );
  return PLAN[destination];
}

/**
 * Валюты со смещением 100 по странице «Currencies» (create.md §4.1): единица API это 1/100, то есть наши minor units.
 * Остальные, и тенге в первую очередь, закрыты: ошибка единиц стоила бы клиенту денег в 100 раз (Q-MKT-KZT).
 */
const OFFSET_100 = new Set(['USD', 'EUR', 'RUB']);

export function metaBudgetUnits(minor: bigint, currency: string): number {
  const c = currency.toUpperCase();
  if (!OFFSET_100.has(c))
    throw new MetaApiError(
      `Запуск в валюте кабинета ${c} пока закрыт: Meta не говорит, в каких единицах её бюджет (Q-MKT-KZT)`,
      0,
      false,
    );
  return Number(minor);
}

/** Функции Advantage+ creative, которые меняют текст и картинку без ведома клиента: выключаются явно (create.md §5.7) */
const OPT_OUT = [
  'text_optimizations',
  'image_touchups',
  'image_templates',
  'image_uncrop',
  'image_animation',
  'image_background_gen',
  'image_brightness_and_contrast',
  'enhance_cta',
  'add_text_overlay',
  'text_translation',
  'description_automation',
  'creative_stickers',
] as const;

export interface MetaAdSetSpec {
  name: string;
  campaignId: string;
  destination: MetaDestination;
  /** Бюджет дня в minor units валюты кабинета */
  dailyBudgetMinor: bigint;
  currency: string;
  pageId: string;
  /** Код страны филиала: нужен, когда городов нет */
  countryCode: string;
  /** Ключи городов из searchCities */
  cityKeys: string[];
  ageMin: number;
  ageMax: number;
  /** [] все, [1] мужчины, [2] женщины */
  genders: number[];
  /** Advantage+ audience: Meta расширяет аудиторию; тогда возраст от 18–25 и без верхней границы (create.md §4.4) */
  advantageAudience: boolean;
}

export interface MetaCreativeSpec {
  name: string;
  destination: MetaDestination;
  pageId: string;
  instagramUserId: string | null;
  media:
    { kind: 'IMAGE'; imageHash: string } | { kind: 'VIDEO'; videoId: string; thumbnailUrl: string };
  message: string;
  headline: string;
  description: string | null;
  /** Адрес сайта (только WEBSITE) */
  link: string | null;
  leadFormId: string | null;
  /** Приветствие в WhatsApp и заготовка ответа клиента (create.md §5.5) */
  welcome: { text: string; autofill: string } | null;
  /** UTM, например `utm_content={{ad.id}}`; пусто: без меток */
  urlTags: string;
}

/** Страница, отмеченная клиентом в окне входа (create.md §9); реклама от её имени требует задачи ADVERTISE */
export interface MetaPage {
  id: string;
  name: string;
  canAdvertise: boolean;
  /** Instagram, привязанный к странице (`instagram_business_account`); null: нет */
  instagramUserId: string | null;
}

export interface MetaCity {
  key: string;
  name: string;
  region: string;
}

export interface MetaAdsWriterOptions {
  accessToken: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const actPath = (adAccountId: string) =>
  adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

export class MetaAdsWriter {
  private readonly t: GraphTransport;

  constructor(options: MetaAdsWriterOptions) {
    this.t = {
      accessToken: options.accessToken,
      fetch: options.fetch ?? fetch,
      sleep: options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    };
  }

  /** Картинка в библиотеку кабинета: `bytes` Base64 → `hash` (create.md §1) */
  async uploadImage(
    adAccountId: string,
    file: { fileName: string; bytes: Uint8Array },
  ): Promise<string> {
    const r = await this.post<{ images?: Record<string, { hash?: string }> }>(
      `${actPath(adAccountId)}/adimages`,
      { bytes: Buffer.from(file.bytes).toString('base64') },
      true,
    );
    const hash = Object.values(r.images ?? {})[0]?.hash;
    if (!hash) throw new MetaApiError('Meta не вернула номер картинки', 0, false);
    return hash;
  }

  /** Видео в библиотеку кабинета файлом `source` (create.md §2.1); готовность: `video` */
  async uploadVideo(
    adAccountId: string,
    file: { fileName: string; bytes: Uint8Array; mimeType: string },
  ): Promise<string> {
    const form = new FormData();
    form.set('source', new Blob([new Uint8Array(file.bytes)], { type: file.mimeType }), file.fileName);
    // ponytail: одна часть формой; загрузка частями (create.md §2.1, протокол не описан) для видео больше предела тела
    const r = await graphCall<{ id?: string }>(
      this.t,
      this.url(`${actPath(adAccountId)}/advideos`),
      {
        method: 'POST',
        body: form,
      },
      false,
    );
    if (!r.id) throw new MetaApiError('Meta не вернула номер видео', 0, false);
    return String(r.id);
  }

  /** Готовность видео и превью (create.md §2.3, §2.4); креатив с видео только после `ready` */
  async video(videoId: string): Promise<{ status: string; picture: string | null }> {
    const url = new URL(this.url(videoId));
    url.searchParams.set('fields', 'status,picture');
    const r = await graphCall<{ status?: { video_status?: string }; picture?: string }>(
      this.t,
      url.toString(),
    );
    return { status: String(r.status?.video_status ?? ''), picture: r.picture ?? null };
  }

  /** Кампания: бюджет на группе (`is_adset_budget_sharing_enabled` обязателен с v24.0), без особой категории (create.md §3) */
  async createCampaign(
    adAccountId: string,
    c: { name: string; destination: MetaDestination },
  ): Promise<string> {
    return this.create(`${actPath(adAccountId)}/campaigns`, {
      name: c.name,
      objective: plan(c.destination).objective,
      status: 'ACTIVE',
      special_ad_categories: '[]',
      is_adset_budget_sharing_enabled: 'false',
    });
  }

  /** Группа объявлений: бюджет дня, назначение, страница, аудитория (create.md §4) */
  async createAdSet(adAccountId: string, s: MetaAdSetSpec): Promise<string> {
    const p = plan(s.destination);
    if (s.advantageAudience && (s.ageMin < 18 || s.ageMin > 25))
      throw new MetaApiError(
        'С расширением аудитории Meta минимальный возраст только 18–25',
        0,
        false,
      );
    const targeting: Record<string, unknown> = {
      geo_locations: s.cityKeys.length
        ? { cities: s.cityKeys.map((key) => ({ key })) }
        : { countries: [s.countryCode] },
      age_min: s.ageMin,
      ...(s.advantageAudience ? {} : { age_max: s.ageMax }),
      ...(s.genders.length ? { genders: s.genders } : {}),
      targeting_automation: { advantage_audience: s.advantageAudience ? 1 : 0 },
    };
    return this.create(`${actPath(adAccountId)}/adsets`, {
      name: s.name,
      campaign_id: s.campaignId,
      daily_budget: String(metaBudgetUnits(s.dailyBudgetMinor, s.currency)),
      billing_event: 'IMPRESSIONS',
      optimization_goal: p.optimization,
      ...(p.destinationType ? { destination_type: p.destinationType } : {}),
      ...(s.destination === 'WEBSITE'
        ? {}
        : { promoted_object: JSON.stringify({ page_id: s.pageId }) }),
      targeting: JSON.stringify(targeting),
      status: 'ACTIVE',
    });
  }

  /** Креатив: пост от страницы (и Instagram), кнопка по назначению, улучшения Meta выключены (create.md §5) */
  async createCreative(adAccountId: string, c: MetaCreativeSpec): Promise<string> {
    const p = plan(c.destination);
    const link = p.link ?? c.link;
    if (!link) throw new MetaApiError('Для рекламы сайта нужен адрес', 0, false);
    if (c.destination === 'LEAD_FORM' && !c.leadFormId)
      throw new MetaApiError('Для заявок нужна форма', 0, false);
    const value: Record<string, string> =
      c.destination === 'LEAD_FORM'
        ? { link, lead_gen_form_id: c.leadFormId! }
        : c.destination === 'WHATSAPP'
          ? { app_destination: 'WHATSAPP' }
          : { link };
    const call_to_action = { type: p.cta, value };
    const welcome =
      c.destination === 'WHATSAPP' && c.welcome
        ? {
            page_welcome_message: JSON.stringify({
              type: 'VISUAL_EDITOR',
              version: 2,
              landing_screen_type: 'welcome_message',
              media_type: 'text',
              text_format: {
                customer_action_type: 'autofill_message',
                message: {
                  text: c.welcome.text,
                  autofill_message: { content: c.welcome.autofill },
                },
              },
            }),
          }
        : {};
    const story: Record<string, unknown> = { page_id: c.pageId };
    if (c.instagramUserId) story.instagram_user_id = c.instagramUserId;
    if (c.media.kind === 'IMAGE')
      story.link_data = {
        image_hash: c.media.imageHash,
        link,
        message: c.message,
        name: c.headline,
        ...(c.description ? { description: c.description } : {}),
        call_to_action,
        ...welcome,
      };
    else
      story.video_data = {
        video_id: c.media.videoId,
        image_url: c.media.thumbnailUrl,
        title: c.headline,
        message: c.message,
        call_to_action,
        ...welcome,
      };
    return this.create(`${actPath(adAccountId)}/adcreatives`, {
      name: c.name,
      object_story_spec: JSON.stringify(story),
      degrees_of_freedom_spec: JSON.stringify({
        creative_features_spec: Object.fromEntries(
          OPT_OUT.map((f) => [f, { enroll_status: 'OPT_OUT' }]),
        ),
      }),
      ...(c.urlTags ? { url_tags: c.urlTags } : {}),
    });
  }

  /** Объявление: группа и креатив, сразу ACTIVE (create.md §6) */
  async createAd(
    adAccountId: string,
    a: { name: string; adSetId: string; creativeId: string },
  ): Promise<string> {
    return this.create(`${actPath(adAccountId)}/ads`, {
      name: a.name,
      adset_id: a.adSetId,
      creative: JSON.stringify({ creative_id: a.creativeId }),
      status: 'ACTIVE',
    });
  }

  /** «Остановить» и «Включить»: кампания, группа или объявление (create.md §7); повтор безопасен */
  async setStatus(objectId: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
    await this.post(objectId, { status }, true);
  }

  /** Страницы системного пользователя входа: `/me`, затем `assigned_pages`, все страницы (create.md §9) */
  async assignedPages(): Promise<MetaPage[]> {
    const who = await graphCall<{ id?: string }>(this.t, this.url('me'));
    if (!who.id) throw new MetaApiError('Meta не назвала системного пользователя входа', 0, false);
    const first = new URL(this.url(`${encodeURIComponent(who.id)}/assigned_pages`));
    first.searchParams.set('fields', 'id,name,tasks,instagram_business_account');
    const out: MetaPage[] = [];
    let next: string | undefined = first.toString();
    while (next) {
      const page: {
        data?: Array<{ id?: string; name?: string; tasks?: string[]; instagram_business_account?: { id?: string } }>;
        paging?: { next?: string };
      } = await graphCall(this.t, next);
      for (const p of page.data ?? [])
        if (p.id)
          out.push({
            id: String(p.id),
            name: String(p.name ?? '').trim() || String(p.id),
            canAdvertise: (p.tasks ?? []).includes('ADVERTISE'),
            instagramUserId: p.instagram_business_account?.id ? String(p.instagram_business_account.id) : null,
          });
      next = page.paging?.next;
    }
    return out;
  }

  /** Города для таргетинга в стране филиала (create.md §8) */
  async searchCities(q: string, countryCode: string): Promise<MetaCity[]> {
    const url = new URL(this.url('search'));
    url.searchParams.set('type', 'adgeolocation');
    url.searchParams.set('q', q);
    url.searchParams.set('location_types', '["city"]');
    url.searchParams.set('country_code', countryCode);
    url.searchParams.set('limit', '10');
    const r = await graphCall<{ data?: Array<{ key?: string; name?: string; region?: string }> }>(
      this.t,
      url.toString(),
    );
    return (r.data ?? [])
      .filter((c) => c.key)
      .map((c) => ({
        key: String(c.key),
        name: String(c.name ?? ''),
        region: String(c.region ?? ''),
      }));
  }

  private url(path: string): string {
    const u = new URL(`${BASE}/${META_API_VERSION}/${path}`);
    u.searchParams.set('access_token', this.t.accessToken);
    return u.toString();
  }

  private post<T>(
    path: string,
    fields: Record<string, string>,
    retryNoAnswer: boolean,
  ): Promise<T> {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    return graphCall<T>(this.t, this.url(path), { method: 'POST', body: form }, retryNoAnswer);
  }

  private async create(path: string, fields: Record<string, string>): Promise<string> {
    const r = await this.post<{ id?: string }>(path, fields, false);
    if (!r.id) throw new MetaApiError('Meta не вернула номер созданного объекта', 0, false);
    return String(r.id);
  }
}
