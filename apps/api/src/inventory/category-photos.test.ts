import { describe, expect, it } from 'vitest';
import { MAX_CATEGORY_PHOTOS, photoIdsInput } from './category-photos';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('photoIdsInput', () => {
  it('принимает порядок и нормализует регистр', () => {
    expect(photoIdsInput({ assetIds: [id(2).toUpperCase(), id(1)] })).toEqual([id(2), id(1)]);
    expect(photoIdsInput({ assetIds: [] })).toEqual([]);
  });
  it('отклоняет не список, чужой формат, повтор и больше десяти', () => {
    expect(() => photoIdsInput({})).toThrow();
    expect(() => photoIdsInput({ assetIds: ['x'] })).toThrow();
    expect(() => photoIdsInput({ assetIds: [id(1), id(1)] })).toThrow();
    expect(() =>
      photoIdsInput({ assetIds: Array.from({ length: MAX_CATEGORY_PHOTOS + 1 }, (_, i) => id(i)) }),
    ).toThrow();
  });
});
