import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_API_HOST, listenHost, listenPort } from './listen-address';

describe('адрес прослушивания API', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('без переменной слушает только 127.0.0.1 — как на машине владельца', () => {
    expect(listenHost({})).toBe(DEFAULT_API_HOST);
    expect(DEFAULT_API_HOST).toBe('127.0.0.1');
  });

  it('в контейнере адрес задаётся окружением', () => {
    expect(listenHost({ API_HOST: '0.0.0.0' })).toBe('0.0.0.0');
  });

  it('пустое значение и пробелы — это недосмотр, а не «слушать везде»', () => {
    expect(listenHost({ API_HOST: '' })).toBe(DEFAULT_API_HOST);
    expect(listenHost({ API_HOST: '   ' })).toBe(DEFAULT_API_HOST);
  });

  it('порт: умолчание 3001, мусор не пропускается', () => {
    expect(listenPort({})).toBe(3001);
    expect(listenPort({ API_PORT: '3100' })).toBe(3100);
    expect(listenPort({ API_PORT: 'нет' })).toBe(3001);
    expect(listenPort({ API_PORT: '0' })).toBe(3001);
    expect(listenPort({ API_PORT: '70000' })).toBe(3001);
  });
});
