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
 * MKT9.2, первый экран «Сайт для …»: сайт заводится пустым телом (имя и адрес из филиала, повтор отдаёт тот же),
 * затем первая сборка ИИ с текстом человека как пожеланием или с выбранным направлением оформления. Хэш брифа тот, что
 * видел человек на этой странице
 */
export async function createSiteAction(input: { briefHash: string; instruction: string; design?: { runId: string; id: string } }) {
  const site = await safe(() => siteEditorApi.bootstrap());
  if (!site.ok) return { ok: false as const, siteCreated: false, message: site.message, code: site.code };
  const text = input.instruction.trim();
  const reply = await safe(() =>
    siteEditorApi.generate({
      requestKey: randomUUID(),
      expectedBriefHash: input.briefHash,
      ...(text ? { instruction: text } : {}),
      ...(input.design ? { designRunId: input.design.runId, designId: input.design.id } : {}),
    }),
  );
  revalidatePath('/marketing/site');
  if (!reply.ok) return { ok: false as const, siteCreated: true, message: reply.message, code: reply.code };
  return { ok: true as const, siteCreated: true, run: reply.data.run };
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
