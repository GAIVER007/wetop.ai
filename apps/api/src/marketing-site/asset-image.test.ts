import { createHash } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { AssetImageError, processSiteImage } from './asset-image';

/**
 * MKT8, обработка картинки: тип по содержимому, бомба точек, поворот по EXIF, снятие EXIF и GPS, размеры выхода по виду,
 * SHA-256 от готовых байтов. Файлы собираются здесь же: настоящих фото гостиницы в тестах нет (ADR-010).
 */

/** JPEG 40×20: левая половина красная, правая синяя; EXIF с камерой, серийным номером, GPS и ориентацией 6 (повернуть на 90°) */
async function jpegWithGps(): Promise<Buffer> {
  const raw = Buffer.alloc(40 * 20 * 3);
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 40; x++) raw[(y * 40 + x) * 3 + (x < 20 ? 0 : 2)] = 255;
  return sharp(raw, { raw: { width: 40, height: 20, channels: 3 } })
    .jpeg()
    .withExif({
      IFD0: { Make: 'TestCam', Model: 'SN-12345', DateTime: '2026:10:07 10:00:00' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '43/1 15/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '76/1 57/1 0/1' },
    })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

const solid = (width: number, height: number, alpha = false) =>
  sharp({ create: { width, height, channels: alpha ? 4 : 3, background: alpha ? { r: 0, g: 128, b: 0, alpha: 0.5 } : { r: 0, g: 128, b: 0 } } });

/**
 * PNG, который обещает размер, а данных почти нет: заголовок, пустой IDAT и конец. Так выглядит бомба: десятки байтов,
 * гигантская картинка после распаковки
 */
function pngPromising(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])) >>> 0, 0);
    return Buffer.concat([len, Buffer.from(type), data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.alloc(10))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Анимированный WebP из двух кадров (VP8X с флагом анимации, ANIM, два ANMF): `sharp` сам такой не пишет */
async function animatedWebp(): Promise<Buffer> {
  const still = await solid(16, 16).webp({ lossless: true }).toBuffer();
  const frame = still.subarray(12);
  const u24 = (n: number) => Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255]);
  const chunk = (fourcc: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32LE(data.length, 0);
    return Buffer.concat([Buffer.from(fourcc), len, data, data.length % 2 ? Buffer.from([0]) : Buffer.alloc(0)]);
  };
  const anmf = () => chunk('ANMF', Buffer.concat([u24(0), u24(0), u24(15), u24(15), u24(100), Buffer.from([0]), frame]));
  const body = Buffer.concat([
    Buffer.from('WEBP'),
    chunk('VP8X', Buffer.concat([Buffer.from([0x02, 0, 0, 0]), u24(15), u24(15)])),
    chunk('ANIM', Buffer.alloc(6)),
    anmf(),
    anmf(),
  ]);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(body.length, 0);
  return Buffer.concat([Buffer.from('RIFF'), size, body]);
}

async function rejected(input: Uint8Array, kind: 'IMAGE' | 'LOGO' | 'FAVICON' = 'IMAGE'): Promise<string> {
  try {
    await processSiteImage(input, kind);
  } catch (error) {
    expect(error).toBeInstanceOf(AssetImageError);
    return (error as AssetImageError).code;
  }
  throw new Error('ожидался отказ');
}

describe('MKT8: обработка изображения сайта', () => {
  it('EXIF, камера и GPS есть во входе и отсутствуют в сохранённом; поворот применён к пикселям', async () => {
    const input = await jpegWithGps();
    const meta = await sharp(input).metadata();
    expect(meta.orientation).toBe(6);
    expect(meta.exif?.includes(Buffer.from('SN-12345'))).toBe(true);
    // тег GPS IFD (0x8825) в EXIF входа
    expect(meta.exif!.includes(Buffer.from([0x88, 0x25])) || meta.exif!.includes(Buffer.from([0x25, 0x88]))).toBe(true);

    const out = await processSiteImage(input, 'IMAGE');
    expect(out.mimeType).toBe('image/webp');
    expect([out.width, out.height]).toEqual([20, 40]);
    const saved = await sharp(out.bytes).metadata();
    expect(saved.format).toBe('webp');
    expect(saved.exif).toBeUndefined();
    expect(saved.orientation).toBeUndefined();
    expect(saved.xmp).toBeUndefined();
    expect(saved.icc).toBeUndefined();
    for (const marker of ['Exif', 'SN-12345', 'TestCam', 'GPS']) expect(out.bytes.includes(Buffer.from(marker))).toBe(false);
    const px = await sharp(out.bytes).raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => px.data[(y * px.info.width + x) * px.info.channels];
    // ориентация 6: красная левая половина стала верхней
    expect(at(10, 5)).toBeGreaterThan(200);
    expect(at(10, 35)).toBeLessThan(50);
  });

  it('SHA-256 от готовых байтов: тот же файл даёт тот же хэш; EXIF не меняет картинку, но и в хэш не попадает', async () => {
    const input = await jpegWithGps();
    const a = await processSiteImage(input, 'IMAGE');
    const b = await processSiteImage(input, 'IMAGE');
    expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(a.sha256).toBe(b.sha256);
    expect(a.sha256).toBe(createHash('sha256').update(a.bytes).digest('hex'));
    expect(a.byteSize).toBe(a.bytes.length);
    expect(a.sha256).not.toBe(createHash('sha256').update(input).digest('hex'));
  });

  it('картинка: длинная сторона до 2400 без увеличения; логотип до 1600 с прозрачностью', async () => {
    const big = await processSiteImage(await solid(3000, 1500).png().toBuffer(), 'IMAGE');
    expect([big.width, big.height]).toEqual([2400, 1200]);
    const small = await processSiteImage(await solid(300, 200).jpeg().toBuffer(), 'IMAGE');
    expect([small.width, small.height]).toEqual([300, 200]);
    const logo = await processSiteImage(await solid(2000, 500, true).png().toBuffer(), 'LOGO');
    expect([logo.width, logo.height]).toEqual([1600, 400]);
    expect(logo.mimeType).toBe('image/webp');
    expect((await sharp(logo.bytes).metadata()).hasAlpha).toBe(true);
  });

  it('фавиконка: PNG 512×512, пропорции сохранены, поля прозрачные, без растяжения и увеличения', async () => {
    const wide = await processSiteImage(await solid(1024, 256).png().toBuffer(), 'FAVICON');
    expect(wide.mimeType).toBe('image/png');
    expect([wide.width, wide.height]).toEqual([512, 512]);
    const px = await sharp(wide.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = (x: number, y: number) => px.data[(y * 512 + x) * 4 + 3];
    expect(alpha(256, 256)).toBe(255);
    expect(alpha(256, 10)).toBe(0);
    expect(alpha(256, 500)).toBe(0);
    // маленький значок не растягивается: 64×64 в центре холста
    const tiny = await processSiteImage(await solid(64, 64).png().toBuffer(), 'FAVICON');
    const t = await sharp(tiny.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const ta = (x: number, y: number) => t.data[(y * 512 + x) * 4 + 3];
    expect(ta(256, 256)).toBe(255);
    expect(ta(200, 256)).toBe(0);
  });

  it('WebP и PNG на входе принимаются', async () => {
    expect((await processSiteImage(await solid(50, 50).webp().toBuffer(), 'IMAGE')).width).toBe(50);
    expect((await processSiteImage(await solid(50, 50).png().toBuffer(), 'IMAGE')).width).toBe(50);
  });

  it('вредные и чужие файлы: SVG под видом PNG, HTML под видом JPG, GIF, обрезанный JPEG, случайные байты, пусто', async () => {
    expect(await rejected(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'))).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(await rejected(Buffer.from('<!doctype html><script>alert(1)</script>'))).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(await rejected(await solid(10, 10).gif().toBuffer())).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(await rejected(await solid(10, 10).tiff().toBuffer())).toBe('UNSUPPORTED_MEDIA_TYPE');
    const jpeg = await solid(400, 400).jpeg().toBuffer();
    expect(await rejected(jpeg.subarray(0, Math.floor(jpeg.length / 2)))).toBe('IMAGE_DECODE_FAILED');
    expect(await rejected(Buffer.from([0xff, 0xd8, 0xff, 0x13, 0x37, 0xde, 0xad, 0xbe, 0xef]))).toBe('IMAGE_DECODE_FAILED');
    expect(await rejected(Buffer.from([0x13, 0x37, 0xde, 0xad, 0xbe, 0xef, 1, 2, 3]))).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(await rejected(Buffer.alloc(0))).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('анимированный WebP отклоняется', async () => {
    const animated = await animatedWebp();
    expect((await sharp(animated).metadata()).pages).toBe(2);
    expect(await rejected(animated)).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('10 МиБ + 1 байт: отказ до декодирования', async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1);
    big.set([0xff, 0xd8, 0xff], 0);
    expect(await rejected(big)).toBe('FILE_TOO_LARGE');
  });

  it('бомба: заголовок обещает больше 40 млн точек или сторону больше 12 000', async () => {
    expect(await rejected(pngPromising(7000, 7000))).toBe('IMAGE_TOO_LARGE');
    expect(await rejected(pngPromising(12_001, 10))).toBe('IMAGE_TOO_LARGE');
    expect(pngPromising(7000, 7000).length).toBeLessThan(100);
    // заголовок в пределах, но данных нет: не декодируется
    expect(await rejected(pngPromising(100, 100))).toBe('IMAGE_DECODE_FAILED');
  });
});
