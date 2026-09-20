import { afterEach, expect, it, vi } from 'vitest';
import { ApiError, authApi } from '../../lib/api';
import { registrationAvailable } from './signed-in';

afterEach(() => vi.restoreAllMocks());

it.each([null, {}, { registrationEnabled: 'true' }, { registrationEnabled: false }])(
  'неполный или неразрешающий ответ API %j закрывает регистрацию',
  async (body) => {
    vi.spyOn(authApi, 'options').mockResolvedValue(
      body as Awaited<ReturnType<typeof authApi.options>>,
    );
    await expect(registrationAvailable()).resolves.toBe(false);
  },
);

it.each([new ApiError(503, 'API unavailable'), new SyntaxError('Invalid JSON')])(
  'сбой ответа API %s закрывает регистрацию',
  async (error) => {
    vi.spyOn(authApi, 'options').mockRejectedValue(error);
    await expect(registrationAvailable()).resolves.toBe(false);
  },
);

it('явное разрешение API открывает форму', async () => {
  vi.spyOn(authApi, 'options').mockResolvedValue({ registrationEnabled: true });
  await expect(registrationAvailable()).resolves.toBe(true);
});

it('служебные исключения Next не поглощаются как отказ API', async () => {
  const controlFlow = new Error('NEXT_REDIRECT');
  vi.spyOn(authApi, 'options').mockRejectedValue(controlFlow);
  await expect(registrationAvailable()).rejects.toBe(controlFlow);
});
