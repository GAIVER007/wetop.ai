'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { FinanceRuleError, parseMoney } from '@pms/domain';
import { ApiError, marketingAdsApi, type MarketingAdProposal } from '../../../../lib/api';

/**
 * Действия мастера «Новая кампания с ИИ» (DATA_MODEL §57, ADR-MKT-LAUNCH). Фото креатива едет с формой и в
 * «Подготовить с ИИ», и в «Запустить кампанию»: стойка ничего не хранит между шагами, тот же файл API второй раз не
 * сохраняет (по сумме sha256).
 */
export interface LaunchActionResult {
  error: string | null;
  ok: number;
  proposal?: MarketingAdProposal;
  message?: string;
}

const describe = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v.trim() : '';
};
/** Switch шлёт пару значений: скрытое false и, если включено, true; значением считается последнее */
const on = (fd: FormData, k: string) => fd.getAll(k).at(-1) === 'true';
const IMAGE_TYPES = ['image/jpeg', 'image/png'];

function creativeOf(fd: FormData): File | string {
  const file = fd.get('creative');
  if (!(file instanceof File) || file.size === 0) return 'Загрузите фото креатива';
  if (!IMAGE_TYPES.includes(file.type)) return 'Креатив: фото JPEG или PNG';
  if (file.size > 8 * 1024 * 1024) return 'Фото больше 8 МБ';
  return file;
}

/** «Подготовить с ИИ»: фото и оффер в ИИ, ответ возвращается в поля мастера */
export async function proposeAdAction(_prev: LaunchActionResult, fd: FormData): Promise<LaunchActionResult> {
  const file = creativeOf(fd);
  if (typeof file === 'string') return { error: file, ok: 0 };
  try {
    const proposal = await marketingAdsApi.proposal({
      destination: s(fd, 'destination'),
      offer: s(fd, 'offer'),
      creativeKind: 'IMAGE',
      images: [{ mediaType: file.type, dataBase64: Buffer.from(await file.arrayBuffer()).toString('base64') }],
      city: s(fd, 'cityName') || s(fd, 'country'),
      country: s(fd, 'country'),
    });
    return { error: null, ok: Date.now(), proposal, message: 'ИИ подготовил текст и аудиторию: проверьте и поправьте' };
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
}

/** Поиск города Meta для таргетинга */
export async function searchCityAction(q: string, country: string) {
  try {
    return { cities: await marketingAdsApi.geo(q, country), error: null };
  } catch (e) {
    return { cities: [], error: describe(e) };
  }
}

/** «Запустить кампанию»: креатив в хранилище, запуск в API, затем экран шагов */
export async function launchAdAction(_prev: LaunchActionResult, fd: FormData): Promise<LaunchActionResult> {
  const file = creativeOf(fd);
  if (typeof file === 'string') return { error: file, ok: 0 };
  let daily: bigint;
  try {
    daily = parseMoney(s(fd, 'dailyBudget'));
  } catch (e) {
    return { error: e instanceof FinanceRuleError ? e.message : describe(e), ok: 0 };
  }
  if (daily <= 0n) return { error: 'Бюджет в день: сумма больше нуля', ok: 0 };
  let id: string;
  try {
    const creative = await marketingAdsApi.uploadCreative(file);
    const gender = s(fd, 'gender');
    const parseJson = (k: string) => {
      try {
        return JSON.parse(s(fd, k) || 'null') as unknown;
      } catch {
        return null;
      }
    };
    id = (
      await marketingAdsApi.start({
        requestKey: s(fd, 'requestKey'),
        creativeId: creative.id,
        destination: s(fd, 'destination'),
        dailyBudgetMinor: daily.toString(),
        fxRate: s(fd, 'fxRate') || '1',
        headline: s(fd, 'headline'),
        primaryText: s(fd, 'primaryText'),
        description: s(fd, 'description'),
        pageId: s(fd, 'pageId'),
        instagramUserId: on(fd, 'useInstagram') ? s(fd, 'instagramUserId') : '',
        leadFormId: s(fd, 'leadFormId'),
        link: s(fd, 'link'),
        countryCode: s(fd, 'country'),
        cities: parseJson('cities') ?? [],
        ageMin: Number(s(fd, 'ageMin')),
        ageMax: Number(s(fd, 'ageMax')),
        genders: gender === '1' || gender === '2' ? [Number(gender)] : [],
        advantageAudience: on(fd, 'advantageAudience'),
        welcome: { text: s(fd, 'welcomeText'), autofill: s(fd, 'welcomeAutofill') },
        proposal: parseJson('proposal'),
      })
    ).id;
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  revalidatePath('/marketing/ads');
  redirect(`/marketing/ads/launch/${id}`);
}

/** «Остановить» и «Включить» кампании из кабинета: сначала Meta, потом WETOP */
export async function campaignStatusAction(_prev: LaunchActionResult, fd: FormData): Promise<LaunchActionResult> {
  const id = s(fd, 'campaignId');
  const pause = s(fd, 'to') === 'PAUSED';
  try {
    await (pause ? marketingAdsApi.pause(id) : marketingAdsApi.resume(id));
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
  revalidatePath('/marketing/ads');
  return { error: null, ok: Date.now(), message: pause ? 'Кампания остановлена в Meta' : 'Кампания снова идёт в Meta' };
}
