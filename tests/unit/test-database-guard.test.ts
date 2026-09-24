import { describe, expect, it } from 'vitest';
import { testDatabaseRefusal } from '../tools/test-schema-plan';

/**
 * Q-170 (решение владельца 24.09.2026): интеграционные и сквозные тесты ходят только в локальную базу. На Mac в .env
 * лежит адрес рабочей базы Supabase, и прогон без явного DATABASE_URL писал схему pms_test туда и занимал пулер
 * (22.09.2026, TESTING.md «Грабли»). Нелокальная база — только осознанно, PMS_TEST_REMOTE_DB=1.
 */
describe('testDatabaseRefusal', () => {
  it('локальная база — можно', () => {
    for (const url of [
      'postgresql://postgres@127.0.0.1:55432/pmslocal',
      'postgresql://pms:pms@localhost:5432/pms',
      'postgresql://postgres@[::1]:5432/pms',
      'postgresql:///pms?host=/var/run/postgresql',
    ])
      expect(testDatabaseRefusal(url, {}), url).toBeNull();
  });

  it('нелокальная — отказ со словами, что делать; адрес в тексте не печатается', () => {
    const url = 'postgresql://owner:not-a-real-pass@aws-0-ap-southeast-1.pooler.example.com:5432/postgres';
    const refusal = testDatabaseRefusal(url, {});
    expect(refusal).toMatch(/db:local/);
    expect(refusal).toMatch(/PMS_TEST_REMOTE_DB=1/);
    expect(refusal).not.toContain('pooler.example.com');
    expect(refusal).not.toContain('not-a-real-pass');
  });

  it('осознанно — PMS_TEST_REMOTE_DB=1', () => {
    expect(
      testDatabaseRefusal('postgresql://u:p@db.example.com:5432/x', { PMS_TEST_REMOTE_DB: '1' }),
    ).toBeNull();
  });
});
