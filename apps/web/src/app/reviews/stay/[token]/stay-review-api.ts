import 'server-only';
import { ApiError } from '../../../../lib/api-error';
import { clientInfo } from '../../../../lib/session';
import { msg } from '../../../../i18n';

/** Публичная форма отзыва гостя гостиницы (HOTEL-REVIEWS-20261031): без входа, адрес гостя для предела запросов */
export type StayReviewPreview = { status: 'SUBMITTED' } | { status: 'OPEN'; propertyName: string; expiresAt: string };

const endpoint = () => (process.env.APP_API_URL?.trim() || 'http://127.0.0.1:3001').replace(/\/$/, '');
const headers = async (): Promise<Record<string, string>> => {
  const info = await clientInfo();
  return info.ip ? { 'cf-connecting-ip': info.ip } : {};
};
const messageOf = async (r: Response) => {
  const body = (await r.json().catch(() => null)) as { message?: unknown } | null;
  return typeof body?.message === 'string' ? body.message : msg('Не удалось открыть форму отзыва.');
};

export const stayReviewApi = {
  preview: async (token: string): Promise<StayReviewPreview | null> => {
    const r = await fetch(`${endpoint()}/hotel/reviews/${encodeURIComponent(token)}`, {
      cache: 'no-store',
      headers: await headers(),
      signal: AbortSignal.timeout(60_000),
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new ApiError(r.status, await messageOf(r));
    return r.json() as Promise<StayReviewPreview>;
  },
  submit: async (token: string, body: { stars: number; comment?: string }) => {
    const r = await fetch(`${endpoint()}/hotel/reviews/${encodeURIComponent(token)}`, {
      method: 'POST',
      cache: 'no-store',
      headers: { ...(await headers()), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) throw new ApiError(r.status, await messageOf(r));
    return r.json() as Promise<{ status: 'SUBMITTED' }>;
  },
};
