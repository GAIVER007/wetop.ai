import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Токен превью управляемого сайта (MKT7, `docs/marketing/site-publication-v0.md` §3). Без JWT-библиотеки:
 * `base64url(JSON {v:1, siteId, versionId, exp}) + "." + base64url(HMAC-SHA256)`. В токене нет организации, филиала,
 * людей и данных гостей; он открывает ровно одну версию одного сайта до `exp`. Секрет `SITE_PREVIEW_SECRET`, не короче
 * 32 байт: без него превью закрыто, а не открыто.
 */
export const PREVIEW_TTL_SECONDS = 60 * 60;
export const PREVIEW_MAX_FUTURE_SECONDS = 24 * 60 * 60;
const MAX_TOKEN_LENGTH = 512;
const PART_RE = /^[A-Za-z0-9_-]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface PreviewClaims {
  siteId: string;
  versionId: string;
  /** секунды Unix */
  exp: number;
}

export type PreviewCheck = ({ ok: true } & PreviewClaims) | { ok: false; reason: 'invalid' | 'expired' };

export function previewSecretFromEnv(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = env.SITE_PREVIEW_SECRET;
  if (typeof raw !== 'string') return null;
  const secret = Buffer.from(raw.trim(), 'utf8');
  return secret.length >= 32 ? secret : null;
}

function signature(data: string, secret: Buffer): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

export function signPreviewToken(claims: PreviewClaims, secret: Buffer): string {
  const data = Buffer.from(
    JSON.stringify({ v: 1, siteId: claims.siteId, versionId: claims.versionId, exp: claims.exp }),
    'utf8',
  ).toString('base64url');
  return `${data}.${signature(data, secret).toString('base64url')}`;
}

/** Подпись сверяется постоянным временем; испорченный и истёкший токен различаются только кодом, без подробностей */
export function verifyPreviewToken(token: unknown, secret: Buffer, nowSeconds: number): PreviewCheck {
  const invalid = { ok: false as const, reason: 'invalid' as const };
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return invalid;
  const parts = token.split('.');
  if (parts.length !== 2 || !PART_RE.test(parts[0]!) || !PART_RE.test(parts[1]!)) return invalid;
  const [data, sig] = parts as [string, string];
  const expected = signature(data, secret);
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return invalid;
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return invalid;
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return invalid;
  const p = payload as Record<string, unknown>;
  if (Object.keys(p).length !== 4 || p['v'] !== 1) return invalid;
  const { siteId, versionId, exp } = p;
  if (typeof siteId !== 'string' || !UUID_RE.test(siteId)) return invalid;
  if (typeof versionId !== 'string' || !UUID_RE.test(versionId)) return invalid;
  if (typeof exp !== 'number' || !Number.isInteger(exp)) return invalid;
  if (exp > nowSeconds + PREVIEW_MAX_FUTURE_SECONDS) return invalid;
  if (exp <= nowSeconds) return { ok: false, reason: 'expired' };
  return { ok: true, siteId, versionId, exp };
}
