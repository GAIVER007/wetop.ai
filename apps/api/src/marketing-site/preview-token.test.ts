import { describe, expect, it } from 'vitest';
import {
  PREVIEW_TTL_SECONDS,
  previewSecretFromEnv,
  signPreviewToken,
  verifyPreviewToken,
} from './preview-token';

const SECRET = Buffer.from('mkt7-preview-secret-for-tests-only-32b!', 'utf8');
const SITE = '3f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
const VERSION = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const NOW = 1_780_000_000;

describe('MKT7: токен превью', () => {
  const token = signPreviewToken({ siteId: SITE, versionId: VERSION, exp: NOW + PREVIEW_TTL_SECONDS }, SECRET);

  it('действующий: ровно сайт, версия и срок, без организации и ПД', () => {
    expect(verifyPreviewToken(token, SECRET, NOW)).toEqual({ ok: true, siteId: SITE, versionId: VERSION, exp: NOW + 3600 });
    const payload = JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8'));
    expect(Object.keys(payload).sort()).toEqual(['exp', 'siteId', 'v', 'versionId']);
    expect(payload.v).toBe(1);
  });

  it('срок 60 минут; истёкший отдельно от испорченного', () => {
    expect(PREVIEW_TTL_SECONDS).toBe(3600);
    expect(verifyPreviewToken(token, SECRET, NOW + 3600)).toEqual({ ok: false, reason: 'expired' });
    expect(verifyPreviewToken(token, SECRET, NOW + 3599).ok).toBe(true);
  });

  it('изменённый байт подписи или данных, чужой секрет: invalid', () => {
    const [data, sig] = token.split('.') as [string, string];
    const flip = (s: string) => (s[0] === 'A' ? 'B' : 'A') + s.slice(1);
    expect(verifyPreviewToken(`${data}.${flip(sig)}`, SECRET, NOW)).toEqual({ ok: false, reason: 'invalid' });
    expect(verifyPreviewToken(`${flip(data)}.${sig}`, SECRET, NOW)).toEqual({ ok: false, reason: 'invalid' });
    const other = Buffer.from('another-secret-another-secret-0123456', 'utf8');
    expect(verifyPreviewToken(token, other, NOW)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('подписанный, но срок дальше 24 часов или не та форма: invalid', () => {
    const far = signPreviewToken({ siteId: SITE, versionId: VERSION, exp: NOW + 86_401 }, SECRET);
    expect(verifyPreviewToken(far, SECRET, NOW)).toEqual({ ok: false, reason: 'invalid' });
    for (const bad of ['', 'abc', 'a.b.c', `${'x'.repeat(600)}.y`, null, 42])
      expect(verifyPreviewToken(bad as unknown, SECRET, NOW)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('секрет: не короче 32 байт, иначе превью закрыто', () => {
    expect(previewSecretFromEnv({ SITE_PREVIEW_SECRET: 'short' } as NodeJS.ProcessEnv)).toBeNull();
    expect(previewSecretFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
    expect(previewSecretFromEnv({ SITE_PREVIEW_SECRET: 'x'.repeat(31) } as NodeJS.ProcessEnv)).toBeNull();
    expect(previewSecretFromEnv({ SITE_PREVIEW_SECRET: 'k'.repeat(32) } as NodeJS.ProcessEnv)?.length).toBe(32);
  });
});
