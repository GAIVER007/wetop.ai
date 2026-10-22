/**
 * Кадры видео для «Подготовить с ИИ» (техпроект §6): самому видео модель не уходит, ИИ получает 2–4 кадра JPEG,
 * снятые здесь, в браузере. Кадры берутся на 10, 50 и 90 % длины, ужимаются до 768 px по длинной стороне.
 * Если браузер видео не раскодировал (кодек, битый файл) или кадры не успели за 10 секунд, возвращается пустой список:
 * запуск от этого не зависит, текст объявления тогда пишется руками.
 */
export const FRAME_POINTS = [0.1, 0.5, 0.9] as const;
export const FRAME_MAX_SIDE = 768;
export const FRAME_TIMEOUT_MS = 10_000;
const JPEG_QUALITY = 0.8;

/** Размер кадра с сохранением пропорций: длинная сторона не больше `max`, меньше не растягивается */
export function frameSize(width: number, height: number, max = FRAME_MAX_SIDE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Моменты съёмки в секундах для видео длиной `duration`; неизвестная длина даёт пустой список */
export function framePoints(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  return FRAME_POINTS.map((p) => Math.min(duration * p, Math.max(duration - 0.05, 0)));
}

function seek(video: HTMLVideoElement, at: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', fail);
      reject(new Error('Видео не перемотано'));
    };
    video.addEventListener('seeked', done);
    video.addEventListener('error', fail);
    video.currentTime = at;
  });
}

async function capture(file: File): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;
  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadeddata', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error('Видео не раскодировано')), { once: true });
      video.src = url;
    });
    const size = frameSize(video.videoWidth, video.videoHeight);
    const points = framePoints(video.duration);
    if (!size.width || points.length === 0) return [];
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    const frames: string[] = [];
    for (const at of points) {
      await seek(video, at);
      ctx.drawImage(video, 0, 0, size.width, size.height);
      frames.push(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}

export async function captureVideoFrames(file: File): Promise<string[]> {
  try {
    return await Promise.race([
      capture(file),
      new Promise<string[]>((resolve) => setTimeout(() => resolve([]), FRAME_TIMEOUT_MS)),
    ]);
  } catch {
    return [];
  }
}
