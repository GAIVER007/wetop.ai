import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FOOD-FIX-01 (аудит P1.5, ADR-181): ранний возврат «Переключаем ресторан…» в workspace-board
 * стоял выше useState, и смена филиала на /floor-plan и /table-reservations роняла React
 * («Rendered fewer hooks than expected»). Правило eslint react-hooks в репозитории не включено,
 * поэтому порядок сторожит этот тест: после первого раннего return в компоненте хуков быть не должно.
 */
describe('план зала: хуки до раннего возврата', () => {
  it('в workspace-board.tsx нет хуков после «if (switching) return»', () => {
    const source = readFileSync(
      resolve(__dirname, '../../apps/web/src/app/food/workspace-board.tsx'),
      'utf-8',
    );
    const earlyReturn = source.indexOf('if (switching) return');
    expect(earlyReturn, 'ранний возврат на смене филиала должен существовать').toBeGreaterThan(0);
    const after = source.slice(earlyReturn);
    const hookAfterReturn = after.match(
      /\buse(State|Effect|Transition|Router|Memo|Callback|Ref)\b/,
    );
    expect(
      hookAfterReturn?.[0] ?? null,
      'хук после раннего возврата нарушает Rules of Hooks: перенесите его выше',
    ).toBeNull();
  });
});
