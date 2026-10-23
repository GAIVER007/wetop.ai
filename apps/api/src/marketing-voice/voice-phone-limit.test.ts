import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PHONE_HASH_PURGE_MS, PHONE_LIMIT_WINDOW_MS, VoicePhoneLimit, hashPhone, type PhoneLimitStore } from './voice-phone-limit';

/** Суточный лимит голосовых броней на телефон (DATA_MODEL VOICE-PHONE-LIMIT-OWNER-APPROVAL-20261023). Номера вымышленные. */
const KEY = 'unit-test-hash-key-0123456789abcdef';
const AGENT = '3f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
const NOW = new Date('2026-11-10T10:00:00Z');

describe('хэш телефона', () => {
  it('один номер в разной записи даёт один хэш, другой номер другой, ключ меняет хэш', () => {
    const a = hashPhone('+7 (700) 111-22-33', KEY);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPhone('87001112233', KEY)).toBe(a);
    expect(hashPhone('+77001112234', KEY)).not.toBe(a);
    expect(hashPhone('+77001112233', 'other-key-other-key-other-key-0000')).not.toBe(a);
  });
  it('номера в хэше нет; без ключа и без номера хэша нет', () => {
    expect(hashPhone('+77001112233', KEY)).not.toContain('7001112233');
    expect(hashPhone('+77001112233', '')).toBeNull();
    expect(hashPhone('+77001112233', undefined)).toBeNull();
    expect(hashPhone('12', KEY)).toBeNull();
    expect(hashPhone('', KEY)).toBeNull();
  });
});

class FakeStore implements PhoneLimitStore {
  rows: Array<{ agentId: string; hash: string; at: Date }> = [];
  cleared: Date[] = [];
  async countConfirmedSince(agentId: string, hash: string, since: Date) {
    return this.rows.filter((r) => r.agentId === agentId && r.hash === hash && r.at > since).length;
  }
  async clearOlderThan(cutoff: Date) {
    this.cleared.push(cutoff);
    return 2;
  }
}

describe('лимит на телефон', () => {
  const hash = hashPhone('+77001112233', KEY)!;
  it('считает подтверждённые за скользящие 24 часа этого агента', async () => {
    const store = new FakeStore();
    const limit = new VoicePhoneLimit(store, KEY);
    const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
    store.rows = [
      { agentId: AGENT, hash, at: ago(1) },
      { agentId: AGENT, hash, at: ago(23) },
      { agentId: AGENT, hash, at: ago(25) },
      { agentId: 'other-agent', hash, at: ago(1) },
      { agentId: AGENT, hash: 'x'.repeat(64), at: ago(1) },
    ];
    expect(await limit.reached(AGENT, hash, 3, NOW)).toBe(false);
    expect(await limit.reached(AGENT, hash, 2, NOW)).toBe(true);
    expect(PHONE_LIMIT_WINDOW_MS).toBe(24 * 3_600_000);
  });
  it('хэш считается тем же ключом; без ключа лимит выключен', async () => {
    expect(new VoicePhoneLimit(new FakeStore(), KEY).hashOf('8 700 111 22 33')).toBe(hash);
    const off = new VoicePhoneLimit(new FakeStore(), '');
    expect(off.enabled).toBe(false);
    expect(off.hashOf('+77001112233')).toBeNull();
    expect(await off.reached(AGENT, hash, 1, NOW)).toBe(false);
  });
  it('обнуление хэшей старше 7 дней', async () => {
    const store = new FakeStore();
    expect(await new VoicePhoneLimit(store, KEY).purge(NOW)).toBe(2);
    expect(store.cleared[0]!.getTime()).toBe(NOW.getTime() - PHONE_HASH_PURGE_MS);
    expect(PHONE_HASH_PURGE_MS).toBe(7 * 24 * 3_600_000);
  });
});
