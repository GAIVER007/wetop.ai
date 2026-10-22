import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ closeCallback: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock('next/cache', () => cache);
vi.mock('../../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api')>()),
  marketingVoiceApi: api,
}));

import { ApiError } from '../../../lib/api';
import { closeCallbackAction } from './actions';

const NONE = { error: null, ok: 0 };
const ID = '7b61f3e1-0000-4000-8000-000000000001';
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  api.closeCallback.mockResolvedValue({ id: ID, status: 'DONE' });
});

describe('закрыть просьбу о звонке', () => {
  it('вызывает API с идентификатором, обновляет раздел и хаб, сообщает об успехе', async () => {
    const r = await closeCallbackAction(NONE, form({ callbackId: ID }));
    expect(api.closeCallback).toHaveBeenCalledWith(ID);
    expect(r.error).toBeNull();
    expect(r.ok).toBeGreaterThan(0);
    const paths = cache.revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(expect.arrayContaining(['/marketing/voice', '/marketing']));
  });

  it('сбой сети или сервера не показывает текст исключения (адреса, коды)', async () => {
    api.closeCallback.mockRejectedValue(new Error('fetch failed: connect ECONNREFUSED http://internal:3001'));
    const r = await closeCallbackAction(NONE, form({ callbackId: ID }));
    expect(r.error).toBe('Не удалось сохранить. Попробуйте ещё раз.');
    expect(r.error).not.toMatch(/ECONNREFUSED|internal/);
  });

  it('не UUID: ошибка словами, API не зовётся', async () => {
    const r = await closeCallbackAction(NONE, form({ callbackId: 'x' }));
    expect(r.error).toMatch(/просьб/i);
    expect(api.closeCallback).not.toHaveBeenCalled();
  });

  it('отказ API показывается словами сервера, без перезагрузки данных', async () => {
    api.closeCallback.mockRejectedValue(new ApiError(404, 'Просьба не найдена'));
    const r = await closeCallbackAction(NONE, form({ callbackId: ID }));
    expect(r.error).toBe('Просьба не найдена');
    expect(r.ok).toBe(0);
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });
});
