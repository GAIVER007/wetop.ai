import { describe, expect, it } from 'vitest';
import { describeUserAgent } from './session';

/**
 * Список «где я вошёл» (DATA_MODEL §13.5, `user_agent` — «для списка»): строка агента браузера
 * человеку не читается, поэтому называем браузер и систему словами. Ошибиться здесь нестрашно —
 * это подпись, не право; неизвестное — так и называется.
 */
describe('describeUserAgent', () => {
  it('браузер и система словами', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome, macOS');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari, iPhone');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
      ),
    ).toBe('Firefox, Windows');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('Chrome, Android');
  });

  it('пустое и незнакомое — «неизвестное устройство», без сырой строки', () => {
    expect(describeUserAgent(null)).toBe('неизвестное устройство');
    expect(describeUserAgent('')).toBe('неизвестное устройство');
    expect(describeUserAgent('curl/8.4.0')).toBe('неизвестное устройство');
  });
});
