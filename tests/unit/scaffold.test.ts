import { describe, expect, it } from 'vitest';
import { assertNever } from '@pms/shared';

/** Проверка каркаса: workspace-пакеты резолвятся по имени, TS-исходники исполняются Vitest. */
describe('scaffold', () => {
  it('resolves @pms/shared and executes TS sources', () => {
    type Kind = 'ROOM' | 'BED';
    const label = (k: Kind): string => {
      switch (k) {
        case 'ROOM':
          return 'room';
        case 'BED':
          return 'bed';
        default:
          return assertNever(k);
      }
    };
    expect(label('ROOM')).toBe('room');
    expect(label('BED')).toBe('bed');
    expect(() => assertNever('X' as never, 'test')).toThrow(/unexpected value "X"/);
  });
});
