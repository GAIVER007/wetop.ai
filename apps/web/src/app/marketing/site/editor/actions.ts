'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { ApiError, branchesApi, marketingSiteApi, siteAssetsApi, siteEditorApi, type EditorReply, type SiteAssetView } from '../../../../lib/api';
import { selectBranch } from '../../../branches/actions';

/**
 * Действия редактора сайта (MKT9). Каждое зовёт API строгого scope филиала и возвращает стойке ответ как есть:
 * при отказе код и пути ошибок, чтобы ввод остался на экране, а поле подсветилось. Перезагрузки страницы до разбора
 * ошибки нет: несохранённый документ живёт только в браузере.
 */
const failed = (e: unknown): EditorReply<never> => ({
  ok: false,
  status: e instanceof ApiError ? e.status : 0,
  code: null,
  message: e instanceof Error ? e.message : 'Нет связи с сервером: изменения остались на экране',
  errors: [],
  paths: [],
});

async function safe<T>(fn: () => Promise<EditorReply<T>>): Promise<EditorReply<T>> {
  try {
    return await fn();
  } catch (e) {
    return failed(e);
  }
}

export async function saveDraftAction(baseRevision: number, spec: unknown) {
  const reply = await safe(() => siteEditorApi.save(baseRevision, spec));
  if (reply.ok) revalidatePath('/marketing/site');
  return reply;
}

export async function versionAction(id: string) {
  return safe(() => siteEditorApi.version(id));
}

export async function versionsAction() {
  try {
    const r = await siteEditorApi.versions();
    return { ok: true as const, versions: r.versions, bookmarks: r.bookmarks ?? [] };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Не удалось загрузить историю' };
  }
}

export async function diffAction(id: string, against: string) {
  return safe(() => siteEditorApi.diff(id, against));
}

export async function restoreAction(id: string, baseRevision: number) {
  const reply = await safe(() => siteEditorApi.restore(id, baseRevision));
  if (reply.ok) revalidatePath('/marketing/site');
  return reply;
}

/** Ссылка превью сохранённой версии: стойка сразу открывает её в новой вкладке и нигде не хранит */
export async function editorPreviewAction(versionId: string): Promise<{ url: string | null; error: string | null }> {
  try {
    return { url: (await marketingSiteApi.preview(versionId)).url, error: null };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : 'Предпросмотр недоступен' };
  }
}

/** ИИ-правка всего сайта: ключ повтора ставит сервер стойки, команда уходит как данные */
export async function patchAction(baseVersionId: string, instruction: string) {
  return safe(() => siteEditorApi.generate({ requestKey: randomUUID(), type: 'PATCH', baseVersionId, instruction }));
}

export async function sectionAction(baseVersionId: string, pageId: string, sectionId: string, instruction: string) {
  const text = instruction.trim();
  return safe(() =>
    siteEditorApi.generate({ requestKey: randomUUID(), type: 'SECTION', baseVersionId, pageId, sectionId, ...(text ? { instruction: text } : {}) }),
  );
}

/**
 * MKT9.2 и SITE-1, первый экран «Сайт и SEO»: сайт заводится пустым телом (имя и адрес из филиала, повтор отдаёт тот же),
 * затем первая сборка ИИ с текстом человека как пожеланием и с выбранным оформлением: готовым из набора домена
 * (`presetId`, сервер берёт направление сам) или из ответа ИИ (`runId` + `id`). Хэш брифа тот, что видел человек на
 * странице; у направления, где бриф на странице не читался (салон, ресторан до подключения API), его берёт сервер стойки
 * сразу после заведения сайта, поэтому после включения API экран работает без правок.
 */
export type SiteDesignChoice = { presetId: string } | { runId: string; id: string };

export async function createSiteAction(input: { briefHash: string | null; instruction: string; design?: SiteDesignChoice }) {
  const site = await safe(() => siteEditorApi.bootstrap());
  if (!site.ok) return { ok: false as const, siteCreated: false, status: site.status, message: site.message, code: site.code };
  let briefHash = input.briefHash;
  if (!briefHash) {
    try {
      briefHash = (await siteEditorApi.brief()).briefHash;
    } catch (e) {
      revalidatePath('/marketing/site');
      return {
        ok: false as const,
        siteCreated: true,
        status: e instanceof ApiError ? e.status : 0,
        message: e instanceof Error ? e.message : 'Нет связи с сервером',
        code: null,
      };
    }
  }
  const text = input.instruction.trim();
  const design = input.design;
  const reply = await safe(() =>
    siteEditorApi.generate({
      requestKey: randomUUID(),
      expectedBriefHash: briefHash,
      ...(text ? { instruction: text } : {}),
      ...(design && 'presetId' in design ? { designPresetId: design.presetId } : {}),
      ...(design && 'runId' in design ? { designRunId: design.runId, designId: design.id } : {}),
    }),
  );
  revalidatePath('/marketing/site');
  if (!reply.ok) return { ok: false as const, siteCreated: true, status: reply.status, message: reply.message, code: reply.code };
  return { ok: true as const, siteCreated: true, run: reply.data.run };
}

/**
 * SITE-1, «Шаблоны готовых сайтов»: сайт и первая версия одним действием из данных филиала в оформлении шаблона его
 * сегмента, без ИИ и без промптов. Документ собирает сервер; стойка передаёт только id шаблона
 */
export async function createFromTemplateAction(templateId: string) {
  const reply = await safe(() => siteEditorApi.fromTemplate(templateId));
  revalidatePath('/marketing/site');
  revalidatePath('/marketing/site/editor');
  return reply;
}

/**
 * SITE-1: выбор филиала на экране «Сайт и SEO». Тот же переключатель, что в шапке (`selectBranch`: кука указателя,
 * проверка по списку филиалов сессии), и возврат на этот же экран; филиал ищется по `locationId` в ответе сервера
 */
export async function chooseSiteLocationAction(locationId: string): Promise<{ ok: false; message: string }> {
  let branchId: string | null;
  try {
    const { items } = await branchesApi.list();
    branchId = items.find((b) => b.locationId === locationId)?.id ?? null;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Не удалось загрузить филиалы' };
  }
  if (!branchId) return { ok: false, message: 'Филиал недоступен. Обновите страницу.' };
  const form = new FormData();
  form.set('id', branchId);
  form.set('returnTo', '/marketing/site/editor');
  // `selectBranch` заканчивается переходом (redirect): он уходит наружу как есть
  await selectBranch(form);
  return { ok: false, message: 'Не удалось переключить филиал' };
}

/** MKT9.2: «Показать варианты оформления» на первом экране: сайт заводится, ИИ предлагает три направления */
export async function designFirstAction(instruction: string) {
  const site = await safe(() => siteEditorApi.bootstrap());
  if (!site.ok) return site;
  const text = instruction.trim();
  return safe(() => siteEditorApi.assistant({ requestKey: randomUUID(), mode: 'DESIGN', ...(text ? { text } : {}) }));
}

/**
 * MKT9.2: Чат, План и Оформление. Ответ на вопросы плана уходит с id задачи вопросов (`replyToRunId`): исходную просьбу и
 * точные вопросы сервер берёт из своей базы, а не из браузера
 */
export async function assistantAction(input: {
  mode: 'CHAT' | 'PLAN' | 'DESIGN';
  text: string;
  reply?: { runId: string; answers: Array<{ questionId: string; answer: string }> };
}) {
  const text = input.text.trim();
  return safe(() =>
    siteEditorApi.assistant({
      requestKey: randomUUID(),
      mode: input.mode,
      ...(text ? { text } : {}),
      ...(input.reply ? { replyToRunId: input.reply.runId, answers: input.reply.answers } : {}),
    }),
  );
}

export async function assistantRunAction(id: string) {
  return safe(() => siteEditorApi.assistantRun(id));
}

/** «Собрать по плану»: ровно одна задача сборки на план, повтор отдаёт ту же */
export async function approvePlanAction(id: string, instruction: string) {
  return safe(() => siteEditorApi.approve(id, instruction.trim() || undefined));
}

export async function conversationAction() {
  return safe(() => siteEditorApi.conversation());
}

export async function saveContextAction(instructions: string) {
  return safe(() => siteEditorApi.saveContext(instructions));
}

export async function bookmarkAction(id: string, label: string | null) {
  return safe(async () => {
    if (label === null) {
      const r = await siteEditorApi.removeBookmark(id);
      return r.ok ? { ok: true as const, data: null } : r;
    }
    const r = await siteEditorApi.bookmark(id, label);
    return r.ok ? { ok: true as const, data: r.data.bookmark.label } : r;
  });
}

export async function runAction(id: string) {
  return safe(() => siteEditorApi.run(id));
}

/**
 * SITE-1, простой экран: фото загружается прямо с экрана в библиотеку филиала (та же проверка API: тип по содержимому,
 * EXIF снимается) и сразу возвращается готовым ассетом для вставки в сайт. Отказ словами, без трассировки
 */
export async function uploadSitePhotoAction(form: FormData): Promise<{ ok: true; asset: SiteAssetView } | { ok: false; message: string }> {
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Выберите фото: JPEG, PNG или WebP' };
  if (file.size > 10 * 1024 * 1024) return { ok: false, message: 'Фото больше 10 МБ' };
  try {
    const { asset } = await siteAssetsApi.upload(file, 'IMAGE');
    revalidatePath('/marketing/site/assets');
    return { ok: true, asset };
  } catch (e) {
    if (e instanceof ApiError && e.status === 413) return { ok: false, message: 'Фото больше 10 МБ' };
    if (e instanceof ApiError && e.status === 429) return { ok: false, message: 'Лимит загрузок за час исчерпан, попробуйте позже' };
    if (e instanceof ApiError && e.status < 500) return { ok: false, message: e.message };
    return { ok: false, message: 'Не удалось загрузить фото, попробуйте ещё раз' };
  }
}

/** SITE-1, простой экран: шаблон сайта по свежим данным филиала (для включения блоков из шаблона) */
export async function templateFactsAction(locationId: string) {
  try {
    return { ok: true as const, facts: await marketingSiteApi.facts(locationId) };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Нет данных филиала' };
  }
}

/** SITE-1, простой экран: публикация одной кнопкой; тариф брони гостиницы сервер берёт сам, если он уже известен */
export async function publishSimpleAction(expectedVersionId: string): Promise<{ ok: true; url: string | null } | { ok: false; message: string; needsSetup: boolean }> {
  try {
    const r = await marketingSiteApi.publish(expectedVersionId);
    revalidatePath('/marketing/site');
    revalidatePath('/marketing/site/editor');
    return { ok: true, url: r.site.url };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Не удалось опубликовать';
    const needsSetup = e instanceof ApiError && e.status === 409 && /тариф/i.test(message);
    return { ok: false, message, needsSetup };
  }
}
