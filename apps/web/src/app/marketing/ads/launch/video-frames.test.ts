import { describe, expect, it } from 'vitest';
import { FRAME_MAX_SIDE, frameSize, framePoints } from './video-frames';

describe('кадры видео для ИИ', () => {
  it('размер кадра: длинная сторона не больше 768, пропорции сохраняются, маленькое не растягивается', () => {
    expect(frameSize(1920, 1080)).toEqual({ width: FRAME_MAX_SIDE, height: 432 });
    expect(frameSize(1080, 1920)).toEqual({ width: 432, height: FRAME_MAX_SIDE });
    expect(frameSize(400, 300)).toEqual({ width: 400, height: 300 });
    expect(frameSize(0, 300)).toEqual({ width: 0, height: 0 });
    expect(frameSize(Number.NaN, 300)).toEqual({ width: 0, height: 0 });
  });

  it('моменты съёмки: 10, 50 и 90 % длины; неизвестная или нулевая длина даёт пустой список', () => {
    expect(framePoints(10)).toEqual([1, 5, 9]);
    expect(framePoints(Number.POSITIVE_INFINITY)).toEqual([]);
    expect(framePoints(Number.NaN)).toEqual([]);
    expect(framePoints(0)).toEqual([]);
  });

  it('очень короткое видео: последний кадр не за концом файла', () => {
    const points = framePoints(0.2);
    expect(points).toHaveLength(3);
    expect(Math.max(...points)).toBeLessThan(0.2);
  });
});
