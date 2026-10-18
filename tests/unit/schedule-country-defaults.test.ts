import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

// Exercise the actual private initializer and actual country resolver without loading React/Next.
const regions = readFileSync('packages/domain/src/regions.ts', 'utf8');
const checklist = readFileSync('apps/web/src/app/register/setup/beauty-checklist.tsx', 'utf8');
const initializer = checklist.slice(checklist.lastIndexOf('function withCountry('));
const withCountry = runInNewContext(stripTypeScriptTypes(
  `${regions.replace(/^export /gm, '')}\n${initializer}\nwithCountry;`,
)) as (draft: Record<string, unknown>, code?: string | null) => Record<string, unknown>;
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

describe('schedule onboarding country defaults preserve existing drafts', () => {
  it('preserves a valid saved timezone outside the partner list and currency', () => {
    const draft = { timezone: 'America/New_York', currency: 'USD' };
    assert.deepEqual(plain(withCountry(draft, 'KZ')), draft);
  });
  it('defaults an empty draft from the organization country', () => {
    assert.deepEqual(plain(withCountry({}, 'KZ')), { timezone: 'Asia/Almaty', currency: 'KZT' });
  });
  it('preserves saved currency while filling a missing timezone', () => {
    assert.deepEqual(plain(withCountry({ timezone: '', currency: 'USD' }, 'KZ')),
      { timezone: 'Asia/Almaty', currency: 'USD' });
  });
  it('does not infer missing currency from an organization with an existing timezone', () => {
    const draft = { timezone: 'America/New_York', currency: '' };
    assert.deepEqual(plain(withCountry(draft, 'KZ')), draft);
  });
  it('leaves an unknown country unchanged', () => {
    const draft = { timezone: '', currency: '' };
    assert.deepEqual(plain(withCountry(draft, 'ZZ')), draft);
  });
  it('does not silently repair an invalid existing timezone', () => {
    const draft = { timezone: 'Invalid/Zone', currency: 'USD' };
    assert.deepEqual(plain(withCountry(draft, 'KZ')), draft);
  });
  it('does not silently replace malformed timezone input', () => {
    const draft = { timezone: 123, currency: 'USD' };
    assert.deepEqual(plain(withCountry(draft, 'KZ')), draft);
  });
});
