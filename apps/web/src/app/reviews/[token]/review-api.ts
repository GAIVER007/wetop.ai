import 'server-only';
import { ApiError } from '../../../lib/api-error';
import { clientInfo } from '../../../lib/session';
import type { BeautyReviewDraft, BeautyReviewPreview } from './review-types';

const endpoint = () =>
  (process.env.APP_API_URL?.trim() || 'http://127.0.0.1:3001').replace(/\/$/, '');

async function messageOf(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
  return typeof body?.message === 'string' ? body.message : 'Не удалось открыть форму отзыва.';
}

async function visitorHeaders(): Promise<Record<string, string>> {
  const info = await clientInfo();
  return info.ip ? { 'cf-connecting-ip': info.ip } : {};
}

export const reviewApi = {
  preview: async (token: string): Promise<BeautyReviewPreview | null> => {
    const response = await fetch(`${endpoint()}/beauty/reviews/${encodeURIComponent(token)}`, {
      cache: 'no-store',
      headers: await visitorHeaders(),
      signal: AbortSignal.timeout(60_000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new ApiError(response.status, await messageOf(response));
    return response.json() as Promise<BeautyReviewPreview>;
  },
  submit: async (
    token: string,
    body: { reviews: BeautyReviewDraft[] },
  ): Promise<{ status: 'SUBMITTED'; submittedCount: number }> => {
    const response = await fetch(`${endpoint()}/beauty/reviews/${encodeURIComponent(token)}`, {
      method: 'POST',
      cache: 'no-store',
      headers: { ...(await visitorHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new ApiError(response.status, await messageOf(response));
    return response.json() as Promise<{ status: 'SUBMITTED'; submittedCount: number }>;
  },
};
