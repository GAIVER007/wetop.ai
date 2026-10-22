import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  proposal: vi.fn(),
  uploadCreative: vi.fn(),
  start: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock('../../../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../lib/api')>()),
  marketingAdsApi: api,
}));

import { launchAdAction, proposeAdAction } from './actions';

/** Мастер «Новая кампания с ИИ»: видео едет отдельной загрузкой, в действия формы попадают только номер и кадры */
const NONE = { error: null, ok: 0 };
const VIDEO_ID = '00000000-0000-4000-a000-0000000c0002';
const FRAME = `data:image/jpeg;base64,${Buffer.from('jpeg-frame').toString('base64')}`;

function form(fields: Record<string, string | string[] | File>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.set(k, v);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.proposal.mockResolvedValue({ headline: 'Осень у гор' });
  api.uploadCreative.mockResolvedValue({ id: '00000000-0000-4000-a000-0000000c0001' });
  api.start.mockResolvedValue({ id: '00000000-0000-4000-a000-0000000a0001' });
});

describe('«Подготовить с ИИ» для видео', () => {
  it('отправляет ИИ кадры JPEG и креатив VIDEO, самого файла нет', async () => {
    const r = await proposeAdAction(
      NONE,
      form({ creativeKind: 'VIDEO', destination: 'WHATSAPP', offer: 'Осень', country: 'KZ', frame: [FRAME, FRAME, FRAME] }),
    );
    expect(r.error).toBeNull();
    expect(api.proposal).toHaveBeenCalledTimes(1);
    const sent = api.proposal.mock.calls[0]![0] as { creativeKind: string; images: Array<{ mediaType: string; dataBase64: string }> };
    expect(sent.creativeKind).toBe('VIDEO');
    expect(sent.images).toHaveLength(3);
    expect(sent.images[0]).toEqual({ mediaType: 'image/jpeg', dataBase64: Buffer.from('jpeg-frame').toString('base64') });
  });

  it('меньше двух кадров: ИИ не зовётся, слова про ручной ввод', async () => {
    const r = await proposeAdAction(NONE, form({ creativeKind: 'VIDEO', destination: 'WHATSAPP', frame: [FRAME] }));
    expect(r.error).toMatch(/кадры видео не сняты/i);
    expect(api.proposal).not.toHaveBeenCalled();
  });

  it('чужие строки вместо кадров отбрасываются, больше четырёх кадров не уходит', async () => {
    const r = await proposeAdAction(
      NONE,
      form({ creativeKind: 'VIDEO', destination: 'WHATSAPP', frame: ['javascript:alert(1)', FRAME, FRAME, FRAME, FRAME, FRAME] }),
    );
    expect(r.error).toBeNull();
    expect((api.proposal.mock.calls[0]![0] as { images: unknown[] }).images).toHaveLength(4);
  });

  it('фото работает как раньше: одно изображение, креатив IMAGE', async () => {
    const png = new File([Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], 'offer.png', { type: 'image/png' });
    await proposeAdAction(NONE, form({ destination: 'WHATSAPP', creative: png }));
    const sent = api.proposal.mock.calls[0]![0] as { creativeKind: string; images: unknown[] };
    expect(sent.creativeKind).toBe('IMAGE');
    expect(sent.images).toHaveLength(1);
  });
});

describe('«Запустить кампанию» с видео', () => {
  const base = { requestKey: 'k', destination: 'WHATSAPP', dailyBudget: '500', headline: 'Осень', primaryText: 'Текст', pageId: '555', country: 'KZ', ageMin: '25', ageMax: '54' };

  it('берёт номер уже загруженного креатива и ничего не загружает заново', async () => {
    await expect(launchAdAction(NONE, form({ ...base, creativeKind: 'VIDEO', creativeId: VIDEO_ID }))).rejects.toThrow(/REDIRECT/);
    expect(api.uploadCreative).not.toHaveBeenCalled();
    expect((api.start.mock.calls[0]![0] as { creativeId: string }).creativeId).toBe(VIDEO_ID);
  });

  it('без номера или с неверным номером запуск не начинается', async () => {
    for (const creativeId of ['', 'not-a-uuid']) {
      const r = await launchAdAction(NONE, form({ ...base, creativeKind: 'VIDEO', creativeId }));
      expect(r.error).toMatch(/дождитесь загрузки видео/i);
    }
    expect(api.start).not.toHaveBeenCalled();
  });

  it('фото по-прежнему грузится вместе с запуском', async () => {
    const png = new File([Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], 'offer.png', { type: 'image/png' });
    await expect(launchAdAction(NONE, form({ ...base, creative: png }))).rejects.toThrow(/REDIRECT/);
    expect(api.uploadCreative).toHaveBeenCalledTimes(1);
  });
});
