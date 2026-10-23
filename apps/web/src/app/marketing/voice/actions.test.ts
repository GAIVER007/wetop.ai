import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ closeCallback: vi.fn(), saveBooking: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock('next/cache', () => cache);
vi.mock('../../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api')>()),
  marketingVoiceApi: api,
}));

import { ApiError } from '../../../lib/api';
import { closeCallbackAction, saveBookingAction } from './actions';

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
  api.saveBooking.mockResolvedValue({ enabled: true, maxPerCall: 3 });
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


describe('настройка брони по телефону', () => {
  const pair = (enabled: boolean, limit: string) => {
    // Switch шлёт пару значений: скрытое false и, если включено, true; значением считается последнее
    const fd = new FormData();
    fd.append('enabled', 'false');
    if (enabled) fd.append('enabled', 'true');
    fd.set('maxPerCall', limit);
    return fd;
  };

  it('включение и лимит уходят в API одним запросом, раздел обновляется', async () => {
    const r = await saveBookingAction(NONE, pair(true, '4'));
    expect(api.saveBooking).toHaveBeenCalledWith({ enabled: true, maxPerCall: 4 });
    expect(r.error).toBeNull();
    expect(cache.revalidatePath).toHaveBeenCalledWith('/marketing/voice');
  });

  it('выключено: enabled false', async () => {
    await saveBookingAction(NONE, pair(false, '3'));
    expect(api.saveBooking).toHaveBeenCalledWith({ enabled: false, maxPerCall: 3 });
  });

  it('лимит не число или вне 1..20: понятная ошибка, API не вызывается', async () => {
    for (const bad of ['', 'много', '0', '21', '2.5']) {
      const r = await saveBookingAction(NONE, pair(true, bad));
      expect(r.error).toMatch(/от 1 до 20/);
    }
    expect(api.saveBooking).not.toHaveBeenCalled();
  });

  it('слова сервера (причина, почему нельзя включить) показываются, текст исключений нет', async () => {
    api.saveBooking.mockRejectedValueOnce(new ApiError(409, 'Включить нельзя: Нет столов в зале'));
    expect((await saveBookingAction(NONE, pair(true, '3'))).error).toBe('Включить нельзя: Нет столов в зале');
    api.saveBooking.mockRejectedValueOnce(new Error('connect ECONNREFUSED http://internal:3001'));
    expect((await saveBookingAction(NONE, pair(true, '3'))).error).toBe('Не удалось сохранить. Попробуйте ещё раз.');
  });
});
