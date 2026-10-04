import { afterEach, expect, it, vi } from 'vitest';
import { GET, POST } from '../app/api/site-auth/[action]/route';
import { authApi } from './api';
import { ApiError } from './api-error';

vi.mock('./session', () => ({ sessionToken: async () => 'synthetic-session' }));
afterEach(() => vi.restoreAllMocks());
const context = (action: string) => ({ params: Promise.resolve({ action }) });
const request = (action: string, body?: unknown) =>
  new Request(`https://app.wetop.ai/api/site-auth/${action}`, {
    method: body ? 'POST' : 'GET',
    headers: { origin: 'https://wetop.ai', 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
it('успешный вход возвращает разрешённый next, а сессию — только cookie', async () => {
  vi.spyOn(authApi, 'registrationContext').mockResolvedValue({
    businessId: 'synthetic-business',
    locationId: 'synthetic-location',
    vertical: 'HOSPITALITY',
    businessName: 'Отель',
    locationName: 'Филиал',
  });
  vi.spyOn(authApi, 'login').mockResolvedValue({
    token: 'synthetic-session',
    expiresAt: '2030-01-01T00:00:00Z',
  } as never);
  const response = await POST(
    request('login', {
      email: 'user@example.invalid',
      password: 'synthetic-pass',
      next: '/journal?page=2',
    }),
    context('login'),
  );
  expect(await response.json()).toEqual({ next: '/journal?page=2' });
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
});
it('браузер может подтвердить сохранение сессии без получения ключа', async () => {
  vi.spyOn(authApi, 'me').mockResolvedValue({ user: { id: 'synthetic-user' } } as never);
  const response = await GET(request('session'), context('session'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ authenticated: true });
});
it('отозванная сессия не подтверждает вход', async () => {
  vi.spyOn(authApi, 'me').mockRejectedValue(new ApiError(401, 'Сессия истекла'));
  const response = await GET(request('session'), context('session'));
  expect(await response.json()).toEqual({ authenticated: false });
});
it('сбой API не выдаётся за отсутствующую сессию', async () => {
  vi.spyOn(authApi, 'me').mockRejectedValue(new ApiError(503, 'Нет связи с сервером'));
  const response = await GET(request('session'), context('session'));
  expect(response.status).toBe(503);
});

it('pilot login preserves cookie security and avoids Hospitality no-scope destination', async () => {
  vi.spyOn(authApi, 'login').mockResolvedValue({
    token: 'synthetic-pilot',
    expiresAt: '2030-01-01T00:00:00Z',
  } as never);
  vi.spyOn(authApi, 'registrationContext').mockResolvedValue({
    businessId: 'b',
    locationId: 'l',
    vertical: 'FOOD_SERVICE',
    businessName: 'Пилот',
    locationName: 'Филиал',
  });
  const response = await POST(
    new Request('https://app.wetop.ai/api/site-auth/login', {
      method: 'POST',
      headers: { origin: 'https://wetop.ai', 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'pilot@example.invalid',
        password: 'synthetic',
        next: '/today',
      }),
    }),
    context('login'),
  );
  expect(await response.json()).toEqual({ next: '/register/complete' });
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
});

it('tampered registration vertical is rejected before forwarding', async () => {
  const register = vi.spyOn(authApi, 'register');
  const response = await POST(
    new Request('https://app.wetop.ai/api/site-auth/register', {
      method: 'POST',
      headers: { origin: 'https://wetop.ai', 'content-type': 'application/json' },
      body: JSON.stringify({ vertical: 'UNKNOWN', businessName: 'Тест' }),
    }),
    context('register'),
  );
  expect(response.status).toBe(400);
  expect(register).not.toHaveBeenCalled();
});
