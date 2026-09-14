import { afterEach, expect, it, vi } from 'vitest';
import { ApiError, getJsonPublic, reservationsApi } from './api';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('сохраняет HTTP-статус, чтобы отличить отсутствующую бронь от сбоя API', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));
  await expect(getJsonPublic('/reservations/MISSING')).rejects.toBeInstanceOf(ApiError);
  await expect(getJsonPublic('/reservations/MISSING')).rejects.toMatchObject({ status: 404 });
});

it('обычный запуск не принимает демонстрационные данные', async () => {
  vi.stubEnv('APP_ALLOW_TEST_DATA', '');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response('{"count":48}', {
        headers: { 'x-wetop-data-source': 'synthetic' },
      }),
    ),
  );
  await expect(getJsonPublic('/hotel/channel-report')).rejects.toMatchObject({ status: 503 });
});

it('production не разрешает тестовый сервер даже с флагом', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APP_ALLOW_TEST_DATA', '1');
  vi.stubEnv('APP_API_URL', 'http://127.0.0.1:4311');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await expect(reservationsApi.create({})).rejects.toMatchObject({ status: 503 });
  expect(fetch).not.toHaveBeenCalled();
});

it('test opt-in добавляет явный заголовок, пустые реальные ответы остаются пустыми', async () => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('APP_ALLOW_TEST_DATA', '1');
  const fetch = vi.fn().mockResolvedValue(new Response('[]'));
  vi.stubGlobal('fetch', fetch);
  await expect(getJsonPublic('/guests')).resolves.toEqual([]);
  expect(fetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      headers: expect.objectContaining({ 'x-wetop-test-client': '1' }),
      signal: expect.any(AbortSignal),
    }),
  );
});

it('ответ 5xx на команду предупреждает, что операция могла записаться, и просит проверить перед повтором (Б6)', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response('{"statusCode":500,"message":"Internal server error"}', { status: 500 }),
      ),
  );
  const error = await reservationsApi.create({}).catch((e: unknown) => e);
  expect(error).toMatchObject({ status: 500 });
  expect((error as Error).message).toContain('Проверьте результат');
  expect((error as Error).message).not.toContain('Internal server error');
});

it('сетевой отказ не превращается в нулевые показатели и не повторяет команду', async () => {
  const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
  vi.stubGlobal('fetch', fetch);
  await expect(reservationsApi.create({})).rejects.toMatchObject({ status: 503 });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('чтение ждёт API столько же, сколько команда: 60 с (уточнение ADR-031)', async () => {
  // 13.09.2026: при нехватке памяти чтение шло дольше 15 с — бронь создавалась, а карточка после неё
  // падала в «Нет связи с API», и форма оставалась на экране с кнопкой «Создать бронь» (риск дубля)
  const timeout = vi.spyOn(AbortSignal, 'timeout');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => new Response('{}')),
  );
  await getJsonPublic('/chessboard');
  await reservationsApi.cancel('N1');
  expect(timeout.mock.calls.map((c) => c[0])).toEqual([60_000, 60_000]);
  timeout.mockRestore();
});

it('не перехватывает служебные сигналы рендера как сетевой сбой', async () => {
  const renderSignal = new Error('render control flow');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(renderSignal));
  await expect(getJsonPublic('/inventory/summary')).rejects.toBe(renderSignal);
});

it('деморежим разрешён только явно и только на локальном dev-источнике', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('APP_DEMO_MODE', '1');
  vi.stubEnv('APP_API_URL', 'http://127.0.0.1:4312');
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response('[]', { headers: { 'x-wetop-data-source': 'demo' } }));
  vi.stubGlobal('fetch', fetch);
  await expect(getJsonPublic('/guests')).resolves.toEqual([]);
  expect(fetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ headers: expect.objectContaining({ 'x-wetop-demo-client': '1' }) }),
  );
});
it('production не принимает demo даже с флагом и не отправляет команды', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APP_DEMO_MODE', '1');
  vi.stubEnv('APP_API_URL', 'http://127.0.0.1:4312');
  const fetch = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  await expect(reservationsApi.create({})).rejects.toMatchObject({ status: 503 });
  expect(fetch).not.toHaveBeenCalled();
});
it('обычный режим отвергает demo-заголовок с любого адреса', async () => {
  vi.stubEnv('APP_DEMO_MODE', '');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('{}', { headers: { 'x-wetop-data-source': 'demo' } })),
  );
  await expect(getJsonPublic('/inventory/summary')).rejects.toMatchObject({ status: 503 });
});
