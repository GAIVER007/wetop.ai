'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, contentApi, type ContentDraftView, type ContentVariantView } from '../../../lib/api';
import { msg } from '../../../i18n';

/**
 * Ошибки формы размечены `msg` и переводятся при показе (`studio.tsx`), слова сервера показываются как есть.
 *
 * Действия экрана «Контент» (CONTENT-DRAFTS-20261022). ИИ только предлагает варианты, сохраняет человек. Новый
 * черновик едет с ключом создания (повтор после потерянного ответа не делает второй строки), правка с версией.
 */
export interface ContentActionResult {
  error: string | null;
  ok: number;
  variants?: ContentVariantView[];
  draft?: ContentDraftView;
}

const describe = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v.trim() : '';
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** «#уход, салон  осень» → ['уход', 'салон', 'осень'] */
const tagsOf = (raw: string) =>
  raw
    .split(/[\s,;]+/)
    .map((t) => t.replace(/^#+/, ''))
    .filter(Boolean);
const revisionOf = (fd: FormData) => Number(s(fd, 'expectedRevision'));

export async function proposeContentAction(_prev: ContentActionResult, fd: FormData): Promise<ContentActionResult> {
  const topic = s(fd, 'topic');
  if (!topic) return { error: msg('Напишите, о чём пост'), ok: 0 };
  try {
    const r = await contentApi.proposal({ topic, channel: s(fd, 'channel'), tone: s(fd, 'tone') });
    return { error: null, ok: Date.now(), variants: r.variants };
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
}

export async function saveDraftAction(_prev: ContentActionResult, fd: FormData): Promise<ContentActionResult> {
  const id = s(fd, 'id');
  const common = {
    channel: s(fd, 'channel'),
    topic: s(fd, 'topic'),
    title: s(fd, 'title'),
    body: s(fd, 'body'),
    hashtags: tagsOf(s(fd, 'hashtags')),
  };
  try {
    let draft: ContentDraftView;
    if (id) {
      if (!UUID.test(id)) return { error: msg('Черновик не найден: обновите страницу'), ok: 0 };
      draft = await contentApi.update(id, {
        expectedRevision: revisionOf(fd),
        ...common,
        cta: s(fd, 'cta') || null,
        plannedOn: s(fd, 'plannedOn') || null,
      });
    } else {
      const creationId = s(fd, 'creationId');
      if (!UUID.test(creationId)) return { error: msg('Форма устарела: обновите страницу'), ok: 0 };
      draft = await contentApi.create({
        creationId,
        ...common,
        cta: s(fd, 'cta') || null,
        origin: s(fd, 'origin') === 'AI' ? 'AI' : 'MANUAL',
        plannedOn: s(fd, 'plannedOn') || null,
      });
    }
    revalidatePath('/marketing/content');
    return { error: null, ok: Date.now(), draft };
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
}

async function transition(fd: FormData, call: (id: string, rev: number) => Promise<ContentDraftView>) {
  const id = s(fd, 'id');
  if (!UUID.test(id)) return { error: msg('Черновик не найден: обновите страницу'), ok: 0 };
  try {
    const draft = await call(id, revisionOf(fd));
    revalidatePath('/marketing/content');
    return { error: null, ok: Date.now(), draft };
  } catch (e) {
    return { error: describe(e), ok: 0 };
  }
}

export async function publishedDraftAction(_prev: ContentActionResult, fd: FormData): Promise<ContentActionResult> {
  return transition(fd, (id, rev) => contentApi.published(id, rev));
}

export async function archiveDraftAction(_prev: ContentActionResult, fd: FormData): Promise<ContentActionResult> {
  return transition(fd, (id, rev) => contentApi.archive(id, rev));
}
