import { describe, expect, it } from 'vitest';
import { enableLocalAppLogin } from '../tools/local-app-login';

describe('вход wetop_app на стенде включается только на локальной базе', () => {
  it.each([
    'postgresql://postgres.ref:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
    'postgresql://pms@10.0.0.5:5432/pms',
    'не адрес',
  ])('чужой сервер не трогается и даже не подключается: %s', async (url) => {
    // подключение к такому адресу упало бы или повисло — ответ приходит сразу, без сети
    await expect(enableLocalAppLogin(url)).resolves.toBe('not-local');
  });
});
