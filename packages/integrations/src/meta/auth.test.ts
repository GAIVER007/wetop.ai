import { describe, expect, it } from 'vitest';
import { MetaAdsClient, MetaApiError } from './client';
import { exchangeMetaCode, metaLoginUrl } from './auth';

/** Вход клиента и чтение кабинета по docs/meta/README.md, «Вход клиента и чтение кабинета». Данные вымышленные. */
const APP = { appId: '1000000000001', appSecret: 'app-secret-not-real', configId: '2000000000002', redirectUri: 'https://app.example.test/marketing/ads/meta/callback' };

function fakeFetch(body: unknown, status = 200) {
  const urls: URL[] = [];
  const fn = (async (input: string | URL) => {
    urls.push(new URL(String(input)));
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fn, urls };
}

describe('окно входа Facebook Login for Business', () => {
  it('код авторизации для SUAT, конфигурация вместо scope, state и адрес возврата как есть', () => {
    const url = new URL(metaLoginUrl({ ...APP, state: 'st.ate' }));
    expect(url.origin + url.pathname).toBe('https://www.facebook.com/v25.0/dialog/oauth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: APP.appId,
      redirect_uri: APP.redirectUri,
      state: 'st.ate',
      config_id: APP.configId,
      response_type: 'code',
      override_default_response_type: 'true',
    });
    expect(url.toString()).not.toContain(APP.appSecret);
  });
});

describe('обмен кода на ключ', () => {
  it('сервером: тот же адрес возврата, секрет только в запросе к Graph API; ответ: ключ', async () => {
    const { fn, urls } = fakeFetch({ access_token: 'suat-not-real', token_type: 'bearer' });
    expect(await exchangeMetaCode({ ...APP, code: 'c0de', fetch: fn })).toBe('suat-not-real');
    expect(urls[0]!.origin + urls[0]!.pathname).toBe('https://graph.facebook.com/v25.0/oauth/access_token');
    expect(Object.fromEntries(urls[0]!.searchParams)).toEqual({
      client_id: APP.appId,
      redirect_uri: APP.redirectUri,
      client_secret: APP.appSecret,
      code: 'c0de',
    });
  });

  it('отказ Meta: ошибка без секрета и кода в тексте', async () => {
    const { fn } = fakeFetch({ error: { message: `bad code c0de ${APP.appSecret}`, code: 100 } }, 400);
    const err = await exchangeMetaCode({ ...APP, code: 'c0de', fetch: fn }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MetaApiError);
    expect((err as Error).message).not.toContain(APP.appSecret);
    expect((err as Error).message).not.toContain('c0de');
  });
});

describe('кабинет по номеру', () => {
  it('название, валюта, пояс и статус; номер без приставки act_', async () => {
    const { fn, urls } = fakeFetch({
      id: 'act_1234567890',
      account_id: '1234567890',
      name: 'Отель на Абая',
      currency: 'USD',
      timezone_name: 'Asia/Almaty',
      account_status: 1,
    });
    const account = await new MetaAdsClient({ accessToken: 'suat-not-real', fetch: fn }).adAccount('act_1234567890');
    expect(urls[0]!.pathname).toBe('/v25.0/act_1234567890');
    expect(urls[0]!.searchParams.get('fields')).toBe('account_id,name,currency,timezone_name,account_status');
    expect(account).toEqual({ accountId: '1234567890', name: 'Отель на Абая', currency: 'USD', timezone: 'Asia/Almaty', active: true });
  });

  it('закрытый или неактивный кабинет помечается', async () => {
    const { fn } = fakeFetch({ account_id: '1', name: 'x', currency: 'KZT', timezone_name: 'Asia/Almaty', account_status: 101 });
    expect((await new MetaAdsClient({ accessToken: 't', fetch: fn }).adAccount('1')).active).toBe(false);
  });
});
