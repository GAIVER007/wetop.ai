import { afterEach, expect, it, vi } from 'vitest';
import { ApiError, getJsonPublic } from './api';
afterEach(() => vi.unstubAllGlobals());

it('сохраняет HTTP-статус, чтобы отличить отсутствующую бронь от сбоя API', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));
  await expect(getJsonPublic('/reservations/MISSING')).rejects.toBeInstanceOf(ApiError);
  await expect(getJsonPublic('/reservations/MISSING')).rejects.toMatchObject({ status: 404 });
});
