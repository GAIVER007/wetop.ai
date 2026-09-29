import { describe, expect, it } from 'vitest';
import { readBoundedText } from './bounded-body';

/**
 * Публичные маршруты стойки (мастер, окно входа на сайте) читали тело целиком и проверяли размер потом: запрос в сотни
 * мегабайт успевал лечь в память. Теперь потолок работает до чтения: по `content-length`, а без него — на лету.
 */
const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request('https://app.example.invalid/x', { method: 'POST', body, headers });

describe('чтение тела с потолком', () => {
  it('тело в пределах потолка читается', async () => {
    expect(await readBoundedText(post('{"a":1}'), 100)).toEqual({ ok: true, text: '{"a":1}' });
  });

  it('пустое тело — пустая строка', async () => {
    expect(await readBoundedText(post(null), 100)).toEqual({ ok: true, text: '' });
  });

  it('content-length больше потолка — отказ, тело не читается', async () => {
    let read = false;
    const request = post('x'.repeat(50), { 'content-length': '5000' });
    request.text = async () => {
      read = true;
      return '';
    };
    expect(await readBoundedText(request, 100)).toEqual({ ok: false });
    expect(read).toBe(false);
  });

  it('content-length не число — отказ', async () => {
    expect(await readBoundedText(post('x', { 'content-length': 'abc' }), 100)).toEqual({
      ok: false,
    });
  });

  it('заголовок соврал (тело больше заявленного) — отказ на лету, дальше потолка не читаем', async () => {
    const big = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(60)));
      },
    });
    const request = new Request('https://app.example.invalid/x', {
      method: 'POST',
      body: big,
      duplex: 'half',
    } as RequestInit);
    expect(await readBoundedText(request, 100)).toEqual({ ok: false });
  });

  it('потолок считается в байтах, а не в знаках', async () => {
    // 60 русских букв — 120 байт в UTF-8
    expect(await readBoundedText(post('ж'.repeat(60)), 100)).toEqual({ ok: false });
    expect(await readBoundedText(post('ж'.repeat(40)), 100)).toEqual({
      ok: true,
      text: 'ж'.repeat(40),
    });
  });
});
