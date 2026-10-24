import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../lib/api';

const api = vi.hoisted(() => ({
  proposal: vi.fn(),
  week: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  published: vi.fn(),
  archive: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api')>()),
  contentApi: api,
}));

import { archiveDraftAction, proposeContentAction, publishedDraftAction, saveDraftAction } from './actions';

/** «Контент»: действия экрана черновиков. Ответ ИИ ничего не сохраняет; сохраняет человек; версия и ключ создания едут с формой */
const NONE = { error: null, ok: 0 };
const CREATION = '44444444-4444-4444-8444-444444444444';
const DRAFT = '55555555-5555-4555-8555-555555555555';

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.set(k, v);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.proposal.mockResolvedValue({ variants: [{ hook: 'h', body: 'b', hashtags: [], cta: 'NONE', warnings: [], preview: 'b', title: null }], ctas: ['NONE'] });
  api.create.mockResolvedValue({ id: DRAFT, revision: 1 });
  api.update.mockResolvedValue({ id: DRAFT, revision: 2 });
  api.published.mockResolvedValue({ id: DRAFT, revision: 2 });
  api.archive.mockResolvedValue({ id: DRAFT, revision: 3 });
});

describe('«Написать с ИИ»', () => {
  it('шлёт тему, канал и тон; варианты возвращаются в форму', async () => {
    const r = await proposeContentAction(NONE, form({ topic: '  Осенний уход ', channel: 'INSTAGRAM', tone: 'FRIENDLY' }));
    expect(api.proposal).toHaveBeenCalledWith({ topic: 'Осенний уход', channel: 'INSTAGRAM', tone: 'FRIENDLY' });
    expect(r.error).toBeNull();
    expect(r.variants).toHaveLength(1);
  });
  it('пустая тема: ИИ не зовётся', async () => {
    const r = await proposeContentAction(NONE, form({ topic: ' ', channel: 'INSTAGRAM', tone: 'FRIENDLY' }));
    expect(r.error).toMatch(/о чём пост/i);
    expect(api.proposal).not.toHaveBeenCalled();
  });
  it('ошибка API словами сервера', async () => {
    api.proposal.mockRejectedValue(new ApiError(503, 'ИИ сейчас недоступен: попробуйте позже или напишите пост сами'));
    const r = await proposeContentAction(NONE, form({ topic: 'x', channel: 'INSTAGRAM', tone: 'FRIENDLY' }));
    expect(r.error).toMatch(/ИИ сейчас недоступен/);
  });
});

describe('сохранение черновика', () => {
  it('новый: ключ создания, хештеги строкой → список, день публикации', async () => {
    const r = await saveDraftAction(
      NONE,
      form({
        creationId: CREATION,
        channel: 'INSTAGRAM',
        topic: 'Осенний уход',
        title: '',
        body: 'Текст',
        hashtags: '#уход, салон  осень',
        cta: 'BOOK_ONLINE',
        origin: 'AI',
        plannedOn: '2026-10-27',
      }),
    );
    expect(r.error).toBeNull();
    expect(api.create).toHaveBeenCalledWith({
      creationId: CREATION,
      channel: 'INSTAGRAM',
      topic: 'Осенний уход',
      title: '',
      body: 'Текст',
      hashtags: ['уход', 'салон', 'осень'],
      cta: 'BOOK_ONLINE',
      origin: 'AI',
      plannedOn: '2026-10-27',
    });
    expect(api.update).not.toHaveBeenCalled();
  });
  it('существующий: правка с expectedRevision, без ключа создания', async () => {
    await saveDraftAction(
      NONE,
      form({ id: DRAFT, expectedRevision: '3', channel: 'TELEGRAM', topic: 't', body: 'b', hashtags: '', cta: '', origin: 'MANUAL', plannedOn: '' }),
    );
    expect(api.update).toHaveBeenCalledWith(DRAFT, {
      expectedRevision: 3,
      channel: 'TELEGRAM',
      topic: 't',
      title: '',
      body: 'b',
      hashtags: [],
      cta: null,
      plannedOn: null,
    });
    expect(api.create).not.toHaveBeenCalled();
  });
  it('устаревшая версия: слова сервера, ввод не теряется', async () => {
    api.update.mockRejectedValue(new ApiError(409, 'Черновик уже изменили в другом окне: обновите страницу'));
    const r = await saveDraftAction(NONE, form({ id: DRAFT, expectedRevision: '1', channel: 'INSTAGRAM', topic: 't', body: 'b' }));
    expect(r.error).toMatch(/другом окне/);
  });
  it('без ключа создания и без id: отказ без запроса', async () => {
    const r = await saveDraftAction(NONE, form({ channel: 'INSTAGRAM', topic: 't', body: 'b' }));
    expect(r.error).toBeTruthy();
    expect(api.create).not.toHaveBeenCalled();
  });
});

describe('опубликован и архив', () => {
  it('передают id и версию', async () => {
    await publishedDraftAction(NONE, form({ id: DRAFT, expectedRevision: '1' }));
    expect(api.published).toHaveBeenCalledWith(DRAFT, 1);
    await archiveDraftAction(NONE, form({ id: DRAFT, expectedRevision: '2' }));
    expect(api.archive).toHaveBeenCalledWith(DRAFT, 2);
  });
});
