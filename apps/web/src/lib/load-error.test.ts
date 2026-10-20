import { describe, expect, it } from 'vitest';
import { ApiError } from './api-error';
import { loadErrorProps } from './load-error';

/**
 * Пропсы `LoadError` уходят в клиентский компонент, то есть в RSC-данные страницы: сырой текст ошибки туда
 * не попадает (аудит платформы 17.10.2026, Д11). Экран ошибки показывает совет по коду статуса, а не текст.
 */
describe('loadErrorProps', () => {
  it('отдаёт только код статуса', () => {
    expect(loadErrorProps(new ApiError(404, 'Not found'))).toEqual({ status: 404 });
  });
  it('внутренний адрес и текст сбоя в клиент не уходят', () => {
    const props = loadErrorProps(new Error('connect ECONNREFUSED 10.0.0.5:4311'));
    expect(props).toEqual({ status: undefined });
    expect(JSON.stringify(props)).not.toContain('ECONNREFUSED');
  });
});
