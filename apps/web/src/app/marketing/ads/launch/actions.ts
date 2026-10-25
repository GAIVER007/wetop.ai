'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { FinanceRuleError, parseMoney } from '@pms/domain';
import { msg } from '../../../../i18n';
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FRAME_PREFIX = 'data:image/jpeg;base64,';
/** ИИ получает 2–4 кадра видео (техпроект §6, контракт ad-proposal/0) */
const FRAMES_MIN = 2;
const FRAMES_MAX = 4;

type Creative = { kind: 'IMAGE'; file: File } | { kind: 'VIDEO'; id: string | null };

/**
 * Креатив из формы. Фото едет файлом в самой форме. Видео в форме не едет (предел тела действия 11 МБ): оно
 * загружено отдельным запросом заранее, форма несёт только номер креатива (`creativeId`) и кадры для ИИ (`frame`).
 */
function creativeOf(fd: FormData): Creative | string {
  if (s(fd, 'creativeKind') === 'VIDEO') {
    const id = s(fd, 'creativeId');
    return { kind: 'VIDEO', id: UUID.test(id) ? id : null };
  }
  const file = fd.get('creative');
  if (!(file instanceof File) || file.size === 0) return msg('Загрузите фото или видео креатива');
  if (!IMAGE_TYPES.includes(file.type)) return msg('Креатив: фото JPEG или PNG, видео MP4 или MOV');
  if (file.size > 8 * 1024 * 1024) return msg('Фото больше 8 МБ');
  return { kind: 'IMAGE', file };
}

/** Кадры JPEG из формы: только настоящие JPEG в base64, не больше четырёх */
function framesOf(fd: FormData): string[] {
  return fd
    .getAll('frame')
    .filter((v): v is string => typeof v === 'string' && v.startsWith(FRAME_PREFIX) && v.length > FRAME_PREFIX.length)
    .slice(0, FRAMES_MAX)
    .map((v) => v.slice(FRAME_PREFIX.length));
}

/** «Подготовить с ИИ»: фото и оффер в ИИ, ответ возвращается в поля мастера */
export async function proposeAdAction(_prev: LaunchActionResult, fd: FormData): Promise<LaunchActionResult> {
  const creative = creativeOf(fd);
  if (typeof creative === 'string') return { error: creative, ok: 0 };
  let images: Array<{ mediaType: string; dataBase64: string }>;
  if (creative.kind === 'VIDEO') {
    const frames = framesOf(fd);
    if (frames.length < FRAMES_MIN)
      return { error: msg('Кадры видео не сняты: напишите текст объявления руками или выберите другой файл'), ok: 0 };
    images = frames.map((dataBase64) => ({ mediaType: 'image/jpeg', dataBase64 }));
  } else {
    images = [{ mediaType: creative.file.type, dataBase64: Buffer.from(await creative.file.arrayBuffer()).toString('base64') }];
  }
  try {
    const proposal = await marketingAdsApi.proposal({
      destination: s(fd, 'destination'),
      offer: s(fd, 'offer'),
      creativeKind: creative.kind,
      images,
      city: s(fd, 'cityName') || s(fd, 'country'),
      country: s(fd, 'country'),
    });
    return { error: null, ok: Date.now(), proposal, message: msg('ИИ подготовил текст и аудиторию: проверьте и поправьте') };
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
  const creativeInput = creativeOf(fd);
  if (typeof creativeInput === 'string') return { error: creativeInput, ok: 0 };
  if (creativeInput.kind === 'VIDEO' && !creativeInput.id)
    return { error: msg('Дождитесь загрузки видео: оно ещё не сохранено'), ok: 0 };
  let daily: bigint;
  try {
    daily = parseMoney(s(fd, 'dailyBudget'));
  } catch (e) {
    return { error: e instanceof FinanceRuleError ? e.message : describe(e), ok: 0 };
  }
  if (daily <= 0n) return { error: msg('Бюджет в день: сумма больше нуля'), ok: 0 };
  let id: string;
  try {
    const creativeId =
      creativeInput.kind === 'VIDEO' ? creativeInput.id! : (await marketingAdsApi.uploadCreative(creativeInput.file)).id;
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
        creativeId,
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
  return { error: null, ok: Date.now(), message: pause ? msg('Кампания остановлена в Meta') : msg('Кампания снова идёт в Meta') };
}
