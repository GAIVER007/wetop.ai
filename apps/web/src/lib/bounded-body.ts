export type BoundedText = { ok: true; text: string } | { ok: false };

/**
 * Прочитать тело запроса не больше `maxBytes` байт. Потолок работает до чтения: заявленный `content-length` больше
 * потолка — отказ без чтения; заголовка нет или он соврал — читаем потоком и обрываем, как только набежало сверх
 * потолка. Потолок в байтах, а не в знаках: русская буква в UTF-8 — два байта.
 */
export async function readBoundedText(request: Request, maxBytes: number): Promise<BoundedText> {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isInteger(length) || length < 0 || length > maxBytes) return { ok: false };
  }
  if (!request.body) return { ok: true, text: '' };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}
