'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { ApiError, marketingSiteApi, siteEditorApi, type EditorReply } from '../../../../lib/api';

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
    return { ok: true as const, versions: (await siteEditorApi.versions()).versions };
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
 * Окно «Создать сайт»: при надобности заводит сайт (название филиала, адрес из поля), затем ставит первую версию ИИ
 * (поток MKT6) с текстом человека как пожеланием. Хэш брифа тот, что видел человек на этой странице
 */
export async function createSiteAction(input: { createSite: boolean; name: string; slug: string; briefHash: string; instruction: string }) {
  let siteCreated = false;
  if (input.createSite) {
    try {
      await marketingSiteApi.create(input.name, input.slug.trim());
      siteCreated = true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось завести сайт';
      const field = e instanceof ApiError && (e.status === 400 || e.status === 409) && /Адрес/.test(message) ? ('slug' as const) : null;
      return { ok: false as const, siteCreated, field, message };
    }
  }
  const text = input.instruction.trim();
  const reply = await safe(() =>
    siteEditorApi.generate({ requestKey: randomUUID(), expectedBriefHash: input.briefHash, ...(text ? { instruction: text } : {}) }),
  );
  revalidatePath('/marketing/site');
  if (!reply.ok) return { ok: false as const, siteCreated: input.createSite ? siteCreated : true, field: null, message: reply.message };
  return { ok: true as const, siteCreated: true, run: reply.data.run };
}

export async function runAction(id: string) {
  return safe(() => siteEditorApi.run(id));
}
