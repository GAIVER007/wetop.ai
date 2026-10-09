import { createHash } from 'node:crypto';
import sharp, { type Metadata, type OutputInfo } from 'sharp';
import { SITE_ASSET_LIMITS, sniffImageType, type SiteAssetKind } from '@pms/domain';

/**
 * Обработка изображения сайта (MKT8, план §6, `docs/marketing/site-assets-v0.md`). Сырой файл живёт только в памяти
 * этого вызова: в хранилище, базу и временные файлы он не попадает. Сохраняется только готовая копия:
 *
 * 1. тип по сигнатуре, и декодер обязан увидеть тот же формат (SVG, GIF, AVIF, HEIC и прочее не узнаются вовсе);
 * 2. анимация и многостраничность отклоняются; сторона до 12 000, точек до 40 млн (до декодирования, по заголовку, и
 *    ещё раз пределом `limitInputPixels` самого декодера);
 * 3. ориентация EXIF переносится в пиксели, метаданные не переносятся: ни EXIF с GPS и серийным номером камеры, ни XMP,
 *    ни ICC;
 * 4. картинка и логотип → WebP 82 (длинная сторона до 2400 и 1600, без увеличения), фавиконка → PNG 512×512 (вписать
 *    без растяжения и увеличения, поля прозрачные);
 * 5. SHA-256 от готовых байтов: одинаковая картинка с разным EXIF это один ассет.
 */
export type AssetImageErrorCode = 'UNSUPPORTED_MEDIA_TYPE' | 'FILE_TOO_LARGE' | 'IMAGE_TOO_LARGE' | 'IMAGE_DECODE_FAILED';

const MESSAGES: Record<AssetImageErrorCode, string> = {
  UNSUPPORTED_MEDIA_TYPE: 'Подходят только JPEG, PNG и WebP без анимации',
  FILE_TOO_LARGE: 'Файл больше 10 МиБ',
  IMAGE_TOO_LARGE: 'Слишком большое изображение: не больше 12 000 точек по стороне и 40 млн точек всего',
  IMAGE_DECODE_FAILED: 'Файл повреждён или не читается как изображение',
};

export class AssetImageError extends Error {
  constructor(readonly code: AssetImageErrorCode) {
    super(MESSAGES[code]);
  }
}

export interface ProcessedImage {
  bytes: Buffer;
  mimeType: 'image/webp' | 'image/png';
  width: number;
  height: number;
  byteSize: number;
  sha256: string;
}

const L = SITE_ASSET_LIMITS;
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

export async function processSiteImage(input: Uint8Array, kind: SiteAssetKind): Promise<ProcessedImage> {
  if (input.length > L.maxUploadBytes) throw new AssetImageError('FILE_TOO_LARGE');
  const sniffed = sniffImageType(input);
  if (!sniffed) throw new AssetImageError('UNSUPPORTED_MEDIA_TYPE');
  const source = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  let meta: Metadata;
  try {
    // заголовок без декодирования пикселей: размер и число кадров известны до того, как память понадобится
    meta = await sharp(source, { limitInputPixels: false }).metadata();
  } catch {
    throw new AssetImageError('IMAGE_DECODE_FAILED');
  }
  if (meta.format !== sniffed) throw new AssetImageError('UNSUPPORTED_MEDIA_TYPE');
  if ((meta.pages ?? 1) > 1) throw new AssetImageError('UNSUPPORTED_MEDIA_TYPE');
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w > L.maxInputSide || h > L.maxInputSide || w * h > L.maxInputPixels) throw new AssetImageError('IMAGE_TOO_LARGE');
  if (w < 1 || h < 1) throw new AssetImageError('IMAGE_DECODE_FAILED');

  let out: { data: Buffer; info: OutputInfo };
  try {
    // failOn 'warning' (по умолчанию): обрезанный JPEG это отказ, а не полкартинки серым
    const decode = () => sharp(source, { limitInputPixels: L.maxInputPixels, failOn: 'warning' }).rotate();
    if (kind === 'FAVICON') {
      const fitted = await decode()
        .resize({ width: L.faviconSide, height: L.faviconSide, fit: 'inside', withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const { width, height, channels } = fitted.info;
      const left = Math.floor((L.faviconSide - width) / 2);
      const top = Math.floor((L.faviconSide - height) / 2);
      out = await sharp(fitted.data, { raw: { width, height, channels } })
        .extend({
          left,
          right: L.faviconSide - width - left,
          top,
          bottom: L.faviconSide - height - top,
          background: TRANSPARENT,
        })
        .png({ compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true });
    } else {
      const side = kind === 'LOGO' ? L.logoMaxSide : L.imageMaxSide;
      out = await decode()
        .resize({ width: side, height: side, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: L.webpQuality })
        .toBuffer({ resolveWithObject: true });
    }
  } catch {
    throw new AssetImageError('IMAGE_DECODE_FAILED');
  }
  if (out.data.length > L.maxUploadBytes) throw new AssetImageError('IMAGE_TOO_LARGE');
  return {
    bytes: out.data,
    mimeType: kind === 'FAVICON' ? 'image/png' : 'image/webp',
    width: out.info.width,
    height: out.info.height,
    byteSize: out.data.length,
    sha256: createHash('sha256').update(out.data).digest('hex'),
  };
}
